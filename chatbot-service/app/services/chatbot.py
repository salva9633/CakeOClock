from app.services.llm import generate_response


async def process_message(
    message: str,
    user_id: str,
) -> str:
    response = await generate_response(
        message=message,
        user_id=user_id,
    )

    return response