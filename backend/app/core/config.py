from typing import Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Threadline API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "sqlite:///./threadline.db"
    FRONTEND_URL: str = "http://localhost:5173"
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str]) -> str:
        if not v or not v.strip():
            return "sqlite:///./threadline.db"
        val = v.strip()
        # Normalise PostgreSQL driver for psycopg 3
        if val.startswith("postgresql://"):
            return val.replace("postgresql://", "postgresql+psycopg://", 1)
        if val.startswith("postgres://"):
            return val.replace("postgres://", "postgresql+psycopg://", 1)
        return val


settings = Settings()

