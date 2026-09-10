from fastapi import FastAPI

from app.api.chat import router as chat_router
from app.database.mongodb import client


app = FastAPI(
    title="CakeOClock Chatbot Service",
    version="1.0.0",
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "chatbot-service",
    }


@app.get("/health/database")
async def database_health():
    try:
        await client.admin.command("ping")

        return {
            "status": "ok",
            "database": "connected",
        }

    except Exception as error:
        return {
            "status": "error",
            "database": "disconnected",
            "message": str(error),
        }


app.include_router(
    chat_router,
    prefix="/chat",
)