"""Minimal agentic RAG demo — clean sage & stone UI."""

import os
import sys
import tempfile
from pathlib import Path

import streamlit as st

SRC_ROOT = Path(__file__).resolve().parent
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
)
from indexer import HybridIndexer
from ingestion import LocalIngestionEngine
from llm import get_chat_llm
from retriever import PipelineRetriever
from ui_theme import THEME_CSS

st.set_page_config(
    page_title="DocQuery",
    page_icon="◆",
    layout="centered",
    initial_sidebar_state="collapsed",
)

st.markdown(THEME_CSS, unsafe_allow_html=True)


def init_session():
    for key, value in {
        "chunks": [],
        "source_files": [],
        "indexed": False,
        "agent": None,
        "messages": [],
    }.items():
        if key not in st.session_state:
            st.session_state[key] = value


def llm_status() -> tuple[bool, str]:
    if GOOGLE_API_KEY:
        try:
            get_chat_llm()
            return True, "Gemini ready"
        except Exception as exc:
            return False, str(exc)[:80]
    return False, "Add Google API key"


def ingest_files(file_paths: list[str], chunk_size: int, chunk_overlap: int, top_k: int):
    engine = LocalIngestionEngine(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks = engine.ingest_pdfs(file_paths)
    if not chunks:
        raise ValueError("No text could be extracted from the PDFs.")

    indexer = HybridIndexer()
    indexer.build_index(chunks)
    retriever = PipelineRetriever.from_indexer(indexer, top_k=top_k)

    st.session_state.chunks = chunks
    st.session_state.source_files = sorted({c.source_file for c in chunks})
    st.session_state.agent = AgenticRAGOrchestrator(retriever)
    st.session_state.indexed = True
    st.session_state.messages = []


def render_hero(step: int):
    st.markdown(
        f"""
        <div class="hero">
            <span class="hero-badge">Agentic RAG Demo</span>
            <h1>Ask your documents</h1>
            <p>Upload PDFs, build a hybrid index, and get cited answers in one flow.</p>
        </div>
        <div class="step">
            <span class="step-item {"active" if step == 1 else "done" if step > 1 else ""}">1 · Upload</span>
            <span class="step-line"></span>
            <span class="step-item {"active" if step == 2 else ""}">2 · Chat</span>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_status_pills(indexed: bool, doc_count: int, chunk_count: int, llm_ok: bool, llm_label: str):
    idx_cls = "pill" if indexed else "pill pill-muted"
    llm_cls = "pill" if llm_ok else "pill pill-warn"
    st.markdown(
        f"""
        <div class="status-row">
            <span class="{idx_cls}">{"Indexed" if indexed else "Not indexed"}</span>
            <span class="pill pill-muted">{doc_count} doc{"s" if doc_count != 1 else ""}</span>
            <span class="pill pill-muted">{chunk_count} chunks</span>
            <span class="{llm_cls}">{llm_label}</span>
        </div>
        """,
        unsafe_allow_html=True,
    )


init_session()
llm_ok, llm_label = llm_status()
step = 2 if st.session_state.indexed else 1

with st.sidebar:
    st.markdown("**Settings**")
    st.caption(f"Search mode: **{EMBED_MODE}** (bm25 = low RAM)")
    if not llm_ok:
        key = st.text_input("Google API key", type="password", placeholder="AIza...")
        if key:
            os.environ["GOOGLE_API_KEY"] = key
            import config as cfg

            cfg.GOOGLE_API_KEY = key
            st.rerun()

    with st.expander("Advanced", expanded=False):
        chunk_size = st.number_input("Chunk size", 200, 1500, DEFAULT_CHUNK_SIZE, 50)
        chunk_overlap = st.number_input("Overlap", 0, 400, DEFAULT_CHUNK_OVERLAP, 25)
        top_k = st.number_input("Results (top-k)", 1, 12, DEFAULT_TOP_K)

    if st.button("Reset demo", use_container_width=True):
        for key in list(st.session_state.keys()):
            del st.session_state[key]
        st.rerun()

render_hero(step)

# ── Step 1: Upload ─────────────────────────────────────────────
if not st.session_state.indexed:
    st.markdown('<div class="card"><div class="card-label">Documents</div>', unsafe_allow_html=True)

    uploaded = st.file_uploader(
        "Drop PDFs here",
        type=["pdf"],
        accept_multiple_files=True,
        label_visibility="collapsed",
    )

    sample_pdfs = sorted(DATA_DIR.glob("*.pdf")) if DATA_DIR.exists() else []
    use_sample = False
    if sample_pdfs and not uploaded:
        use_sample = st.checkbox(f"Use sample ({sample_pdfs[0].name})", value=False)

    col_a, col_b = st.columns(2)
    with col_a:
        build = st.button("Build index", type="primary", use_container_width=True)
    with col_b:
        pass

    render_status_pills(False, 0, 0, llm_ok, llm_label)
    st.markdown("</div>", unsafe_allow_html=True)

    if build:
        if not llm_ok:
            st.warning("Connect an LLM first (see sidebar).")
        else:
            paths: list[str] = []
            temp_paths: list[str] = []
            try:
                if use_sample and not uploaded:
                    paths = [str(p) for p in sample_pdfs[:3]]
                elif uploaded:
                    for f in uploaded:
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                            tmp.write(f.getvalue())
                            paths.append(tmp.name)
                            temp_paths.append(tmp.name)
                else:
                    st.info("Upload at least one PDF, or enable the sample.")
                    st.stop()

                with st.spinner("Indexing…"):
                    ingest_files(paths, chunk_size, chunk_overlap, top_k)
                st.rerun()
            except Exception as exc:
                st.error(str(exc))
            finally:
                for path in temp_paths:
                    try:
                        os.unlink(path)
                    except OSError:
                        pass

    st.stop()

# ── Step 2: Chat ───────────────────────────────────────────────
doc_n = len(st.session_state.source_files)
chunk_n = len(st.session_state.chunks)

st.markdown('<div class="card"><div class="card-label">Your library</div>', unsafe_allow_html=True)
names = ", ".join(st.session_state.source_files[:4])
if doc_n > 4:
    names += f" +{doc_n - 4} more"
st.caption(names or "—")
render_status_pills(True, doc_n, chunk_n, llm_ok, llm_label)
if st.button("Upload different files", use_container_width=True):
    st.session_state.indexed = False
    st.session_state.chunks = []
    st.session_state.source_files = []
    st.session_state.agent = None
    st.session_state.messages = []
    st.rerun()
st.markdown("</div>", unsafe_allow_html=True)

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if msg.get("sources"):
            chips = " ".join(
                f'<span class="source-chip">{s}</span>' for s in msg["sources"][:4]
            )
            st.markdown(chips, unsafe_allow_html=True)

prompt = st.chat_input("Ask anything about your PDFs…")

if prompt:
    if not llm_ok:
        st.warning("LLM not available. Check sidebar settings.")
    elif st.session_state.agent:
        st.session_state.messages.append({"role": "user", "content": prompt})

        with st.spinner("Thinking…"):
            try:
                result = st.session_state.agent.run(
                    prompt,
                    source_files=st.session_state.source_files,
                )
                source_labels = [
                    f"{d.metadata.get('source', '?')} p.{d.metadata.get('page', '?')}"
                    for d in result.documents[:4]
                ]
                st.session_state.messages.append(
                    {
                        "role": "assistant",
                        "content": result.answer,
                        "sources": source_labels,
                    }
                )
                st.rerun()
            except Exception as exc:
                st.session_state.messages.append(
                    {"role": "assistant", "content": f"Something went wrong: {exc}"}
                )
                st.rerun()

st.markdown(
    '<p style="text-align:center;color:#5F7168;font-size:0.75rem;margin-top:2rem;">'
    "BM25 search · Gemini · Agent plan & retry"
    "</p>",
    unsafe_allow_html=True,
)
