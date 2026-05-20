import fitz
from typing import List
from pydantic import BaseModel, Field, ValidationError

class DocumentChunk(BaseModel):
    """Typed data structure for parsed text blocks."""
    content: str = Field(description="The raw text content of the chunk.")
    page_number: int = Field(ge=1, description="The source page number.")
    source_file: str = Field(description="Name of the source document.")

class LocalIngestionEngine:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        if chunk_size <= chunk_overlap:
            raise ValueError("chunk_size must be greater than chunk_overlap.")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def extract_pdf_to_chunks(self, file_path: str) -> List[DocumentChunk]:
        if not file_path.endswith(".pdf"):
            raise ValueError("Only .pdf files are supported.")

        try:
            doc = fitz.open(file_path)
        except Exception as e:
            raise RuntimeError(f"Failed to open PDF: {e}")

        chunks = []
        file_name = file_path.split("/")[-1]
        step = self.chunk_size - self.chunk_overlap

        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text")
            words = text.split()

            for i in range(0, len(words), step):
                chunk_words = words[i : i + self.chunk_size]
                chunk_text = " ".join(chunk_words).strip()

                if chunk_text:
                    chunks.append(
                        DocumentChunk(
                            content=chunk_text,
                            page_number=page_num,
                            source_file=file_name
                        )
                    )
        doc.close()
        return chunks

if __name__ == "__main__":
    print("--- Testing LocalIngestionEngine ---")
    engine = LocalIngestionEngine(chunk_size=500, chunk_overlap=100)
    try:
        test_chunks = engine.extract_pdf_to_chunks("data/infosys.pdf")
        print(f"✅ Successfully extracted {len(test_chunks)} chunks.")
        if test_chunks:
            print(f"📄 First chunk (Page {test_chunks[0].page_number}): {test_chunks[0].content[:100]}...")
    except Exception as e:
        print(f"❌ Test failed: {e}")