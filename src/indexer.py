from typing import List

from langchain_community.retrievers import BM25Retriever

from config import COLLECTION_NAME, EMBED_MODE, GOOGLE_API_KEY, VECTOR_DB_PATH
from ingestion import DocumentChunk


class HybridIndexer:
    """BM25 always; optional Chroma + Gemini embeddings when RAG_EMBED_MODE=google."""

    def __init__(self, collection_name: str = COLLECTION_NAME):
        self.collection_name = collection_name
        self.persist_path = str(VECTOR_DB_PATH)
        self.vector_store = None
        self.bm25_retriever = None
        self._embeddings = None

    def _get_embeddings(self):
        if self._embeddings is not None:
            return self._embeddings
        if EMBED_MODE == "bm25":
            return None

        if EMBED_MODE == "google":
            if not GOOGLE_API_KEY:
                raise ValueError("GOOGLE_API_KEY required when RAG_EMBED_MODE=google")
            from langchain_google_genai import GoogleGenerativeAIEmbeddings

            self._embeddings = GoogleGenerativeAIEmbeddings(
                model="models/text-embedding-004",
                google_api_key=GOOGLE_API_KEY,
            )
            return self._embeddings

        if EMBED_MODE == "local":
            from langchain_community.embeddings import HuggingFaceEmbeddings

            from config import EMBED_MODEL

            self._embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL)
            return self._embeddings

        raise ValueError(f"Unknown RAG_EMBED_MODE: {EMBED_MODE} (use bm25, google, or local)")

    def build_index(self, chunks: List[DocumentChunk]):
        if not chunks:
            raise ValueError("Cannot build index from empty chunk list.")

        texts = [c.content for c in chunks]
        metadatas = [
            {
                "page": c.page_number,
                "source": c.source_file,
                "source_id": c.source_id,
                "doc_type": "pdf",
            }
            for c in chunks
        ]

        self.bm25_retriever = BM25Retriever.from_texts(texts=texts, metadatas=metadatas)

        embeddings = self._get_embeddings()
        if embeddings is None:
            return None

        from langchain_community.vectorstores import Chroma

        self.vector_store = Chroma.from_texts(
            texts=texts,
            embedding=embeddings,
            metadatas=metadatas,
            persist_directory=self.persist_path,
            collection_name=self.collection_name,
        )
        return self.vector_store
