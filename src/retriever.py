from collections import defaultdict
from typing import Dict, List, Optional, Union

from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever

from config import BM25_WEIGHT, VECTOR_WEIGHT


def reciprocal_rank_fusion(
    ranked_lists: List[List[Document]],
    weights: Optional[List[float]] = None,
    k: int = 60,
) -> List[Document]:
    if not ranked_lists:
        return []

    if weights is None:
        weights = [1.0] * len(ranked_lists)

    scores: Dict[str, float] = defaultdict(float)
    doc_map: Dict[str, Document] = {}

    for docs, weight in zip(ranked_lists, weights):
        for rank, doc in enumerate(docs, start=1):
            key = doc.page_content
            scores[key] += weight * (1.0 / (k + rank))
            doc_map[key] = doc

    ordered_keys = sorted(scores.keys(), key=lambda key: scores[key], reverse=True)
    return [doc_map[key] for key in ordered_keys]


class EnsembleRetriever(BaseRetriever):
    retrievers: List[BaseRetriever]
    weights: List[float]
    top_k: int = 5

    def _get_relevant_documents(self, query: str) -> List[Document]:
        ranked_lists = [r.invoke(query) for r in self.retrievers]
        fused = reciprocal_rank_fusion(ranked_lists, weights=self.weights)
        return fused[: self.top_k]


class PipelineRetriever:
    def __init__(
        self,
        bm25_retriever,
        vector_retriever=None,
        vector_weight: float = VECTOR_WEIGHT,
        bm25_weight: float = BM25_WEIGHT,
        top_k: int = 5,
    ):
        self.top_k = top_k
        self._bm25 = bm25_retriever
        self._bm25.k = top_k

        if vector_retriever is None:
            self._hybrid: Union[EnsembleRetriever, None] = None
        else:
            self._hybrid = EnsembleRetriever(
                retrievers=[vector_retriever, bm25_retriever],
                weights=[vector_weight, bm25_weight],
                top_k=top_k,
            )

    @classmethod
    def from_indexer(cls, indexer, top_k: int = 5) -> "PipelineRetriever":
        vector_retriever = None
        if indexer.vector_store is not None:
            vector_retriever = indexer.vector_store.as_retriever(search_kwargs={"k": top_k})
        return cls(indexer.bm25_retriever, vector_retriever=vector_retriever, top_k=top_k)

    def search(self, query: str) -> List[Document]:
        if self._hybrid is None:
            return self._bm25.invoke(query)[: self.top_k]
        return self._hybrid.invoke(query)

    def search_multi(
        self,
        queries: List[str],
        top_k_per_query: Optional[int] = None,
    ) -> List[Document]:
        if not queries:
            return []

        per_query_k = top_k_per_query or self.top_k
        if self._hybrid is not None:
            original_top_k = self._hybrid.top_k
            self._hybrid.top_k = per_query_k
            try:
                ranked_lists = [self.search(q) for q in queries]
            finally:
                self._hybrid.top_k = original_top_k
        else:
            old_k = self._bm25.k
            self._bm25.k = per_query_k
            try:
                ranked_lists = [self.search(q) for q in queries]
            finally:
                self._bm25.k = old_k

        return reciprocal_rank_fusion(ranked_lists)[: self.top_k]
