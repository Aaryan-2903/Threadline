from typing import List, Optional, Set
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Threadline API"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "sqlite:///./threadline.db"

    # CORS Configuration
    FRONTEND_URL: Optional[str] = "http://localhost:5173"
    FRONTEND_URLS: Optional[str] = None  # Comma-separated allowed origins for production / preview
    CORS_ALLOW_CREDENTIALS: bool = True

    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB

    # DOCX ZIP Safety / Bomb Protection Limits
    MAX_DOCX_ENTRIES: int = 1000
    MAX_DOCX_TOTAL_UNCOMPRESSED_BYTES: int = 50 * 1024 * 1024  # 50 MB
    MAX_DOCX_SINGLE_FILE_BYTES: int = 20 * 1024 * 1024  # 20 MB
    MAX_DOCX_COMPRESSION_RATIO: float = 100.0  # 100:1 ratio

    # Rate Limiting Configuration
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_GENERAL: int = 120  # 120 requests per minute for standard API endpoints
    RATE_LIMIT_GENERAL_WINDOW: int = 60  # seconds
    RATE_LIMIT_EXPENSIVE: int = 15  # 15 requests per minute for expensive AI/doc operations
    RATE_LIMIT_EXPENSIVE_WINDOW: int = 60  # seconds
    TRUSTED_PROXIES: str = ""  # Comma-separated list of trusted proxy IPs, e.g. "127.0.0.1,10.0.0.1"
    REDIS_URL: Optional[str] = None  # Optional Redis URL for distributed rate limiting in production

    @property
    def allowed_cors_origins(self) -> List[str]:
        """
        Parses, normalizes, and validates allowed CORS origins from FRONTEND_URLS and FRONTEND_URL.
        - Trims whitespace and trailing slashes.
        - Forbids wildcard '*' in production environments.
        - Forbids wildcard '*' when credentials are enabled.
        - Rejects insecure schemes (origin must start with http:// or https://).
        - Includes standard local dev origins (http://localhost:5173, http://127.0.0.1:5173) in development
          when no explicit FRONTEND_URLS is set.
        - Preserves explicit Vercel preview domains if supplied; does not trust wildcard *.vercel.app.
        """
        candidates: List[str] = []

        if self.FRONTEND_URLS and self.FRONTEND_URLS.strip():
            for item in self.FRONTEND_URLS.split(","):
                cand = item.strip()
                if cand:
                    candidates.append(cand)
        elif self.FRONTEND_URL and self.FRONTEND_URL.strip():
            candidates.append(self.FRONTEND_URL.strip())

        is_dev = self.ENVIRONMENT.lower() in ("development", "dev", "test", "local")
        is_prod = self.ENVIRONMENT.lower() in ("production", "prod")

        # In local development, if only default localhost was specified or no origins provided,
        # also include 127.0.0.1:5173 and localhost:3000 for convenience
        if is_dev:
            if not candidates or candidates == ["http://localhost:5173"]:
                candidates = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]

        normalized: List[str] = []
        for origin in candidates:
            clean = origin.strip().rstrip("/")
            if not clean:
                continue

            if clean == "*":
                if is_prod:
                    raise ValueError("CORS wildcard origin '*' is strictly prohibited in production.")
                if self.CORS_ALLOW_CREDENTIALS:
                    raise ValueError("CORS wildcard origin '*' cannot be combined with allow_credentials=True.")
                normalized.append("*")
                continue

            if not (clean.startswith("http://") or clean.startswith("https://")):
                raise ValueError(
                    f"Invalid CORS origin '{clean}': origin must include http:// or https:// scheme."
                )

            if clean not in normalized:
                normalized.append(clean)

        return normalized

    @property
    def cors_allow_credentials(self) -> bool:
        """
        Credentials must not be combined with wildcard origins per the CORS specification.
        """
        if "*" in self.allowed_cors_origins:
            return False
        return self.CORS_ALLOW_CREDENTIALS

    @property
    def trusted_proxies_set(self) -> Set[str]:
        if not self.TRUSTED_PROXIES:
            return set()
        return {ip.strip() for ip in self.TRUSTED_PROXIES.split(",") if ip.strip()}

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

