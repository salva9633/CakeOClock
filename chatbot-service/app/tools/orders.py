from bson import ObjectId

from app.database.mongodb import db


async def get_latest_order(user_id: str) -> dict:
    """
    Retrieve the most recently created order belonging to the authenticated user.
    """

    try:
        user_object_id = ObjectId(user_id)
    except Exception:
        return {
            "found": False,
            "error": "Invalid user ID",
        }

    order = await db.orders.find_one(
        {"userId": user_object_id},
        sort=[("createdAt", -1)],
    )

    if not order:
        return {
            "found": False,
            "message": "No orders found for this user.",
        }

    return {
        "found": True,
        "order": {
            "orderId": order.get("orderId"),
            "status": order.get("status"),
            "paymentMethod": order.get("paymentMethod"),
            "paymentStatus": order.get("paymentStatus"),
            "itemTotal": order.get("itemTotal"),
            "discount": order.get("discount"),
            "tax": order.get("tax"),
            "shippingCharge": order.get("shippingCharge"),
            "finalTotal": order.get("finalTotal"),
            "createdAt": (
                order.get("createdAt").isoformat()
                if order.get("createdAt")
                else None
            ),
            "items": [
                {
                    "productName": item.get("productName"),
                    "quantity": item.get("quantity"),
                    "price": item.get("price"),
                    "status": item.get("status"),
                }
                for item in order.get("items", [])
            ],
        },
    }

async def get_order_history(
    user_id: str,
    limit: int = 5,
) -> dict:
    """
    Retrieve the customer's most recent orders.
    """

    try:
        user_object_id = ObjectId(user_id)
    except Exception:
        return {
            "found": False,
            "error": "Invalid user ID",
        }

    # Keep the chatbot response reasonably small.
    limit = max(1, min(limit, 10))

    cursor = (
        db.orders
        .find(
            {"userId": user_object_id},
            {
                "_id": 0,
                "orderId": 1,
                "status": 1,
                "paymentMethod": 1,
                "paymentStatus": 1,
                "finalTotal": 1,
                "createdAt": 1,
                "items": 1,
            },
        )
        .sort("createdAt", -1)
        .limit(limit)
    )

    orders = await cursor.to_list(length=limit)

    if not orders:
        return {
            "found": False,
            "message": "No orders found for this user.",
        }

    formatted_orders = []

    for order in orders:
        formatted_orders.append(
            {
                "orderId": order.get("orderId"),
                "status": order.get("status"),
                "paymentMethod": order.get("paymentMethod"),
                "paymentStatus": order.get("paymentStatus"),
                "finalTotal": order.get("finalTotal"),
                "createdAt": (
                    order.get("createdAt").isoformat()
                    if order.get("createdAt")
                    else None
                ),
                "items": [
                    {
                        "productName": item.get("productName"),
                        "quantity": item.get("quantity"),
                        "status": item.get("status"),
                    }
                    for item in order.get("items", [])
                ],
            }
        )

    return {
        "found": True,
        "count": len(formatted_orders),
        "orders": formatted_orders,
    }

async def get_order_details(
    user_id: str,
    order_id: str,
) -> dict:
    """
    Retrieve a specific order belonging to the authenticated user.
    """

    try:
        user_object_id = ObjectId(user_id)
    except Exception:
        return {
            "found": False,
            "error": "Invalid user ID",
        }

    order_id = order_id.strip()

    if not order_id:
        return {
            "found": False,
            "error": "Order ID is required",
        }

    order = await db.orders.find_one(
        {
            "orderId": order_id,
            "userId": user_object_id,
        },
        {
            "_id": 0,
            "orderId": 1,
            "status": 1,
            "paymentMethod": 1,
            "paymentStatus": 1,
            "itemTotal": 1,
            "discount": 1,
            "tax": 1,
            "shippingCharge": 1,
            "finalTotal": 1,
            "createdAt": 1,
            "cancelReason": 1,
            "returnReason": 1,
            "isCustomizedCake": 1,
            "items": 1,
        },
    )

    if not order:
        return {
            "found": False,
            "message": "Order not found.",
        }

    return {
        "found": True,
        "order": {
            "orderId": order.get("orderId"),
            "status": order.get("status"),
            "paymentMethod": order.get("paymentMethod"),
            "paymentStatus": order.get("paymentStatus"),
            "itemTotal": order.get("itemTotal"),
            "discount": order.get("discount"),
            "tax": order.get("tax"),
            "shippingCharge": order.get("shippingCharge"),
            "finalTotal": order.get("finalTotal"),
            "createdAt": (
                order.get("createdAt").isoformat()
                if order.get("createdAt")
                else None
            ),
            "cancelReason": order.get("cancelReason"),
            "returnReason": order.get("returnReason"),
            "isCustomizedCake": order.get("isCustomizedCake", False),
            "items": [
                {
                    "productName": item.get("productName"),
                    "quantity": item.get("quantity"),
                    "price": item.get("price"),
                    "regularPrice": item.get("regularPrice"),
                    "status": item.get("status"),
                    "cancelReason": item.get("cancelReason"),
                    "returnReason": item.get("returnReason"),
                    "isRefunded": item.get("isRefunded", False),
                    "refundAmount": item.get("refundAmount", 0),
                }
                for item in order.get("items", [])
            ],
        },
    }