import os

from dotenv import load_dotenv
from fastapi import Header, HTTPException


load_dotenv()

INTERNAL_SERVICE_KEY = os.getenv("CHATBOT_SERVICE_KEY")


async def verify_internal_service(
    x_internal_service_key: str | None = Header(default=None),
):
    if not INTERNAL_SERVICE_KEY:
        raise RuntimeError("CHATBOT_SERVICE_KEY is not configured")

    if x_internal_service_key != INTERNAL_SERVICE_KEY:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized service",
        )