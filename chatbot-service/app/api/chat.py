from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.services.auth import verify_internal_service


router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    userId: str


@router.post(
    "/message",
    dependencies=[Depends(verify_internal_service)],
)
async def chat_message(payload: ChatMessage):
    return {
        "success": True,
        "message": "FastAPI chatbot service is working.",
        "receivedMessage": payload.message,
        "receivedUserId": payload.userId,
    }