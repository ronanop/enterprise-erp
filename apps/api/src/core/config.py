"""Environment-backed application settings."""

from functools import lru_cache
from typing import Annotated

from pydantic import BeforeValidator, Field
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _parse_cors_origins(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(origin).strip() for origin in value if str(origin).strip()]
    if value is None:
        return []
    raw = str(value).strip()
    if not raw:
        return []
    if raw.startswith("["):
        import json

        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(origin).strip() for origin in parsed if str(origin).strip()]
        except json.JSONDecodeError:
            pass
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
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

    cors_origins: Annotated[list[str], NoDecode, BeforeValidator(_parse_cors_origins)] = Field(
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

    # Microsoft Entra ID (SSO / org sync)
    microsoft_tenant_id: str = Field(default="", alias="MICROSOFT_TENANT_ID")
    microsoft_client_id: str = Field(default="", alias="MICROSOFT_CLIENT_ID")
    microsoft_client_secret: str = Field(default="", alias="MICROSOFT_CLIENT_SECRET")
    microsoft_redirect_uri: str = Field(
        default="http://localhost:8000/api/v1/auth/microsoft/callback",
        alias="MICROSOFT_REDIRECT_URI",
    )
    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")
    microsoft_user_email_domain: str = Field(default="", alias="MICROSOFT_USER_EMAIL_DOMAIN")
    microsoft_platform_admin_emails: str = Field(default="", alias="MICROSOFT_PLATFORM_ADMIN_EMAILS")

    # Microsoft Graph mail (can reuse Entra app; AZURE_* aliases kept for older deploys)
    azure_tenant_id: str = Field(default="", alias="AZURE_TENANT_ID")
    azure_client_id: str = Field(default="", alias="AZURE_CLIENT_ID")
    azure_client_secret: str = Field(default="", alias="AZURE_CLIENT_SECRET")
    azure_from_email: str = Field(default="", alias="AZURE_FROM_EMAIL")
    email_delivery_mode: str = Field(default="sync", alias="EMAIL_DELIVERY_MODE")
    # Mailbox whose inbox is polled for email→ticket (defaults to AZURE_FROM_EMAIL)
    graph_mailbox_email: str = Field(default="", alias="GRAPH_MAILBOX_EMAIL")
    graph_mail_poll_enabled: bool = Field(default=True, alias="GRAPH_MAIL_POLL_ENABLED")

    # Email → Service Request Ticket automation
    email_ticket_enabled: bool = Field(default=False, alias="EMAIL_TICKET_ENABLED")
    email_inbound_webhook_secret: str = Field(default="", alias="EMAIL_INBOUND_WEBHOOK_SECRET")
    email_ticket_default_branch_id: str | None = Field(default=None, alias="EMAIL_TICKET_DEFAULT_BRANCH_ID")
    email_ticket_default_category_id: str | None = Field(default=None, alias="EMAIL_TICKET_DEFAULT_CATEGORY_ID")
    email_ticket_default_customer_id: str | None = Field(default=None, alias="EMAIL_TICKET_DEFAULT_CUSTOMER_ID")
    # Comma-separated subject substrings that mark an inbox mail as a ticket candidate (optional).
    email_ticket_subject_patterns: str = Field(default="", alias="EMAIL_TICKET_SUBJECT_PATTERNS")
    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_from_address: str = Field(default="", alias="SMTP_FROM_ADDRESS")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")
    imap_enabled: bool = Field(default=False, alias="IMAP_ENABLED")
    imap_host: str = Field(default="", alias="IMAP_HOST")
    imap_port: int = Field(default=993, alias="IMAP_PORT")
    imap_user: str = Field(default="", alias="IMAP_USER")
    imap_password: str = Field(default="", alias="IMAP_PASSWORD")
    imap_mailbox: str = Field(default="INBOX", alias="IMAP_MAILBOX")
    imap_poll_interval_seconds: int = Field(default=120, alias="IMAP_POLL_INTERVAL_SECONDS")

    # Service multi-channel notifications (SMS / WhatsApp gateways — optional)
    sms_gateway_enabled: bool = Field(default=False, alias="SMS_GATEWAY_ENABLED")
    sms_gateway_url: str = Field(default="", alias="SMS_GATEWAY_URL")
    sms_gateway_api_key: str = Field(default="", alias="SMS_GATEWAY_API_KEY")
    whatsapp_gateway_enabled: bool = Field(default=False, alias="WHATSAPP_GATEWAY_ENABLED")
    whatsapp_gateway_url: str = Field(default="", alias="WHATSAPP_GATEWAY_URL")
    whatsapp_gateway_api_key: str = Field(default="", alias="WHATSAPP_GATEWAY_API_KEY")
    service_followup_hours: int = Field(default=24, alias="SERVICE_FOLLOWUP_HOURS")

    def resolved_graph_tenant_id(self) -> str:
        return (self.azure_tenant_id or self.microsoft_tenant_id or "").strip()

    def resolved_graph_client_id(self) -> str:
        return (self.azure_client_id or self.microsoft_client_id or "").strip()

    def resolved_graph_client_secret(self) -> str:
        return (self.azure_client_secret or self.microsoft_client_secret or "").strip()

    def resolved_graph_mailbox(self) -> str:
        return (self.graph_mailbox_email or self.azure_from_email or self.imap_user or "").strip()

    @property
    def graph_mail_configured(self) -> bool:
        return bool(
            self.email_ticket_enabled
            and self.graph_mail_poll_enabled
            and self.resolved_graph_tenant_id()
            and self.resolved_graph_client_id()
            and self.resolved_graph_client_secret()
            and self.resolved_graph_mailbox()
        )

    def graph_credential_diagnostics(self) -> dict:
        present: list[str] = []
        missing: list[str] = []
        checks = {
            "tenant_id": self.resolved_graph_tenant_id(),
            "client_id": self.resolved_graph_client_id(),
            "client_secret": self.resolved_graph_client_secret(),
            "mailbox": self.resolved_graph_mailbox(),
        }
        for key, value in checks.items():
            (present if value else missing).append(key)
        return {
            "present": present,
            "missing": missing,
            "env_files_found": [".env", "apps/api/.env"],
            "hint": "Set MICROSOFT_* or AZURE_* plus GRAPH_MAILBOX_EMAIL / AZURE_FROM_EMAIL",
        }

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_from_address)

    @property
    def imap_configured(self) -> bool:
        return bool(self.imap_enabled and self.imap_host and self.imap_user and self.imap_password)

    @property
    def is_development(self) -> bool:
        return self.environment.lower() == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
