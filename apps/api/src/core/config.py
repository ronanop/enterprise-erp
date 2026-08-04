"""Environment-backed application settings."""

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env from apps/api regardless of uvicorn cwd
_API_ROOT = Path(__file__).resolve().parents[2]  # apps/api
_REPO_ROOT = _API_ROOT.parents[1]  # monorepo root
_ENV_FILES = (
    str(_API_ROOT / ".env"),
    str(_REPO_ROOT / ".env"),
    ".env",
)


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="Enterprise ERP API", alias="APP_NAME")
    app_version: str = Field(default="0.1.0", alias="APP_VERSION")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    debug: bool = Field(default=False, alias="DEBUG")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")

    database_url: str = Field(
        default="postgresql+psycopg://erp:erp_dev_password@localhost:5432/erp",
        alias="DATABASE_URL",
    )

    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    celery_broker_url: str = Field(
        default="amqp://erp:erp_dev_password@localhost:5672//",
        alias="CELERY_BROKER_URL",
    )
    celery_result_backend: str = Field(
        default="redis://localhost:6379/1",
        alias="CELERY_RESULT_BACKEND",
    )

    cors_origins: list[str] = Field(
        default=["http://localhost:3000"],
        alias="CORS_ORIGINS",
    )

    jwt_secret_key: str = Field(default="change-me-in-production", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    # Long-lived by default so local/demo sessions are not cut short mid-work.
    # Override via env for production hardening.
    jwt_access_token_expire_minutes: int = Field(
        default=10080, alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    jwt_refresh_token_expire_days: int = Field(default=30, alias="JWT_REFRESH_TOKEN_EXPIRE_DAYS")
    session_ttl_seconds: int = Field(default=604800, alias="SESSION_TTL_SECONDS")
    login_rate_limit: int = Field(default=0, alias="LOGIN_RATE_LIMIT")
    login_rate_window_seconds: int = Field(default=900, alias="LOGIN_RATE_WINDOW_SECONDS")
    account_lockout_threshold: int = Field(default=5, alias="ACCOUNT_LOCKOUT_THRESHOLD")
    account_lockout_minutes: int = Field(default=15, alias="ACCOUNT_LOCKOUT_MINUTES")

    # Microsoft Graph email (Notification Engine — email channel)
    azure_tenant_id: str = Field(default="", alias="AZURE_TENANT_ID")
    azure_client_id: str = Field(default="", alias="AZURE_CLIENT_ID")
    azure_client_secret: str = Field(default="", alias="AZURE_CLIENT_SECRET")
    azure_from_email: str = Field(default="", alias="AZURE_FROM_EMAIL")
    # sync = deliver in-request (local/dev); async = Celery only
    email_delivery_mode: str = Field(default="sync", alias="EMAIL_DELIVERY_MODE")

    # ElevenLabs Conversational AI (voice agent — server-side only)
    xi_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("XI_API_KEY", "ELEVENLABS_API_KEY"),
    )
    elevenlabs_agent_id: str = Field(default="", alias="ELEVENLABS_AGENT_ID")

    # MCP server (ElevenLabs agent tool discovery)
    mcp_server_base_url: str = Field(
        default="http://127.0.0.1:8000",
        alias="MCP_SERVER_BASE_URL",
    )
    mcp_auth_token: str = Field(default="", alias="MCP_AUTH_TOKEN")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_development(self) -> bool:
        return self.environment.lower() == "development"

    @property
    def graph_email_configured(self) -> bool:
        return bool(
            self.azure_tenant_id.strip()
            and self.azure_client_id.strip()
            and self.azure_client_secret.strip()
            and self.azure_from_email.strip()
        )

    def graph_credential_diagnostics(self) -> dict:
        """Safe diagnostics for UI (never returns secret values)."""
        checks = {
            "AZURE_TENANT_ID": bool(self.azure_tenant_id.strip()),
            "AZURE_CLIENT_ID": bool(self.azure_client_id.strip()),
            "AZURE_CLIENT_SECRET": bool(self.azure_client_secret.strip()),
            "AZURE_FROM_EMAIL": bool(self.azure_from_email.strip()),
        }
        missing = [name for name, ok in checks.items() if not ok]
        present = [name for name, ok in checks.items() if ok]
        env_paths = [p for p in _ENV_FILES if Path(p).is_file()]
        return {
            "configured": len(missing) == 0,
            "missing": missing,
            "present": present,
            "from_email": self.azure_from_email.strip() or None,
            "tenant_id_preview": (
                f"{self.azure_tenant_id.strip()[:8]}…"
                if len(self.azure_tenant_id.strip()) > 8
                else (self.azure_tenant_id.strip() or None)
            ),
            "client_id_preview": (
                f"{self.azure_client_id.strip()[:8]}…"
                if len(self.azure_client_id.strip()) > 8
                else (self.azure_client_id.strip() or None)
            ),
            "env_files_found": env_paths,
            "hint": (
                None
                if not missing
                else (
                    "Set the missing variables in apps/api/.env, then restart the API "
                    "(uvicorn --reload). Required: Mail.Send application permission + admin consent."
                )
            ),
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
