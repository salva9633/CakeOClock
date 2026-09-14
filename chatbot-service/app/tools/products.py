from datetime import datetime, timezone

from app.database.mongodb import db

from bson import ObjectId

from app.database.mongodb import db


async def search_products(query: str, limit: int = 5) -> dict:
    """
    Search customer-visible products by product name.

    Only returns products that:
    - are listed
    - belong to an active category
    - have at least one available variant
    - have at least one active, non-expired batch with stock
    """

    query = query.strip()

    if not query:
        return {
            "found": False,
            "message": "Product search query is required.",
        }

    limit = max(1, min(limit, 10))

    # Get active categories
    active_categories = await db.categories.find(
        {"isActive": True},
        {"_id": 1},
    ).to_list(length=None)

    active_category_ids = [
        category["_id"]
        for category in active_categories
    ]

    if not active_category_ids:
        return {
            "found": False,
            "message": "No products are currently available.",
        }

    # Case-insensitive product-name search
    products = await db.products.find(
        {
            "isListed": True,
            "categoryId": {"$in": active_category_ids},
            "productName": {
                "$regex": query,
                "$options": "i",
            },
        },
        {
            "_id": 1,
            "productName": 1,
            "description": 1,
            "longDescription": 1,
            "brand": 1,
            "averageRating": 1,
            "reviewCount": 1,
            "productOffer": 1,
            "categoryId": 1,
        },
    ).limit(limit).to_list(length=limit)

    if not products:
        return {
            "found": False,
            "message": f"No products found for '{query}'.",
        }

    now = datetime.now(timezone.utc)

    results = []

    for product in products:
        product_id = product["_id"]

        # Get active variants
        variants = await db.variants.find(
            {
                "productId": product_id,
                "isAvailable": True,
            },
            {
                "_id": 1,
                "weight": 1,
                "regularPrice": 1,
            },
        ).sort("regularPrice", 1).to_list(length=None)

        available_variants = []

        for variant in variants:
            # Check actual stock
            stock_batch = await db.batches.find_one(
                {
                    "variantId": variant["_id"],
                    "status": "active",
                    "expiryAt": {"$gt": now},
                    "availableStock": {"$gt": 0},
                }
            )

            if not stock_batch:
                continue

            # Get category offer
            category = await db.categories.find_one(
                {"_id": product["categoryId"]},
                {
                    "categoryOffer": 1,
                },
            )

            product_offer = product.get("productOffer") or 0
            category_offer = (
                category.get("categoryOffer", 0)
                if category
                else 0
            )

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

            available_variants.append(
                {
                    "weight": variant.get("weight"),
                    "originalPrice": regular_price,
                    "finalPrice": final_price,
                    "discountPercent": best_discount,
                    "offerApplied": best_discount > 0,
                }
            )

        # Product has no purchasable variants
        if not available_variants:
            continue

        results.append(
            {
                "productId": str(product_id),
                "productName": product.get("productName"),
                "description": product.get("description"),
                "brand": product.get("brand"),
                "averageRating": product.get("averageRating", 0),
                "reviewCount": product.get("reviewCount", 0),
                "variants": available_variants,
            }
        )

    if not results:
        return {
            "found": False,
            "message": f"No currently available products found for '{query}'.",
        }

    return {
        "found": True,
        "count": len(results),
        "products": results,
    }

from bson import ObjectId


async def get_product_details(product_id: str) -> dict:
    """
    Get detailed information about a customer-visible product.

    Only returns:
    - listed products
    - products belonging to active categories
    - available variants with actual stock
    - customer-facing pricing
    """

    try:
        product_object_id = ObjectId(product_id)
    except Exception:
        return {
            "found": False,
            "error": "Invalid product ID",
        }

    product = await db.products.find_one(
        {
            "_id": product_object_id,
            "isListed": True,
        },
        {
            "_id": 1,
            "productName": 1,
            "description": 1,
            "longDescription": 1,
            "brand": 1,
            "productImages": 1,
            "averageRating": 1,
            "reviewCount": 1,
            "productOffer": 1,
            "categoryId": 1,
        },
    )

    if not product:
        return {
            "found": False,
            "message": "Product not found or is not currently available.",
        }

    # Verify that the product belongs to an active category
    category = await db.categories.find_one(
        {
            "_id": product["categoryId"],
            "isActive": True,
        },
        {
            "categoryOffer": 1,
            "name": 1,
        },
    )

    if not category:
        return {
            "found": False,
            "message": "Product is not currently available.",
        }

    variants = await db.variants.find(
        {
            "productId": product_object_id,
            "isAvailable": True,
        },
        {
            "_id": 1,
            "weight": 1,
            "regularPrice": 1,
        },
    ).sort("regularPrice", 1).to_list(length=None)

    now = datetime.now(timezone.utc)

    product_offer = product.get("productOffer") or 0
    category_offer = category.get("categoryOffer") or 0
    best_discount = max(product_offer, category_offer)

    available_variants = []

    for variant in variants:
        stock_batch = await db.batches.find_one(
            {
                "variantId": variant["_id"],
                "status": "active",
                "expiryAt": {"$gt": now},
                "availableStock": {"$gt": 0},
            }
        )

        if not stock_batch:
            continue

        regular_price = variant.get("regularPrice", 0)

        if best_discount > 0:
            final_price = round(
                regular_price
                - (regular_price * best_discount / 100)
            )
        else:
            final_price = regular_price

        available_variants.append(
            {
                "weight": variant.get("weight"),
                "originalPrice": regular_price,
                "finalPrice": final_price,
                "discountPercent": best_discount,
                "offerApplied": best_discount > 0,
            }
        )

    if not available_variants:
        return {
            "found": False,
            "message": "Product is currently out of stock.",
        }

    return {
        "found": True,
        "product": {
            "productId": str(product["_id"]),
            "productName": product.get("productName"),
            "description": product.get("description"),
            "longDescription": product.get("longDescription"),
            "brand": product.get("brand"),
            "productImages": product.get("productImages", []),
            "averageRating": product.get("averageRating", 0),
            "reviewCount": product.get("reviewCount", 0),
            "variants": available_variants,
        },
    }
async def get_product_reviews(
    product_id: str,
    limit: int = 5,
) -> dict:
    """
    Get customer reviews for a specific product.

    Only returns reviews for products that are:
    - listed
    - part of an active category

    Does not expose reviewer user IDs.
    """

    try:
        product_object_id = ObjectId(product_id)
    except Exception:
        return {
            "found": False,
            "error": "Invalid product ID",
        }

    # Verify that the product is customer-visible
    product = await db.products.find_one(
        {
            "_id": product_object_id,
            "isListed": True,
        },
        {
            "_id": 1,
            "productName": 1,
            "categoryId": 1,
        },
    )

    if not product:
        return {
            "found": False,
            "message": "Product not found or is not currently available.",
        }

    # Verify that the category is active
    category = await db.categories.find_one(
        {
            "_id": product["categoryId"],
            "isActive": True,
        },
        {
            "_id": 1,
        },
    )

    if not category:
        return {
            "found": False,
            "message": "Product is not currently available.",
        }

    limit = max(1, min(limit, 10))

    reviews = await db.reviews.find(
        {
            "productId": product_object_id,
        },
        {
            "_id": 0,
            "rating": 1,
            "comment": 1,
            "createdAt": 1,
        },
    ).sort(
        "createdAt",
        -1,
    ).limit(limit).to_list(length=limit)

    if not reviews:
        return {
            "found": False,
            "productId": str(product_object_id),
            "productName": product.get("productName"),
            "message": "No reviews yet for this product.",
        }

    formatted_reviews = []

    for review in reviews:
        formatted_reviews.append(
            {
                "rating": review.get("rating"),
                "comment": review.get("comment"),
                "createdAt": (
                    review.get("createdAt").isoformat()
                    if review.get("createdAt")
                    else None
                ),
            }
        )

    return {
        "found": True,
        "productId": str(product_object_id),
        "productName": product.get("productName"),
        "count": len(formatted_reviews),
        "reviews": formatted_reviews,
    }