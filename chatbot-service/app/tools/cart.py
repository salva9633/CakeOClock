from bson import ObjectId

from app.database.mongodb import db


async def get_cart(user_id: str) -> dict:
    """
    Get the authenticated customer's cart.

    Returns customer-facing cart information only.
    Internal database IDs and sensitive fields are not exposed.
    """

    try:
        user_object_id = ObjectId(user_id)
    except Exception:
        return {
            "found": False,
            "error": "Invalid user ID",
        }

    cart = await db.carts.find_one(
        {
            "userId": user_object_id,
        },
        {
            "_id": 0,
            "items": 1,
            "totalPrice": 1,
        },
    )

    if not cart:
        return {
            "found": False,
            "message": "Your cart is empty.",
        }

    cart_items = cart.get("items", [])

    if not cart_items:
        return {
            "found": False,
            "message": "Your cart is empty.",
        }

    formatted_items = []

    for item in cart_items:

        product_id = item.get("productId")
        variant_id = item.get("variantId")
        customized_cake_id = item.get("customizedCakeId")

        product = None
        variant = None

        # Normal product cart item
        if product_id:
            product = await db.products.find_one(
                {
                    "_id": product_id,
                },
                {
                    "_id": 1,
                    "productName": 1,
                    "isListed": 1,
                },
            )

        # Product variant information
        if variant_id:
            variant = await db.variants.find_one(
                {
                    "_id": variant_id,
                },
                {
                    "_id": 1,
                    "weight": 1,
                    "isAvailable": 1,
                },
            )

        item_data = {
            "quantity": item.get("quantity", 1),
            "price": item.get("price", 0),
        }

        if product:
            item_data["productName"] = product.get("productName")

        if variant:
            item_data["weight"] = variant.get("weight")

        # Customized cake item
        if customized_cake_id:
            item_data["isCustomizedCake"] = True
            item_data["customizedCakeId"] = str(
                customized_cake_id
            )
        else:
            item_data["isCustomizedCake"] = False

        formatted_items.append(item_data)

    return {
        "found": True,
        "itemCount": len(formatted_items),
        "items": formatted_items,
        "totalPrice": cart.get("totalPrice", 0),
    }