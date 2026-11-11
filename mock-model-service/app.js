const express = require("express");

const app = express();

app.use(express.json({ limit: "10kb" }));

// Mock model service health check
app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        status: "healthy",
        service: "mock-ai-model-service"
    });
});

app.post("/generate", async (req, res) => {

    const { prompt, mode = "normal", delayMs = 0 } = req.body;

    if (typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({
            success: false,
            error: "A valid prompt is required",
        });
    }

    const allowedModels = ["normal", "delay", "error"];

    if (!allowedModels.includes(mode)) {
        return res.status(400).json({
            success: false,
            error: "Invalid simulation mode",
            allowedModels
        });
    }

    // Simulate service error
    if (mode === "error") {
        return res.status(503).json({
            success: false,
            error: "Simulated model service unavailable."
        });
    }

    // Validate artificial delay
    if (mode === "delay" && (!Number.isInteger(delayMs) || delayMs < 1 || delayMs > 10000)) {
        return res.status(400).json({
            success: false,
            error: "delayMs must be an integer between 1 and 10000"
        });
    }

    // Simulate a slow model response
    if (mode === "delay") {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // Return a deterministic mock response
    return res.status(200).json({
        success: true,
        model: "mock-ai-model-v1",
        response: `Mock AI response to: ${prompt.trim()}`,
        simulation: {
            mode,
            delayMs: mode === "delay" ? delayMs : 0
        }
    });

});

module.exports = app;