"""
PurposeCanvas — Configuration
All env vars in one place. Import `settings` everywhere.
"""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Gemini (fallback)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"

    # Groq (PRIMARY LLM — Llama-3.3-70B, very fast & free)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "qwen/qwen3.8-27b"  # Available on free Groq tier

    # Supabase (vector cache)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # Ollama (local LLM + embeddings — no internet required)
    OLLAMA_MODEL: str = "qwen2.5:0.5b"           # for intent/classify fallback
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"  # for vector embeddings

    # LLM provider order: groq → gemini → ollama
    LLM_PROVIDER: str = "groq"  # "groq" | "gemini" | "ollama"

    # Cache
    CACHE_THRESHOLD: float = 0.88
    ENABLE_VECTOR_EMBED: int = 0  # set to 1 when nomic-embed-text is ready

    # Cost (honest: labelled "assumed cloud rate" in UI)
    COST_PER_GPU_SECOND: float = 0.0004

    # GPU fallback watts if pynvml unavailable
    GPU_WATTS_FALLBACK: float = 150.0

    # Diffusion steps for poster tier
    POSTER_STEPS: int = 25

    # Paths
    DB_PATH: str = "./backend/purposecanvas.db"
    CHROMA_PATH: str = "./backend/chroma_db"
    GENERATED_IMAGES_DIR: str = "./backend/generated_images"
    UPLOAD_DIR: str = "./backend/uploads"

    # Server
    BACKEND_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

# Ensure directories exist
for d in [
    settings.GENERATED_IMAGES_DIR,
    settings.UPLOAD_DIR,
    Path(settings.DB_PATH).parent,
]:
    Path(d).mkdir(parents=True, exist_ok=True)
