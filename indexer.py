import os
from typing import List
from langchain_community.retrievers import BM25Retriever
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_qdrant import QdrantVectorStore  # 🔹 Updated import
from ingestion import DocumentChunk

class HybridIndexer:
    def __init__(self, collection_name: str = "doc_index"):
        self.collection_name = collection_name

        # 🔹 Updated model name (verify with current Google AI docs)
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004", # or "gemini-embedding-exp-03-07"
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            task_type="retrieval_document"
        )

    def build_index(self, chunks: List[DocumentChunk]):
        texts = [c.content for c in chunks]
        metadatas = [{"page": c.page_number, "source": c.source_file} for c in chunks]

        # 🔹 Qdrant now accepts `location` directly. No manual client needed.
        self.vector_store = QdrantVectorStore.from_texts(
            texts,
            self.embeddings,
            metadatas=metadatas,
            location=":memory:",
            collection_name=self.collection_name
        )

        # 🔹 Pass metadatas so BM25 can return them alongside scores
        self.bm25_retriever = BM25Retriever.from_texts(texts, metadatas=metadatas)

        print(f"Hybrid index built with {len(chunks)} chunks.")
        return self.vector_store

if __name__ == "__main__":
    print("Indexer module ready.")