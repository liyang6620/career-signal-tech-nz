from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CareerSignal Tech NZ API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://career_signal:career_signal@localhost:5432/career_signal"
    openai_api_key: str | None = None
    cors_origins: str = "http://localhost:5173"
    jwt_secret: str = "development-only-change-me-at-least-32-bytes"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    frontend_url: str = "http://localhost:5173"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str = "noreply@careersignal.local"
    smtp_use_tls: bool = True
    storage_endpoint: str = "http://localhost:9000"
    storage_public_endpoint: str = "http://localhost:9000"
    storage_region: str = "us-east-1"
    storage_bucket: str = "career-signal-private"
    storage_access_key: str = "career-signal"
    storage_secret_key: str = "development-storage-secret"
    clamav_host: str = "localhost"
    clamav_port: int = 3310
    upload_max_bytes: int = 10 * 1024 * 1024
    ingestion_api_key: str = "development-ingestion-key"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def validate_runtime(self) -> None:
        if self.environment == "production" and self.jwt_secret == "development-only-change-me-at-least-32-bytes":
            raise RuntimeError("JWT_SECRET must be explicitly configured in production")
        if self.environment == "production" and not self.smtp_host:
            raise RuntimeError("SMTP_HOST must be configured in production")
        if self.environment == "production" and self.storage_secret_key == "development-storage-secret":
            raise RuntimeError("STORAGE_SECRET_KEY must be explicitly configured in production")
        if self.environment == "production" and self.ingestion_api_key == "development-ingestion-key":
            raise RuntimeError("INGESTION_API_KEY must be explicitly configured in production")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_runtime()
    return settings
