# Production RAG Pipeline

A professional, modular framework for Retrieval-Augmented Generation, optimized for high-accuracy document analysis.

## 🚀 Overview
Combines **semantic vector search** and **BM25 keyword matching** to deliver precise, context-aware insights from your technical PDF documentation.

## 🛠 Core Stack
* **Orchestration:** LangChain
* **Embeddings & LLM:** OpenAI (GPT-4o)
* **Vector Store:** Qdrant (In-Memory)
* **Parsing:** PyMuPDF

## ⚙️ Quick Start
1. **Setup Environment:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install langchain-openai langchain-community qdrant-client pymupdf
