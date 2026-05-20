# retriever.py
from typing import List
from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document

class EnsembleRetriever(BaseRetriever):
    """Lightweight hybrid retriever using only langchain-core."""
    def __init__(self, retrievers: List[BaseRetriever], weights: List[float] = None):
        self.retrievers = retrievers
        self.weights = weights or [1.0] * len(retrievers)

    def _get_relevant_documents(self, query: str) -> List[Document]:
        all_docs = []
        for r, w in zip(self.retrievers, self.weights):
            docs = r.invoke(query)
            # Score documents by weight if needed, here we just merge
            all_docs.extend(docs)

        # Deduplicate by content
        seen = set()
        unique_docs = []
        for doc in all_docs:
            if doc.page_content not in seen:
                seen.add(doc.page_content)
                unique_docs.append(doc)

        return unique_docs

class PipelineRetriever:
    def __init__(self, vector_store, bm25_retriever):
        self.retriever = EnsembleRetriever(
            retrievers=[vector_store.as_retriever(), bm25_retriever],
            weights=[0.7, 0.3]
        )

    def search(self, query: str) -> List[Document]:
        return self.retriever.invoke(query)