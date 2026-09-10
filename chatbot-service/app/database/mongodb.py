import os

from dotenv import load_dotenv
from pymongo import AsyncMongoClient


load_dotenv()


MONGODB_URI = os.getenv("MONGODB_URI")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI is not configured")


client = AsyncMongoClient(MONGODB_URI)

db = client.get_default_database()