const { test, mock } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// Circuit breaker configuration
process.env.CIRCUIT_FAILURE_THRESHOLD = "3";
process.env.CIRCUIT_RESET_TIMEOUT_MS = "60000";
process.env.MAX_MODEL_RETRIES = "2";
process.env.RETRY_DELAY_MS = "0";

const app = require("../src/app");

test("GET /health should return a healthy status", async () => {
    const response = await request(app).get("/health");

    assert.equal(response.statusCode, 200);

    assert.deepEqual(response.body, {
        success: true,
        message: "healthy",
        service: "ai-api-resilience-evaluation"
    });
});

test("Circuit breaker should open after three failures and recover after a successful probe", async () => {

    let upstreamMode = "error";
    let upstreamCalls = 0;

    const originalDateNow = Date.now;
    let fakeTime = 1000000;

    // Control time to test the cooldown without waiting 60 seconds.
    Date.now = () => fakeTime;
    app.locals.resetCircuitBreaker();

    const fetchMock = mock.method(globalThis, "fetch", async () => {

        upstreamCalls++;

        if (upstreamMode === "error") {

            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Simulated model service unavailable."
                }),
                {
                    status: 503,
                    headers: { "Content-Type": "application/json" }
                }
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                model: "mock-ai-model-v1",
                response: "Recovery successful"
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" }
            }
        );

    });

    try {

        // Initial state
        let status = await request(app).get("/api/circuit-breaker");

        assert.equal(status.body.state, "CLOSED");
        assert.equal(status.body.failureCount, 0);

        // First failed API request
        let response = await request(app)
            .post("/api/generate")
            .send({ prompt: "First failure", mode: "error" });

        assert.equal(response.statusCode, 503);
        assert.equal(response.body.attempts, 3);

        status = await request(app).get("/api/circuit-breaker");

        assert.equal(status.body.state, "CLOSED");
        assert.equal(status.body.failureCount, 1);

        // Second failed API request
        response = await request(app)
            .post("/api/generate")
            .send({ prompt: "Second failure", mode: "error" });

        assert.equal(response.statusCode, 503);
        assert.equal(response.body.attempts, 3);

        status = await request(app).get("/api/circuit-breaker");

        assert.equal(status.body.state, "CLOSED");
        assert.equal(status.body.failureCount, 2);

        // Third failed API request
        response = await request(app)
            .post("/api/generate")
            .send({ prompt: "Third failure", mode: "error" });

        assert.equal(response.statusCode, 503);
        assert.equal(response.body.attempts, 3);

        status = await request(app).get("/api/circuit-breaker");

        assert.equal(status.body.state, "OPEN");
        assert.equal(status.body.failureCount, 3);

        // Requests should be rejected while the circuit is OPEN.
        const callsBeforeBlockedRequest = upstreamCalls;

        response = await request(app)
            .post("/api/generate")
            .send({ prompt: "Blocked request", model: "normal" });

        assert.equal(response.statusCode, 503);
        assert.equal(response.body.circuitState, "OPEN");
        assert.equal(response.body.attempts, undefined);
        assert.equal(upstreamCalls, callsBeforeBlockedRequest);

        // Advance time beyond the cooldown
        fakeTime += 60001;

        status = await request(app).get("/api/circuit-breaker");

        assert.equal(status.body.state, "HALF_OPEN");
        assert.equal(status.body.failureCount, 3);

        // The model service has recovered
        upstreamMode = "normal";

        response = await request(app)
            .post("/api/generate")
            .send({ prompt: "Recovery probe", mode: "normal" });

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.attempts, 1);

        // Successful probe should close the circuit and reset the counter.
        status = await request(app).get("/api/circuit-breaker");

        assert.equal(status.body.state, "CLOSED");
        assert.equal(status.body.failureCount, 0);
    } finally {
        Date.now = originalDateNow;
        fetchMock.mock.restore();
    }

});

test("Circuit breaker should reopen when the HALF_OPEN recovery probe fails", async () => {

    let upstreamCalls = 0;

    const originalDateNow = Date.now;
    let fakeTime = 2000000;

    Date.now = () => fakeTime;
    app.locals.resetCircuitBreaker();

    const fetchMock = mock.method(globalThis, "fetch", async () => {

        upstreamCalls++;

        return new Response(
            JSON.stringify({
                success: false,
                error: "Simulated model service unavailable."
            }),
            {
                status: 503,
                headers: { "Content-Type": "application/json" }
            }
        )

    });

    try {

        // Verify the starting state
        let status = await request(app).get("/api/circuit-breaker");

        assert.equal(status.body.state, "CLOSED");
        assert.equal(status.body.failureCount, 0);

        // Three failed requests should open the circuit
        for (let i = 1; i <= 3; i++) {
            const response = await request(app)
                .post("/api/generate")
                .send({ prompt: `Failure ${i}`, mode: "error" });

            assert.equal(response.statusCode, 503);
            assert.equal(response.body.attempts, 3);

            status = await request(app).get("/api/circuit-breaker");
            assert.equal(status.body.failureCount, i);
        }

        assert.equal(status.body.state, "OPEN");

        fakeTime += 60001;

        status = await request(app).get("/api/circuit-breaker");

        assert.equal(status.body.state, "HALF_OPEN");

        // The recovery probe also fails.
        const response = await request(app)
            .post("/api/generate")
            .send({ prompt: "Failed recovery probe", mode: "error" });

        assert.equal(response.statusCode, 503);
        assert.equal(response.body.attempts, 3);

        // The circuit should reopen and retain the threshold count.
        status = await request(app).get("/api/circuit-breaker");

        assert.equal(status.body.state, "OPEN");
        assert.equal(status.body.failureCount, 3);
        assert.equal(status.body.probeInProgress, false);

        // A further request must be blocked without contacting the service.
        const callsBeforeBlockedRequest = upstreamCalls;

        const blockedResponse = await request(app)
            .post("/api/generate")
            .send({ prompt: "Blocked after failed recovery", mode: "normal" });

        assert.equal(blockedResponse.statusCode, 503);
        assert.equal(blockedResponse.body.circuitState, "OPEN");
        assert.equal(upstreamCalls, callsBeforeBlockedRequest);
    } finally {
        Date.now = originalDateNow;
        fetchMock.mock.restore();
    }

});


test("Circuit breaker should close when the HALF_OPEN probe receives an upstream 4xx response", async () => {
    const originalDateNow = Date.now;
    let fakeTime = 3000000;

    Date.now = () => fakeTime;
    app.locals.resetCircuitBreaker();

    // Start with HTTP 503 to simulate service failures.
    // Later, change to HTTP 400 for the HALF_OPEN probe.
    let upstreamStatus = 503;

    const fetchMock = mock.method(globalThis, "fetch", async () => {
        const body =
            upstreamStatus === 503
                ? {
                    success: false,
                    error: "Simulated model service unavailable."
                }
                : {
                    success: false,
                    error: "Invalid model request."
                };

        return new Response(JSON.stringify(body), {
            status: upstreamStatus,
            headers: { "Content-Type": "application/json" }
        });
    });

    try {
        // Confirm the initial circuit state.
        let status = await request(app).get("/api/circuit-breaker");

        assert.equal(status.body.state, "CLOSED");
        assert.equal(status.body.failureCount, 0);

        // Generate three failed API requests.
        for (let i = 1; i <= 3; i++) {
            await request(app)
                .post("/api/generate")
                .send({
                    prompt: `Failure ${i}`,
                    mode: "error"
                });
        }

        // The circuit should now be OPEN.
        status = await request(app).get("/api/circuit-breaker");

        assert.equal(status.body.state, "OPEN");
        assert.equal(status.body.failureCount, 3);

        // Advance time beyond the circuit reset timeout.
        fakeTime += 60001;

        // The circuit should transition to HALF_OPEN.
        status = await request(app).get("/api/circuit-breaker");

        assert.equal(status.body.state, "HALF_OPEN");

        // Now simulate a reachable model service returning HTTP 400.
        upstreamStatus = 400;

        const response = await request(app)
            .post("/api/generate")
            .send({
                prompt: "Recovery connectivity test",
                mode: "normal"
            });

        assert.equal(response.statusCode, 400);

        console.log("Recovery response: ", response.body);

        assert.equal(response.body.upstreamStatus, 400, "Expected HTTP 400 from the upstream model service");

        assert.equal(response.body.attempts, 1);

        // The circuit should close because the service responded.
        status = await request(app).get("/api/circuit-breaker");

        assert.equal(status.body.state, "CLOSED");
        assert.equal(status.body.failureCount, 0);
        assert.equal(status.body.probeInProgress, false);

    } finally {
        Date.now = originalDateNow;
        fetchMock.mock.restore();
    }
});