from langchain_core.documents import Document

from llm import get_chat_llm


class RAGGenerator:
    def __init__(self):
        self.llm = get_chat_llm(temperature=0.2)

    def generate_answer(self, query: str, docs: list[Document]) -> str:
        if not docs:
            prompt = f"""You are a helpful assistant.
The user asked a question but no document context was retrieved.
If you cannot answer from general knowledge safely, say you need a relevant document uploaded.

Question: {query}
"""
            return self.llm.invoke(prompt).content

        context_parts = []
        for doc in docs:
            page = doc.metadata.get("page", "Unknown")
            source = doc.metadata.get("source", "Unknown")
            source_id = doc.metadata.get("source_id", source)
            context_parts.append(
                f"SOURCE: {source} (id={source_id})\nPAGE: {page}\nCONTENT:\n{doc.page_content}"
            )

        context = "\n\n---\n\n".join(context_parts)
        prompt = f"""You are a precise document assistant.

Answer ONLY using the provided context.
Rules:
1. Use a Barbara Minto inspired Pyramid Principle structure.
2. Start with a short "Governing thought" that answers the question directly.
3. Follow with 2-4 "Key lines" that support the answer.
4. End with "Evidence" using source file names and page numbers.
5. If multiple PDFs are in context, say which source each fact came from.
6. Do not invent facts.
7. If the answer is not in the context, say: "I could not find the answer in the uploaded documents."

Context:
{context}

Question:
{query}
"""
        return self.llm.invoke(prompt).content
