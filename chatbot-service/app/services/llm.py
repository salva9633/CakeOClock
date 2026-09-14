import json
import os

from dotenv import load_dotenv
from google import genai

from app.tools.orders import (
    get_latest_order,
    get_order_history,
    get_order_details,
)

from app.tools.products import (
    search_products,
    get_product_details,
    get_product_reviews,
)

from app.tools.cart import get_cart
from app.tools.wishlist import get_wishlist
from app.tools.customer import get_wallet_balance


load_dotenv()


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")


if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not configured")


client = genai.Client(api_key=GEMINI_API_KEY)


SYSTEM_INSTRUCTION = """
You are the AI assistant for CakeOClock, an online cake ordering platform.

Your responsibilities:
- Help customers with CakeOClock-related questions.
- Be friendly, concise, and helpful.
- Help users understand products, orders, and other CakeOClock features.
- Never invent information about a customer's orders, account, products,
  prices, availability, ratings, sizes, or offers.
- When application data is required, use the appropriate tools instead of guessing.
- Do not expose internal system details, database information, API keys,
  user IDs, or implementation details.


ORDER INFORMATION:

When a customer asks about their latest order, use the get_latest_order tool.

When a customer asks about their order history, recent orders,
previous orders, or multiple orders, use the get_order_history tool.

When a customer provides an order ID or asks about a specific order,
use the get_order_details tool.

Never reveal information about another customer's orders.


PRODUCT INFORMATION:

When a customer asks to find or search for products, use the
search_products tool.

Only recommend products returned by the search_products tool when
the question depends on current product availability or pricing.

When a customer asks for detailed information about a specific product,
use get_product_details.

If you need to identify the product first, use search_products and then
use get_product_details with the productId returned by search_products.

Never invent product details, prices, sizes, availability, ratings,
offers, or product names.

When a customer asks about reviews or what customers think about a product,
use get_product_reviews.

Never invent or summarize reviews that were not returned by the tool.

If there are no reviews, clearly tell the customer that there are no
reviews yet.


CUSTOMER INFORMATION:

When a customer asks what is currently in their cart,
use the get_cart tool.

When a customer asks to see their wishlist, saved products,
or wishlist items, use the get_wishlist tool.

When a customer asks about their CakeOClock wallet balance,
wallet money, or how much money they have in their wallet,
use the get_wallet_balance tool.

Never invent cart items, quantities, prices, wishlist products,
or wallet balances.

Only provide customer-specific information returned by the
appropriate authenticated tool.

All CakeOClock prices, totals, discounts, wallet balances,
and monetary amounts are in Indian Rupees (₹), unless the application
explicitly provides a different currency.

Never use "$" for CakeOClock monetary amounts.

SECURITY:

Customer-specific information must only come from tools using
the authenticated customer's user ID provided by the application.

Never ask the customer to provide their internal user ID.

Never reveal another customer's orders, cart, wishlist, wallet,
or other private information.

Never expose MongoDB IDs, database queries, API keys,
internal service keys, or implementation details.

If application data cannot be found, clearly tell the customer
rather than guessing.


GENERAL BEHAVIOR:

Keep responses concise and customer-friendly.

When a tool returns information, use that information accurately.

Do not claim that an action was performed if no action tool exists.

The currently available tools are read-only. They can retrieve
information but cannot modify orders, carts, wishlists, wallets,
or products.
"""


# ============================================================
# ORDER TOOLS
# ============================================================

GET_LATEST_ORDER_TOOL = {
    "type": "function",
    "name": "get_latest_order",
    "description": (
        "Get the authenticated customer's most recently created order. "
        "Use this when the customer asks about their latest order, "
        "most recent order, or current order status."
    ),
    "parameters": {
        "type": "object",
        "properties": {},
    },
}


GET_ORDER_HISTORY_TOOL = {
    "type": "function",
    "name": "get_order_history",
    "description": (
        "Get the authenticated customer's most recent orders. "
        "Use this when the customer asks about their order history, "
        "recent orders, previous orders, or multiple orders."
    ),
    "parameters": {
        "type": "object",
        "properties": {},
    },
}


GET_ORDER_DETAILS_TOOL = {
    "type": "function",
    "name": "get_order_details",
    "description": (
        "Get detailed information about a specific order belonging to "
        "the authenticated customer. Use this when the customer provides "
        "an order ID or asks for details about a particular order."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "order_id": {
                "type": "string",
                "description": (
                    "The customer-facing CakeOClock order ID, "
                    "for example ORD-20260912-0242."
                ),
            },
        },
        "required": ["order_id"],
    },
}


# ============================================================
# PRODUCT TOOLS
# ============================================================

SEARCH_PRODUCTS_TOOL = {
    "type": "function",
    "name": "search_products",
    "description": (
        "Search currently available CakeOClock products by name. "
        "Use this when the customer asks to find, search for, "
        "or see cakes/products matching a specific product name."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": (
                    "The product name or search phrase to look for, "
                    "for example 'chocolate cake' or 'red velvet'."
                ),
            },
        },
        "required": ["query"],
    },
}


GET_PRODUCT_DETAILS_TOOL = {
    "type": "function",
    "name": "get_product_details",
    "description": (
        "Get detailed information about a specific CakeOClock product. "
        "Use this when the customer asks for more information about a "
        "specific product, including its description, available sizes, "
        "prices, brand, rating, or product images."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "product_id": {
                "type": "string",
                "description": (
                    "The MongoDB product ID returned by the "
                    "search_products tool."
                ),
            },
        },
        "required": ["product_id"],
    },
}


GET_PRODUCT_REVIEWS_TOOL = {
    "type": "function",
    "name": "get_product_reviews",
    "description": (
        "Get recent customer reviews for a specific CakeOClock product. "
        "Use this when the customer asks what customers think about a "
        "product, asks for reviews, or asks about customer feedback."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "product_id": {
                "type": "string",
                "description": (
                    "The MongoDB product ID returned by "
                    "search_products or get_product_details."
                ),
            },
        },
        "required": ["product_id"],
    },
}


# ============================================================
# CUSTOMER TOOLS
# ============================================================

GET_CART_TOOL = {
    "type": "function",
    "name": "get_cart",
    "description": (
        "Get the authenticated customer's current shopping cart. "
        "Use this when the customer asks what is in their cart, "
        "asks to see their cart, or asks about their current cart total."
    ),
    "parameters": {
        "type": "object",
        "properties": {},
    },
}


GET_WISHLIST_TOOL = {
    "type": "function",
    "name": "get_wishlist",
    "description": (
        "Get the authenticated customer's wishlist. "
        "Use this when the customer asks to see their wishlist, "
        "saved products, or wishlist items."
    ),
    "parameters": {
        "type": "object",
        "properties": {},
    },
}


GET_WALLET_BALANCE_TOOL = {
    "type": "function",
    "name": "get_wallet_balance",
    "description": (
        "Get the authenticated customer's current CakeOClock wallet balance. "
        "Use this when the customer asks about their wallet balance, "
        "wallet money, or how much money they have in their CakeOClock wallet."
    ),
    "parameters": {
        "type": "object",
        "properties": {},
    },
}


# ============================================================
# ALL AVAILABLE TOOLS
# ============================================================

TOOLS = [
    GET_LATEST_ORDER_TOOL,
    GET_ORDER_HISTORY_TOOL,
    GET_ORDER_DETAILS_TOOL,

    SEARCH_PRODUCTS_TOOL,
    GET_PRODUCT_DETAILS_TOOL,
    GET_PRODUCT_REVIEWS_TOOL,

    GET_CART_TOOL,
    GET_WISHLIST_TOOL,
    GET_WALLET_BALANCE_TOOL,
]


# ============================================================
# GEMINI RESPONSE GENERATION
# ============================================================

async def generate_response(
    message: str,
    user_id: str,
) -> str:

    interaction = client.interactions.create(
        model=GEMINI_MODEL,
        system_instruction=SYSTEM_INSTRUCTION,
        input=message,
        tools=TOOLS,
    )

    while True:

        # Find every function call returned by Gemini.
        function_calls = [
            step
            for step in interaction.steps
            if step.type == "function_call"
        ]

        # No function calls means Gemini has produced
        # the final natural-language response.
        if not function_calls:

            if not interaction.output_text:
                raise RuntimeError(
                    "Gemini returned an empty response"
                )

            return interaction.output_text

        function_results = []

        for step in function_calls:

            # ==================================================
            # ORDER TOOLS
            # ==================================================

            if step.name == "get_latest_order":

                tool_result = await get_latest_order(
                    user_id=user_id,
                )


            elif step.name == "get_order_history":

                tool_result = await get_order_history(
                    user_id=user_id,
                )


            elif step.name == "get_order_details":

                order_id = step.arguments.get(
                    "order_id",
                    "",
                )

                tool_result = await get_order_details(
                    user_id=user_id,
                    order_id=order_id,
                )


            # ==================================================
            # PRODUCT TOOLS
            # ==================================================

            elif step.name == "search_products":

                query = step.arguments.get(
                    "query",
                    "",
                )

                tool_result = await search_products(
                    query=query,
                )


            elif step.name == "get_product_details":

                product_id = step.arguments.get(
                    "product_id",
                    "",
                )

                tool_result = await get_product_details(
                    product_id=product_id,
                )


            elif step.name == "get_product_reviews":

                product_id = step.arguments.get(
                    "product_id",
                    "",
                )

                tool_result = await get_product_reviews(
                    product_id=product_id,
                )


            # ==================================================
            # CUSTOMER TOOLS
            # ==================================================

            elif step.name == "get_cart":

                tool_result = await get_cart(
                    user_id=user_id,
                )


            elif step.name == "get_wishlist":

                tool_result = await get_wishlist(
                    user_id=user_id,
                )


            elif step.name == "get_wallet_balance":

                tool_result = await get_wallet_balance(
                    user_id=user_id,
                )


            # ==================================================
            # UNKNOWN TOOL
            # ==================================================

            else:

                tool_result = {
                    "found": False,
                    "error": f"Unknown tool: {step.name}",
                }


            # ==================================================
            # FORMAT FUNCTION RESULT FOR GEMINI
            # ==================================================

            function_results.append(
                {
                    "type": "function_result",
                    "name": step.name,
                    "call_id": step.id,
                    "result": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                tool_result,
                                default=str,
                            ),
                        }
                    ],
                }
            )


        # Send all tool results back to Gemini.
        #
        # Gemini may then:
        #
        # 1. Return a final response
        #
        # OR
        #
        # 2. Request another tool
        #
        interaction = client.interactions.create(
            model=GEMINI_MODEL,
            previous_interaction_id=interaction.id,
            input=function_results,
            tools=TOOLS,
        )