from langchain_google_genai import ChatGoogleGenerativeAI

from config import GOOGLE_API_KEY, GOOGLE_MODEL


def get_chat_llm(temperature: float = 0.2) -> ChatGoogleGenerativeAI:
    if not GOOGLE_API_KEY:
        raise ValueError(
            "GOOGLE_API_KEY is not set. Add it to .env at the project root or in the app sidebar."
        )
    return ChatGoogleGenerativeAI(
        model=GOOGLE_MODEL,
        temperature=temperature,
        google_api_key=GOOGLE_API_KEY,
    )
