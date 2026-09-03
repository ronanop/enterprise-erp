"""Environment-backed application settings."""

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env from apps/api regardless of uvicorn cwd (local: apps/api; Docker: /app)
_API_ROOT = Path(__file__).resolve().parents[2]
try:
    _REPO_ROOT = _API_ROOT.parents[1]
except IndexError:
    _REPO_ROOT = _API_ROOT
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
        default="postgresql+psycopg://erp-postgres:erp-postgres@172.16.200.26:5432/erp",
        alias="DATABASE_URL",
    )
    # Local Docker fallbacks (used when VM primary is unreachable)
    infra_fallback_enabled: bool = Field(default=True, alias="INFRA_FALLBACK_ENABLED")
    database_url_fallback: str = Field(
        default="postgresql+psycopg://erp:erp_dev_password@localhost:5433/erp",
        alias="DATABASE_URL_FALLBACK",
    )

    redis_url: str = Field(default="redis://172.16.200.26:6379/0", alias="REDIS_URL")
    redis_url_fallback: str = Field(
        default="redis://localhost:6379/0",
        alias="REDIS_URL_FALLBACK",
    )
    celery_broker_url: str = Field(
        default="amqp://erp:erp_dev_password@172.16.200.26:5672//",
        alias="CELERY_BROKER_URL",
    )
    celery_broker_url_fallback: str = Field(
        default="amqp://erp:erp_dev_password@localhost:5672//",
        alias="CELERY_BROKER_URL_FALLBACK",
    )
    celery_result_backend: str = Field(
        default="redis://172.16.200.26:6379/1",
        alias="CELERY_RESULT_BACKEND",
    )
    celery_result_backend_fallback: str = Field(
        default="redis://localhost:6379/1",
        alias="CELERY_RESULT_BACKEND_FALLBACK",
    )

    cors_origins: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
        ],
        alias="CORS_ORIGINS",
    )
    # Optional regex for LAN/custom hosts. Empty = disabled in production.
    cors_origin_regex: str | None = Field(default=None, alias="CORS_ORIGIN_REGEX")

    crm_upload_root: str = Field(
        default="",
        alias="CRM_UPLOAD_ROOT",
        description="Directory for CRM attachment files; default apps/api/var/crm-attachments",
    )
    project_tracker_upload_root: str = Field(
        default="",
        alias="PROJECT_TRACKER_UPLOAD_ROOT",
    )

    asset_storage_backend: str = Field(
        default="local",
        alias="ASSET_STORAGE_BACKEND",
        description="Asset file storage backend; only 'local' is implemented in this phase.",
    )
    asset_storage_path: str = Field(
        default="",
        alias="ASSET_STORAGE_PATH",
        description="Directory for asset-module files (DC challan docs); default apps/api/var/asset-storage",
    )

    asset_workflow_governance_enabled: bool = Field(
        default=False,
        alias="ASSET_WORKFLOW_GOVERNANCE_ENABLED",
        description="When true, asset mutations require workflow approval (FP-ASSET-WF-GOV-001).",
    )
    asset_dc_challan_max_upload_mb: int = Field(
        default=10,
        alias="ASSET_DC_CHALLAN_MAX_UPLOAD_MB",
        description="Max upload size (MB) for asset DC challan documents.",
    )
    asset_dc_challan_scm_api_key: str = Field(
        default="",
        alias="ASSET_DC_CHALLAN_SCM_API_KEY",
        description="Shared secret for SCM callback POST on asset DC challans.",
    )
    asset_dc_challan_scm_allowed_hosts: str = Field(
        default="",
        alias="ASSET_DC_CHALLAN_SCM_ALLOWED_HOSTS",
        description="Comma-separated allowlist for SCM document URL fetch (SSRF guard).",
    )

    ess_login_captcha_enabled: bool = Field(
        default=False,
        alias="ESS_LOGIN_CAPTCHA_ENABLED",
        description="Require math CAPTCHA on ESS employee code login.",
    )

    minio_endpoint: str = Field(default="172.16.200.26:9000", alias="MINIO_ENDPOINT")
    minio_endpoint_fallback: str = Field(
        default="localhost:9000",
        alias="MINIO_ENDPOINT_FALLBACK",
    )
    minio_root_user: str = Field(default="erp_minio", alias="MINIO_ROOT_USER")
    minio_root_password: str = Field(default="erp_minio_password", alias="MINIO_ROOT_PASSWORD")
    minio_bucket: str = Field(default="erp-documents", alias="MINIO_BUCKET")
    minio_secure: bool = Field(default=False, alias="MINIO_SECURE")

    opensearch_url: str = Field(
        default="http://172.16.200.26:9200",
        alias="OPENSEARCH_URL",
    )
    opensearch_url_fallback: str = Field(
        default="http://localhost:9200",
        alias="OPENSEARCH_URL_FALLBACK",
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
    # Business-day timezone for attendance punch "today" (IST by default)
    app_timezone: str = Field(default="Asia/Kolkata", alias="APP_TIMEZONE")
    # Push notifications (legacy FCM). Leave empty to keep stub deliveries.
    fcm_server_key: str | None = Field(default=None, alias="FCM_SERVER_KEY")

    # Microsoft Graph email (Notification Engine — email channel)
    azure_tenant_id: str = Field(default="", alias="AZURE_TENANT_ID")
    azure_client_id: str = Field(default="", alias="AZURE_CLIENT_ID")
    azure_client_secret: str = Field(default="", alias="AZURE_CLIENT_SECRET")
    azure_from_email: str = Field(default="", alias="AZURE_FROM_EMAIL")
    # sync = deliver in-request (local/dev); async = Celery only
    email_delivery_mode: str = Field(default="sync", alias="EMAIL_DELIVERY_MODE")
    # Project stage-save emails — keep false until Graph Mail.Send is granted
    project_stage_email_notifications_enabled: bool = Field(
        default=False,
        alias="PROJECT_STAGE_EMAIL_NOTIFICATIONS_ENABLED",
    )
    # Mailbox whose inbox is polled for email→ticket (defaults to AZURE_FROM_EMAIL)
    graph_mailbox_email: str = Field(default="", alias="GRAPH_MAILBOX_EMAIL")
    graph_mail_poll_enabled: bool = Field(default=True, alias="GRAPH_MAIL_POLL_ENABLED")

    # Email → Service Request Ticket automation
    email_ticket_enabled: bool = Field(default=False, alias="EMAIL_TICKET_ENABLED")
    email_inbound_webhook_secret: str = Field(default="", alias="EMAIL_INBOUND_WEBHOOK_SECRET")
    email_ticket_default_branch_id: str | None = Field(
        default=None, alias="EMAIL_TICKET_DEFAULT_BRANCH_ID"
    )
    email_ticket_default_category_id: str | None = Field(
        default=None, alias="EMAIL_TICKET_DEFAULT_CATEGORY_ID"
    )
    email_ticket_default_customer_id: str | None = Field(
        default=None, alias="EMAIL_TICKET_DEFAULT_CUSTOMER_ID"
    )
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
    service_followup_hours: int = Field(default=24, alias="SERVICE_FOLLOWUP_HOURS")

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

    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")

    microsoft_tenant_id: str = Field(default="", alias="MICROSOFT_TENANT_ID")
    microsoft_client_id: str = Field(default="", alias="MICROSOFT_CLIENT_ID")
    microsoft_client_secret: str = Field(default="", alias="MICROSOFT_CLIENT_SECRET")
    microsoft_redirect_uri: str = Field(
        default="http://localhost:8000/api/v1/auth/microsoft/callback",
        alias="MICROSOFT_REDIRECT_URI",
    )

    @property
    def microsoft_login_enabled(self) -> bool:
        return bool(
            self.microsoft_client_id.strip()
            and self.microsoft_client_secret.strip()
            and self.microsoft_redirect_uri.strip()
        )

    microsoft_user_email_domain: str = Field(
        default="cachedigitech.com",
        alias="MICROSOFT_USER_EMAIL_DOMAIN",
    )
    microsoft_platform_admin_emails: str = Field(
        default="techbank@cachedigitech.com",
        alias="MICROSOFT_PLATFORM_ADMIN_EMAILS",
    )

    def microsoft_platform_admin_email_set(self) -> set[str]:
        return {
            email.strip().lower()
            for email in self.microsoft_platform_admin_emails.split(",")
            if email.strip()
        }

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            cleaned = value.strip().removeprefix("[").removesuffix("]")
            return [
                origin.strip().strip("\"'")
                for origin in cleaned.split(",")
                if origin.strip().strip("\"'")
            ]
        return value

    @field_validator("cors_origin_regex", mode="before")
    @classmethod
    def parse_cors_origin_regex(cls, value: str | None) -> str | None:
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        return value

    @property
    def is_development(self) -> bool:
        return self.environment.lower() == "development"

    @property
    def resolved_crm_upload_root(self) -> Path:
        if self.crm_upload_root.strip():
            return Path(self.crm_upload_root)
        return _API_ROOT / "var" / "crm-attachments"

    @property
    def resolved_project_tracker_upload_root(self) -> Path:
        if self.project_tracker_upload_root.strip():
            return Path(self.project_tracker_upload_root)
        return _API_ROOT / "var" / "project-trackers"

    @property
    def resolved_asset_storage_path(self) -> Path:
        if self.asset_storage_path.strip():
            return Path(self.asset_storage_path)
        return _API_ROOT / "var" / "asset-storage"

    @property
    def minio_configured(self) -> bool:
        return bool(
            self.minio_endpoint.strip()
            and self.minio_root_user.strip()
            and self.minio_root_password.strip()
        )

    def resolved_graph_tenant_id(self) -> str:
        return (self.azure_tenant_id or self.microsoft_tenant_id or "").strip()

    def resolved_graph_client_id(self) -> str:
        return (self.azure_client_id or self.microsoft_client_id or "").strip()

    def resolved_graph_client_secret(self) -> str:
        return (self.azure_client_secret or self.microsoft_client_secret or "").strip()

    def resolved_graph_mailbox(self) -> str:
        return (self.graph_mailbox_email or self.azure_from_email or self.imap_user or "").strip()

    @property
    def graph_email_configured(self) -> bool:
        return bool(
            self.resolved_graph_tenant_id()
            and self.resolved_graph_client_id()
            and self.resolved_graph_client_secret()
            and (self.azure_from_email.strip() or self.resolved_graph_mailbox())
        )

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

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_from_address)

    @property
    def imap_configured(self) -> bool:
        return bool(self.imap_enabled and self.imap_host and self.imap_user and self.imap_password)

    def graph_credential_diagnostics(self) -> dict:
        """Safe diagnostics for UI (never returns secret values)."""
        checks = {
            "tenant_id": bool(self.resolved_graph_tenant_id()),
            "client_id": bool(self.resolved_graph_client_id()),
            "client_secret": bool(self.resolved_graph_client_secret()),
            "mailbox": bool(self.resolved_graph_mailbox()),
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
            "mailbox": self.resolved_graph_mailbox() or None,
            "tenant_id_preview": (
                f"{self.resolved_graph_tenant_id()[:8]}…"
                if len(self.resolved_graph_tenant_id()) > 8
                else (self.resolved_graph_tenant_id() or None)
            ),
            "client_id_preview": (
                f"{self.resolved_graph_client_id()[:8]}…"
                if len(self.resolved_graph_client_id()) > 8
                else (self.resolved_graph_client_id() or None)
            ),
            "env_files_found": env_paths,
            "hint": (
                None
                if not missing
                else (
                    "Set MICROSOFT_* or AZURE_* plus GRAPH_MAILBOX_EMAIL / AZURE_FROM_EMAIL "
                    "in apps/api/.env, then restart the API. Required: Mail.Send + Mail.Read."
                )
            ),
        }


@lru_cache
def get_settings() -> Settings:
    loaded = Settings()
    # Prefer VM primary; switch to local Docker URLs when VM is unreachable.
    from core.infra_resolve import apply_infra_fallback

    apply_infra_fallback(loaded)
    return loaded


settings = get_settings()
