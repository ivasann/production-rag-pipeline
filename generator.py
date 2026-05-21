# generator.py

import os
from langchain_google_genai import ChatGoogleGenerativeAI


class RAGGenerator:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            temperature=0.2
        )

    def generate_answer(self, query: str, docs):

        # Build contextual chunks with metadata
        context_parts = []

        for doc in docs:
            page = doc.metadata.get("page", "Unknown")
            source = doc.metadata.get("source", "Unknown")

            context_parts.append(
                f"""
SOURCE: {source}
PAGE: {page}

CONTENT:
{doc.page_content}
"""
            )

        context = "\n\n".join(context_parts)

        # Prompt
        prompt = f"""
You are a helpful financial assistant.

Answer the user's question ONLY using the provided context.

IMPORTANT RULES:
1. Always include page citations.
2. Do not make up information.
3. If the answer is not present, say:
   "I could not find the answer in the document."

Example:
"The total revenue was ₹153,670 crore. (Page 18)"

Context:
{context}

Question:
{query}
"""

        response = self.llm.invoke(prompt)

        return response.content