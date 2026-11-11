const express = require("express");

const app = express();

app.use(express.json());

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

module.exports = app;