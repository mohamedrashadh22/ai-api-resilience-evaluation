const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

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