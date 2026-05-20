import os
from dotenv import load_dotenv
from ingestion import LocalIngestionEngine
from indexer import HybridIndexer
from retriever import PipelineRetriever

# CRITICAL: override=True ensures we use your actual .env file
load_dotenv(override=True)

def run_pipeline():
    print("--- Starting RAG Pipeline ---")

    # 1. Verification
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_API_KEY not found in .env file.")  # 🔹 Fixed typo
        return
    print(f"DEBUG: API Key loaded (starts with: {api_key[:8]}...)")

    pdf_path = "data/infosys.pdf"
    if not os.path.exists(pdf_path):
        print(f"ERROR: File not found at {pdf_path}.")
        return

    # 2. Ingestion
    print("Step 1: Extracting chunks from PDF...")
    ingestor = LocalIngestionEngine()
    chunks = ingestor.extract_pdf_to_chunks(pdf_path)
    print(f"DEBUG: Successfully created {len(chunks)} chunks.")

    if not chunks:
        print("ERROR: No text extracted. Check if the PDF is readable.")
        return

    # 3. Indexing
    print("Step 2: Building Hybrid Index...")
    indexer = HybridIndexer()
    vector_store = indexer.build_index(chunks)

    # 4. Retrieval Setup
    print("Step 3: Initializing Retriever...")
    # 🔹 Explicitly set k to avoid unpredictable default behavior
    vector_retriever = vector_store.as_retriever(search_kwargs={"k": 5})
    indexer.bm25_retriever.k = 5
    retriever = PipelineRetriever(vector_retriever, indexer.bm25_retriever)

    # 5. Search
    query = "What is the total revenue?"
    print(f"Step 4: Running search for: '{query}'")

    try:
        results = retriever.search(query)
    except Exception as e:
        print(f"❌ Retrieval failed: {e}")
        return

    # 6. Results
    if not results:
        print("No results found for your query.")
    else:
        print(f"\n--- Found {len(results)} Relevant Results ---")
        for i, res in enumerate(results):
            page = res.metadata.get('page', 'Unknown')
            print(f"\n[Result {i+1}] (Page {page})")
            print(f"Content: {res.page_content[:200]}...")

    print("\n--- Pipeline Finished Successfully ---")

if __name__ == "__main__":
    run_pipeline()