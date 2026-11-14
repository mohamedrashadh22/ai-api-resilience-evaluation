const express = require("express");
const app = express();

app.use(express.json({ limit: '10kb' }));

const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || "http://localhost:4001";
const MODEL_SERVICE_TIMEOUT_MS = Number(process.env.MODEL_SERVICE_TIMEOUT_MS) || 2000;
const MAX_MODEL_RETRIES = Number(process.env.MAX_MODEL_RETRIES) || 2;
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS) || 250;
const CIRCUIT_FAILURE_THRESHOLD = Number(process.env.CIRCUIT_FAILURE_THRESHOLD) || 3;
const CIRCUIT_RESET_TIMEOUT_MS = Number(process.env.CIRCUIT_RESET_TIMEOUT_MS) || 10000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let circuitState = "CLOSED";
let circuitFailureCount = 0;
let circuitOpenedAt = null;
let halfOpenProbeInProgress = false;

function refreshCircuitState() {

    if (circuitState === "OPEN" && circuitOpenedAt !== null) {
        const elapsed = Date.now() - circuitOpenedAt;

        if (elapsed >= CIRCUIT_RESET_TIMEOUT_MS) {
            circuitState = "HALF_OPEN";

            console.log("Circuit breaker: HALF_OPEN");
        }
    }

}

function canSendRequest() {

    refreshCircuitState();

    if (circuitState === "CLOSED") {
        return true;
    }

    if (circuitState === "HALF_OPEN") {
        if (halfOpenProbeInProgress) {
            return false;
        }

        halfOpenProbeInProgress = true;
        return true;
    }

    return false;

}

function recordCircuitSuccess() {
    circuitState = "CLOSED";
    circuitFailureCount = 0;
    circuitOpenedAt = null;
    halfOpenProbeInProgress = false;

    console.log("Circuit breaker: CLOSED");
}

function recordCircuitFailure() {
    halfOpenProbeInProgress = false;

    // Keep the failure count within the configured threshold
    circuitFailureCount = Math.min(circuitFailureCount + 1, CIRCUIT_FAILURE_THRESHOLD);

    if (circuitState === "HALF_OPEN" || circuitFailureCount >= CIRCUIT_FAILURE_THRESHOLD) {
        circuitState = "OPEN";
        circuitOpenedAt = Date.now();

        console.log("Circuit breaker: OPEN");
    }
}

app.locals.resetCircuitBreaker = () => {
    circuitState = "CLOSED";
    circuitFailureCount = 0;
    circuitOpenedAt = null;
    halfOpenProbeInProgress = false;
};

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "AI API Resilience Evaluation API",
        version: "1.0.0"
    });
});

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "healthy",
        service: "ai-api-resilience-evaluation"
    });
});

// Generate AI response through the mock model service
app.post("/api/generate", async (req, res) => {

    const { prompt, mode = "normal", delayMs = 0 } = req.body;

    if (typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({
            success: false,
            error: "A valid prompt is required."
        });
    }

    if (!canSendRequest()) {
        return res.status(503).json({
            success: false,
            error: "AI model service temporarily unavailable.",
            circuitState,
            retryAfterMs: Math.max(0, CIRCUIT_RESET_TIMEOUT_MS - (Date.now() - circuitOpenedAt))
        });
    }

    let attempts = 0;

    try {

        let modelResponse;

        // Initial attempt + the permitted retries
        for (let attempt = 0; attempt <= MAX_MODEL_RETRIES; attempt++) {

            attempts++;

            try {

                modelResponse = await fetch(
                    `${MODEL_SERVICE_URL}/generate`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            prompt,
                            mode,
                            delayMs
                        }),
                        signal: AbortSignal.timeout(MODEL_SERVICE_TIMEOUT_MS)
                    }
                );
                
            } catch (error) {

                // Timeout error handlers
                if (error.name === "TimeoutError" || error.name === "AbortError") {
                    throw error;
                }

                // Retry connection failures within the configure limit
                if (attempt < MAX_MODEL_RETRIES) {
                    console.log(`Model connection failed. Retrying (${attempts}/${MAX_MODEL_RETRIES + 1})`);

                    await sleep(RETRY_DELAY_MS);
                    continue;
                }

                throw error;
                
            }

            // Retry only transient upstream HTTP errors
            const retryableStatuses = [502, 503, 504];

            if (retryableStatuses.includes(modelResponse.status) && attempt < MAX_MODEL_RETRIES) {
                console.log(`Model service returned ${modelResponse.status}. Retrying (${attempts}/${MAX_MODEL_RETRIES + 1})`);

                // Release the previous response before retrying
                await modelResponse.body?.cancel();

                await sleep(RETRY_DELAY_MS);
                continue;
            }



            // Success or a non-retryable/final response
            break;

        }

        const modelData = await modelResponse.json();

        if (!modelResponse.ok) {

            if (modelResponse.status >= 500) {
                recordCircuitFailure();
            } else {
                recordCircuitSuccess();
            }

            return res.status(modelResponse.status).json({
                success: false,
                error: "The AI model service returned an error.",
                upstreamStatus: modelResponse.status,
                details: modelData.error,
                attempts
            });
        }

        recordCircuitSuccess();

        return res.status(200).json({
            success: true,
            data: modelData,
            attempts
        });
        
    } catch (error) {

        recordCircuitFailure();

        // Handle model service timeout
        if (error.name === "TimeoutError" || error.name === "AbortError") {
            console.log("Model service request timed out.");

            return res.status(504).json({
                success: false,
                error: "The AI model service request timed out.",
                timeoutMs: MODEL_SERVICE_TIMEOUT_MS,
                attempts
            });
        }

        console.log("Model service communication error:", error.message);

        return res.status(502).json({
            success: false,
            error: "Unable to communicate with the AI model service.",
            attempts
        });
    }

});

app.get("/api/circuit-breaker", (req, res) => {

    refreshCircuitState();

    return res.status(200).json({
        state: circuitState,
        failureCount: circuitFailureCount,
        failureThreshold: CIRCUIT_FAILURE_THRESHOLD,
        resetTimeoutMs: CIRCUIT_RESET_TIMEOUT_MS,
        probeInProgress: halfOpenProbeInProgress
    });
})

module.exports = app;