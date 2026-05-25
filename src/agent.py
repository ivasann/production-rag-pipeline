import json
import re
from dataclasses import dataclass, field
from typing import List

from langchain_core.documents import Document

from config import MAX_AGENT_RETRIES
from generator import RAGGenerator
from llm import get_chat_llm
from retriever import PipelineRetriever


@dataclass
class AgentPlan:
    needs_retrieval: bool = True
    search_queries: List[str] = field(default_factory=list)
    reasoning: str = ""


@dataclass
class AgentResult:
    answer: str
    documents: List[Document]
    plan: AgentPlan
    retrieval_attempts: int
    graded_sufficient: bool


class AgenticRAGOrchestrator:
    """Plans retrieval, fuses multi-query results, grades context, and generates."""

    def __init__(self, retriever: PipelineRetriever, generator: RAGGenerator | None = None):
        self.retriever = retriever
        self.generator = generator or RAGGenerator()
        self.llm = get_chat_llm(temperature=0.1)

    def run(self, query: str, source_files: List[str] | None = None) -> AgentResult:
        plan = self._plan(query, source_files or [])
        if not plan.needs_retrieval:
            answer = self.generator.generate_answer(query, [])
            return AgentResult(
                answer=answer,
                documents=[],
                plan=plan,
                retrieval_attempts=0,
                graded_sufficient=True,
            )

        queries = plan.search_queries or [query]
        documents: List[Document] = []
        attempts = 0
        sufficient = False

        while attempts <= MAX_AGENT_RETRIES:
            attempts += 1
            documents = self.retriever.search_multi(queries, top_k_per_query=None)
            sufficient = self._grade_context(query, documents)
            if sufficient or attempts > MAX_AGENT_RETRIES:
                break
            queries = [self._rewrite_query(query, documents)]

        answer = self.generator.generate_answer(query, documents)
        return AgentResult(
            answer=answer,
            documents=documents,
            plan=plan,
            retrieval_attempts=attempts,
            graded_sufficient=sufficient,
        )

    def _plan(self, query: str, source_files: List[str]) -> AgentPlan:
        sources_hint = ", ".join(source_files) if source_files else "unknown"
        prompt = f"""You are a retrieval planner for a document Q&A system.
Return ONLY valid JSON with keys:
- needs_retrieval (boolean)
- search_queries (array of 1-3 strings, optimized for hybrid search)
- reasoning (short string)

User question: {query}
Indexed PDF sources: {sources_hint}

Rules:
- If the question is general chit-chat, set needs_retrieval false.
- For comparisons across documents, include separate queries per document theme.
- Expand acronyms and add synonyms where helpful.
"""
        raw = self.llm.invoke(prompt).content
        data = self._parse_json(raw)

        queries = data.get("search_queries") or [query]
        if isinstance(queries, str):
            queries = [queries]

        return AgentPlan(
            needs_retrieval=bool(data.get("needs_retrieval", True)),
            search_queries=[q.strip() for q in queries if q and q.strip()],
            reasoning=str(data.get("reasoning", "")),
        )

    def _grade_context(self, query: str, documents: List[Document]) -> bool:
        if not documents:
            return False

        preview = "\n\n".join(
            f"[{i + 1}] {doc.page_content[:400]}" for i, doc in enumerate(documents[:5])
        )
        prompt = f"""You judge whether retrieved excerpts are enough to answer the question.
Reply ONLY JSON: {{"sufficient": true/false, "reason": "..."}}

Question: {query}

Retrieved excerpts:
{preview}
"""
        raw = self.llm.invoke(prompt).content
        data = self._parse_json(raw)
        return bool(data.get("sufficient", False))

    def _rewrite_query(self, query: str, documents: List[Document]) -> str:
        preview = "\n\n".join(doc.page_content[:200] for doc in documents[:3])
        prompt = f"""The first retrieval pass was insufficient. Write ONE improved search query.
Return ONLY the query text, no quotes.

Original question: {query}
Partial context:
{preview}
"""
        rewritten = self.llm.invoke(prompt).content.strip()
        return rewritten or query

    @staticmethod
    def _parse_json(text: str) -> dict:
        text = text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
        return {}
