const express = require("express");

const app = express();

app.use(express.json({ limit: '10kb' }));

const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || "http://localhost:4001";
const MODEL_SERVICE_TIMEOUT_MS = Number(process.env.MODEL_SERVICE_TIMEOUT_MS) || 2000;
const MAX_MODEL_RETRIES = Number(process.env.MAX_MODEL_RETRIES) || 2;
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS) || 250;
const sleep = (ms) => {
    new Promise((resolve) => setTimeout(resolve, ms));
}



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
            return res.status(modelResponse.status).json({
                success: false,
                error: "The AI model service returned an error.",
                upstreamStatus: modelResponse.status,
                details: modelData.error,
                attempts
            });
        }

        return res.status(200).json({
            success: true,
            data: modelData,
            attempts
        });
        
    } catch (error) {

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

module.exports = app;