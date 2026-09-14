from bson import ObjectId

from app.database.mongodb import db


async def get_wallet_balance(user_id: str) -> dict:
    """
    Get the authenticated customer's current wallet balance.

    The User.walletBalance field is the application's
    source of truth for the current wallet balance.
    """

    try:
        user_object_id = ObjectId(user_id)
    except Exception:
        return {
            "found": False,
            "error": "Invalid user ID",
        }

    user = await db.users.find_one(
        {
            "_id": user_object_id,
        },
        {
            "_id": 0,
            "walletBalance": 1,
        },
    )

    if not user:
        return {
            "found": False,
            "message": "User account not found.",
        }

    return {
        "found": True,
        "walletBalance": user.get("walletBalance", 0),
    }