from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.services.auth import verify_internal_service
from app.services.chatbot import process_message


router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    userId: str


@router.post(
    "/message",
    dependencies=[Depends(verify_internal_service)],
)
async def chat_message(payload: ChatMessage):
    response = await process_message(
        message=payload.message,
        user_id=payload.userId,
    )

    return {
        "success": True,
        "response": response,
        "receivedUserId": payload.userId,
    }