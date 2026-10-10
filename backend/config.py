"""
PurposeCanvas — Configuration
All env vars in one place. Import `settings` everywhere.
"""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Cache
    CACHE_THRESHOLD: float = 0.88

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
