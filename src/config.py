import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
VECTOR_DB_PATH = PROJECT_ROOT / "chroma_data"

# Always load .env from project root (works regardless of Streamlit cwd)
load_dotenv(PROJECT_ROOT / ".env", override=True)

DEFAULT_CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "500"))
DEFAULT_CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "100"))
DEFAULT_TOP_K = int(os.getenv("RAG_TOP_K", "5"))
MAX_AGENT_RETRIES = int(os.getenv("RAG_MAX_AGENT_RETRIES", "2"))

# bm25 = low RAM (default). google = Gemini embeddings. local = HuggingFace (heavy).
EMBED_MODE = os.getenv("RAG_EMBED_MODE", "bm25").lower()
EMBED_MODEL = os.getenv("RAG_EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
COLLECTION_NAME = os.getenv("RAG_COLLECTION", "doc_index")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GOOGLE_MODEL = os.getenv("GOOGLE_MODEL", "gemini-2.0-flash")

VECTOR_WEIGHT = float(os.getenv("RAG_VECTOR_WEIGHT", "0.7"))
BM25_WEIGHT = float(os.getenv("RAG_BM25_WEIGHT", "0.3"))
