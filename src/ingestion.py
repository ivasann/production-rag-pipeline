from pathlib import Path
from typing import List, Union

import fitz
from pydantic import BaseModel, Field

PathLike = Union[str, Path]


class DocumentChunk(BaseModel):
    """Typed data structure for parsed text blocks."""

    content: str = Field(description="The raw text content of the chunk.")
    page_number: int = Field(ge=1, description="The source page number.")
    source_file: str = Field(description="Name of the source document.")
    source_id: str = Field(description="Stable id for the source document.")


class LocalIngestionEngine:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        if chunk_size <= chunk_overlap:
            raise ValueError("chunk_size must be greater than chunk_overlap.")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def extract_pdf_to_chunks(self, file_path: PathLike) -> List[DocumentChunk]:
        path = Path(file_path)
        if path.suffix.lower() != ".pdf":
            raise ValueError("Only .pdf files are supported.")

        try:
            doc = fitz.open(path)
        except Exception as e:
            raise RuntimeError(f"Failed to open PDF: {e}") from e

        chunks: List[DocumentChunk] = []
        file_name = path.name
        source_id = path.stem
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
                            source_file=file_name,
                            source_id=source_id,
                        )
                    )
        doc.close()
        return chunks

    def ingest_pdfs(self, file_paths: List[PathLike]) -> List[DocumentChunk]:
        all_chunks: List[DocumentChunk] = []
        for file_path in file_paths:
            all_chunks.extend(self.extract_pdf_to_chunks(file_path))
        return all_chunks


if __name__ == "__main__":
    print("--- Testing LocalIngestionEngine ---")
    engine = LocalIngestionEngine(chunk_size=500, chunk_overlap=100)
    sample = Path(__file__).resolve().parent.parent / "data" / "infosys.pdf"
    try:
        test_chunks = engine.extract_pdf_to_chunks(sample)
        print(f"Successfully extracted {len(test_chunks)} chunks from {sample.name}.")
    except Exception as e:
        print(f"Test failed: {e}")
