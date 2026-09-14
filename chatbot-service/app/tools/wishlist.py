from datetime import datetime, timezone

from app.database.mongodb import db
from bson import ObjectId


async def get_wishlist(user_id: str) -> dict:
    """
    Get the authenticated customer's wishlist.

    Returns customer-facing product information only.
    """

    try:
        user_object_id = ObjectId(user_id)
    except Exception:
        return {
            "found": False,
            "error": "Invalid user ID",
        }

    wishlist = await db.wishlists.find_one(
        {
            "userId": user_object_id,
        },
        {
            "_id": 0,
            "products": 1,
        },
    )

    if not wishlist or not wishlist.get("products"):
        return {
            "found": False,
            "message": "Your wishlist is empty.",
        }

    now = datetime.now(timezone.utc)

    formatted_products = []

    for item in wishlist["products"]:

        product_id = item.get("productId")
        variant_id = item.get("variantId")

        if not product_id:
            continue

        product = await db.products.find_one(
            {
                "_id": product_id,
                "isListed": True,
            },
            {
                "_id": 1,
                "productName": 1,
                "brand": 1,
                "categoryId": 1,
                "productOffer": 1,
                "averageRating": 1,
                "reviewCount": 1,
            },
        )

        if not product:
            continue

        # Product must belong to an active category
        category = await db.categories.find_one(
            {
                "_id": product["categoryId"],
                "isActive": True,
            },
            {
                "categoryOffer": 1,
            },
        )

        if not category:
            continue

        variant = None

        if variant_id:
            variant = await db.variants.find_one(
                {
                    "_id": variant_id,
                    "productId": product["_id"],
                    "isAvailable": True,
                },
                {
                    "_id": 1,
                    "weight": 1,
                    "regularPrice": 1,
                },
            )

        # If the wishlist item doesn't contain a valid variant,
        # try to find an available variant for the product.
        if not variant:
            variant = await db.variants.find_one(
                {
                    "productId": product["_id"],
                    "isAvailable": True,
                },
                {
                    "_id": 1,
                    "weight": 1,
                    "regularPrice": 1,
                },
                sort=[("regularPrice", 1)],
            )

        product_data = {
            "productId": str(product["_id"]),
            "productName": product.get("productName"),
            "brand": product.get("brand"),
            "averageRating": product.get("averageRating", 0),
            "reviewCount": product.get("reviewCount", 0),
        }

        if variant:

            stock_batch = await db.batches.find_one(
                {
                    "variantId": variant["_id"],
                    "status": "active",
                    "expiryAt": {"$gt": now},
                    "availableStock": {"$gt": 0},
                }
            )

            product_offer = product.get("productOffer") or 0
            category_offer = category.get("categoryOffer") or 0

            best_discount = max(
                product_offer,
                category_offer,
            )

            regular_price = variant.get("regularPrice", 0)

            if best_discount > 0:
                final_price = round(
                    regular_price
                    - (regular_price * best_discount / 100)
                )
            else:
                final_price = regular_price

            product_data["variant"] = {
                "weight": variant.get("weight"),
                "originalPrice": regular_price,
                "finalPrice": final_price,
                "discountPercent": best_discount,
                "offerApplied": best_discount > 0,
                "available": stock_batch is not None,
            }

        else:
            product_data["variant"] = None

        formatted_products.append(product_data)

    if not formatted_products:
        return {
            "found": False,
            "message": "Your wishlist is empty.",
        }

    return {
        "found": True,
        "count": len(formatted_products),
        "products": formatted_products,
    }