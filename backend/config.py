"""
AstraX EB1 Control Tower – Application Configuration
=====================================================
Centralised settings loaded from environment / .env file via pydantic-settings.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide configuration sourced from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/astrax_eb1"
    )

    # ── JWT / Auth ────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "astrax-eb1-super-secret-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480


settings = Settings()
