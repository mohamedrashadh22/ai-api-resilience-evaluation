from fastapi import FastAPI

app = FastAPI(
    title="AI API Resilience Evaluation",
    description=(
        "An empirical evaluation of lightweight resilience "
        "strategies for AI-powered web APIs. "
    ),
    version="0.1.0",
)

@app.get("/")
async def root():
    return {
        "message": "AI API Resilience Evaluation API",
        "status": "running",
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
    }