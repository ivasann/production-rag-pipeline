from agent import AgenticRAGOrchestrator
from config import DATA_DIR, DEFAULT_TOP_K
from indexer import HybridIndexer
from ingestion import LocalIngestionEngine
from retriever import PipelineRetriever


def run_pipeline():
    print("--- Agentic multi-PDF RAG pipeline ---")

    pdf_dir = DATA_DIR
    pdf_paths = sorted(pdf_dir.glob("*.pdf")) if pdf_dir.exists() else []
    if not pdf_paths:
        print(f"No PDFs found in {pdf_dir}. Add files and retry.")
        return

    print(f"Found {len(pdf_paths)} PDF(s): {[p.name for p in pdf_paths]}")

    ingestor = LocalIngestionEngine()
    chunks = ingestor.ingest_pdfs(pdf_paths)
    print(f"Extracted {len(chunks)} chunks.")

    indexer = HybridIndexer()
    indexer.build_index(chunks)
    retriever = PipelineRetriever.from_indexer(indexer, top_k=DEFAULT_TOP_K)

    agent = AgenticRAGOrchestrator(retriever)
    query = "What is the total revenue?"
    print(f"Query: {query}")

    result = agent.run(query, source_files=[p.name for p in pdf_paths])
    print("\nPlan:", result.plan.search_queries)
    print("Attempts:", result.retrieval_attempts)
    print("Sufficient:", result.graded_sufficient)
    print("\nAnswer:\n", result.answer)

    if result.documents:
        print(f"\nTop source: {result.documents[0].metadata.get('source')}")


if __name__ == "__main__":
    run_pipeline()
