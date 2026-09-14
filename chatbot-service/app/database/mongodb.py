import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import AsyncMongoClient

BASE_DIR = Path(__file__).resolve().parents[3]
ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE)

MONGODB_URI = os.getenv("MONGODB_URI")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI is not configured")

client = AsyncMongoClient(MONGODB_URI)
db = client.get_default_database()