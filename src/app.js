const express = require("express");

const app = express();

app.use(express.json({ limit: '10kb' }));

const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || "http://localhost:4001";



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

    try {

        const modelResponse = await fetch(
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
            }
        );

        const modelData = await modelResponse.json();

        if (!modelResponse.ok) {
            return res.status(modelResponse.status).json({
                success: false,
                error: "The AI model service returned an error.",
                upstreamStatus: modelResponse.status,
                details: modelData.error
            });
        }

        return res.status(200).json({
            success: true,
            data: modelData
        });
        
    } catch (error) {
        console.log("Model service communication error:", error.message);

        return res.status(502).json({
            success: false,
            error: "Unable to communicate with the AI model service.",
        });
    }

});

module.exports = app;