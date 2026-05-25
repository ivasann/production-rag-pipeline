"""REST API wrapper for the DocQuery RAG pipeline."""

import os
import sys
import tempfile
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

SRC_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = SRC_ROOT.parent
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from agent import AgenticRAGOrchestrator
from config import (
    DATA_DIR,
    DEFAULT_CHUNK_OVERLAP,
    DEFAULT_CHUNK_SIZE,
    DEFAULT_TOP_K,
    EMBED_MODE,
    GOOGLE_API_KEY,
    GOOGLE_MODEL,
)
from indexer import HybridIndexer
from ingestion import LocalIngestionEngine
from llm import get_chat_llm
from retriever import PipelineRetriever


app = FastAPI(title="DocQuery API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    question: str


class RAGState:
    def __init__(self) -> None:
        self.indexed = False
        self.chunks = []
        self.source_files: list[str] = []
        self.retriever: PipelineRetriever | None = None
        self.agent: AgenticRAGOrchestrator | None = None
        self.top_k = DEFAULT_TOP_K


STATE = RAGState()
STATE_LOCK = Lock()


def _sample_pdf_paths() -> list[Path]:
    candidates = [
        DATA_DIR,
        PROJECT_ROOT / "data",
        SRC_ROOT / "data",
    ]
    seen: set[Path] = set()
    paths: list[Path] = []
    for directory in candidates:
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.pdf")):
            resolved = path.resolve()
            if resolved not in seen:
                seen.add(resolved)
                paths.append(path)
    return paths


def _llm_status() -> tuple[bool, str]:
    if not GOOGLE_API_KEY:
        return False, "GOOGLE_API_KEY is not set"
    try:
        get_chat_llm()
    except Exception as exc:
        return False, str(exc)
    return True, f"{GOOGLE_MODEL} ready"


def _source_labels_from_documents(documents) -> list[dict[str, Any]]:
    labels = []
    seen = set()
    for doc in documents:
        source = doc.metadata.get("source", "Unknown")
        page = doc.metadata.get("page", "Unknown")
        key = (source, page)
        if key in seen:
            continue
        seen.add(key)
        labels.append({"source": source, "page": page})
    return labels[:8]


def _source_labels(result) -> list[dict[str, Any]]:
    return _source_labels_from_documents(result.documents)


def _retrieval_only_answer(question: str, documents, error: Exception) -> str:
    if not documents:
        return (
            "Governing thought\n"
            "The backend is connected, but no relevant context was retrieved and the LLM could not generate an answer.\n\n"
            "Key lines\n"
            f"- Question: {question}\n"
            "- Index status: available\n"
            f"- Generation error: {str(error)[:240]}\n\n"
            "Evidence\n"
            "- No source excerpt returned."
        )

    lines = []
    for doc in documents[:4]:
        source = doc.metadata.get("source", "Unknown")
        page = doc.metadata.get("page", "Unknown")
        excerpt = " ".join(doc.page_content.split())[:260]
        lines.append(f"- {source} p.{page}: {excerpt}")

    return (
        "Governing thought\n"
        "The backend retrieved relevant document evidence, but Gemini could not generate the final synthesis.\n\n"
        "Key lines\n"
        + "\n".join(lines)
        + "\n\nEvidence\n"
        "Use the cited pages above. Generation error: "
        + str(error)[:240]
    )


def _build_index(
    paths: list[str],
    chunk_size: int,
    chunk_overlap: int,
    top_k: int,
) -> dict[str, Any]:
    if not paths:
        raise ValueError("No PDFs were provided.")

    engine = LocalIngestionEngine(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks = engine.ingest_pdfs(paths)
    if not chunks:
        raise ValueError("No text could be extracted from the PDFs.")

    indexer = HybridIndexer()
    indexer.build_index(chunks)
    retriever = PipelineRetriever.from_indexer(indexer, top_k=top_k)
    agent = AgenticRAGOrchestrator(retriever)
    source_files = sorted({chunk.source_file for chunk in chunks})

    with STATE_LOCK:
        STATE.indexed = True
        STATE.chunks = chunks
        STATE.source_files = source_files
        STATE.retriever = retriever
        STATE.agent = agent
        STATE.top_k = top_k

    return {
        "indexed": True,
        "doc_count": len(source_files),
        "chunk_count": len(chunks),
        "source_files": source_files,
        "embed_mode": EMBED_MODE,
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    llm_ready, llm_message = _llm_status()
    with STATE_LOCK:
        return {
            "ok": True,
            "indexed": STATE.indexed,
            "doc_count": len(STATE.source_files),
            "chunk_count": len(STATE.chunks),
            "source_files": STATE.source_files,
            "embed_mode": EMBED_MODE,
            "llm_ready": llm_ready,
            "llm_message": llm_message,
        }


@app.post("/api/index")
async def index_documents(
    files: list[UploadFile] | None = File(default=None),
    use_sample: bool = Form(default=True),
    chunk_size: int = Form(default=DEFAULT_CHUNK_SIZE),
    chunk_overlap: int = Form(default=DEFAULT_CHUNK_OVERLAP),
    top_k: int = Form(default=DEFAULT_TOP_K),
) -> dict[str, Any]:
    if chunk_size <= chunk_overlap:
        raise HTTPException(status_code=400, detail="chunk_size must be greater than chunk_overlap.")

    llm_ready, llm_message = _llm_status()
    if not llm_ready:
        raise HTTPException(status_code=503, detail=llm_message)

    temp_paths: list[str] = []
    paths: list[str] = []
    try:
        upload_files = [file for file in files or [] if file.filename]
        if upload_files:
            for upload in upload_files:
                if not upload.filename.lower().endswith(".pdf"):
                    raise HTTPException(status_code=400, detail=f"{upload.filename} is not a PDF.")
                content = await upload.read()
                if not content:
                    raise HTTPException(status_code=400, detail=f"{upload.filename} is empty.")
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                    tmp.write(content)
                    temp_paths.append(tmp.name)
                    paths.append(tmp.name)
        elif use_sample:
            sample_paths = _sample_pdf_paths()
            if not sample_paths:
                raise HTTPException(status_code=404, detail="No sample PDFs found.")
            paths = [str(path) for path in sample_paths[:3]]
        else:
            raise HTTPException(status_code=400, detail="Upload PDFs or enable the sample report.")

        return _build_index(paths, chunk_size, chunk_overlap, top_k)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        for path in temp_paths:
            try:
                os.unlink(path)
            except OSError:
                pass


@app.post("/api/ask")
def ask(request: AskRequest) -> dict[str, Any]:
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    with STATE_LOCK:
        agent = STATE.agent
        retriever = STATE.retriever
        source_files = list(STATE.source_files)
        indexed = STATE.indexed

    if not indexed or agent is None:
        raise HTTPException(status_code=409, detail="Build an index before asking questions.")

    try:
        result = agent.run(question, source_files=source_files)
    except Exception as exc:
        documents = retriever.search(question) if retriever is not None else []
        return {
            "answer": _retrieval_only_answer(question, documents, exc),
            "sources": _source_labels_from_documents(documents),
            "plan": {
                "needs_retrieval": True,
                "search_queries": [question],
                "reasoning": "Fallback retrieval because LLM generation failed.",
            },
            "retrieval_attempts": 1 if documents else 0,
            "graded_sufficient": False,
            "generation_error": str(exc),
        }

    return {
        "answer": result.answer,
        "sources": _source_labels(result),
        "plan": {
            "needs_retrieval": result.plan.needs_retrieval,
            "search_queries": result.plan.search_queries,
            "reasoning": result.plan.reasoning,
        },
        "retrieval_attempts": result.retrieval_attempts,
        "graded_sufficient": result.graded_sufficient,
    }


@app.post("/api/reset")
def reset() -> dict[str, bool]:
    with STATE_LOCK:
        STATE.indexed = False
        STATE.chunks = []
        STATE.source_files = []
        STATE.retriever = None
        STATE.agent = None
        STATE.top_k = DEFAULT_TOP_K
    return {"ok": True}
