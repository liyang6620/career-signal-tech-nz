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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def validate_runtime(self) -> None:
        if self.environment == "production" and self.jwt_secret == "development-only-change-me-at-least-32-bytes":
            raise RuntimeError("JWT_SECRET must be explicitly configured in production")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_runtime()
    return settings
