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

    app_name: str = Field(default="iConnect Plus API", alias="APP_NAME")
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
    # Local Docker fallbacks (used when VM primary is unreachable).
    # Leave blank in production/Coolify; set in local .env for offline VM work.
    infra_fallback_enabled: bool = Field(default=True, alias="INFRA_FALLBACK_ENABLED")
    database_url_fallback: str = Field(default="", alias="DATABASE_URL_FALLBACK")

    redis_url: str = Field(default="redis://172.16.200.26:6379/0", alias="REDIS_URL")
    redis_url_fallback: str = Field(default="", alias="REDIS_URL_FALLBACK")
    celery_broker_url: str = Field(
        default="amqp://erp:erp_dev_password@172.16.200.26:5672//",
        alias="CELERY_BROKER_URL",
    )
    celery_broker_url_fallback: str = Field(default="", alias="CELERY_BROKER_URL_FALLBACK")
    celery_result_backend: str = Field(
        default="redis://172.16.200.26:6379/1",
        alias="CELERY_RESULT_BACKEND",
    )
    celery_result_backend_fallback: str = Field(
        default="",
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
    # ClamAV / clamd (VAPT 7.1.25) — scan uploads before persist.
    clamav_enabled: bool = Field(default=False, alias="CLAMAV_ENABLED")
    clamav_host: str = Field(default="clamav", alias="CLAMAV_HOST")
    clamav_port: int = Field(default=3310, alias="CLAMAV_PORT")
    clamav_timeout_seconds: float = Field(default=30.0, alias="CLAMAV_TIMEOUT_SECONDS")
    # When true, allow uploads if clamd is unreachable (dev only). Production: false.
    clamav_fail_open: bool = Field(default=False, alias="CLAMAV_FAIL_OPEN")
    project_tracker_upload_root: str = Field(
        default="",
        alias="PROJECT_TRACKER_UPLOAD_ROOT",
    )

    asset_storage_backend: str = Field(
        default="local",
        alias="ASSET_STORAGE_BACKEND",
        description="Asset file storage: 'local' or 'minio' (S3-compatible via S3_ENDPOINT_URL).",
    )
    asset_storage_path: str = Field(
        default="",
        alias="ASSET_STORAGE_PATH",
        description="Directory for asset-module files (DC challan docs); default apps/api/var/asset-storage",
    )

    object_storage_backend: str = Field(
        default="local",
        alias="OBJECT_STORAGE_BACKEND",
        description="Shared object storage: 'local' or 'minio' (VM MinIO via S3_ENDPOINT_URL). 's3' accepted as alias for minio.",
    )
    s3_bucket: str = Field(default="", alias="S3_BUCKET")
    s3_region: str = Field(default="us-east-1", alias="S3_REGION")
    s3_endpoint_url: str = Field(
        default="",
        alias="S3_ENDPOINT_URL",
        description="Required MinIO API endpoint (e.g. http://minio:9000 or http://172.16.200.30:9000). AWS S3 is not used.",
    )
    s3_endpoint_url_fallback: str = Field(
        default="",
        alias="S3_ENDPOINT_URL_FALLBACK",
        description="Local MinIO endpoint used when the VM primary is unreachable.",
    )
    aws_access_key_id: str = Field(
        default="",
        alias="AWS_ACCESS_KEY_ID",
        description="MinIO access key (MINIO_ROOT_USER).",
    )
    aws_secret_access_key: str = Field(
        default="",
        alias="AWS_SECRET_ACCESS_KEY",
        description="MinIO secret key (MINIO_ROOT_PASSWORD).",
    )
    aws_session_token: str = Field(default="", alias="AWS_SESSION_TOKEN")

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
    asset_document_max_upload_mb: int = Field(
        default=10,
        alias="ASSET_DOCUMENT_MAX_UPLOAD_MB",
        description="Max upload size (MB) for asset documents (invoice, warranty, etc.).",
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
    integration_outbound_allowed_hosts: str = Field(
        default="",
        alias="INTEGRATION_OUTBOUND_ALLOWED_HOSTS",
        description="Comma-separated host allowlist for Integration Hub webhooks (required in production).",
    )
    integration_webhook_signing_secret: str = Field(
        default="",
        alias="INTEGRATION_WEBHOOK_SIGNING_SECRET",
        description="HMAC-SHA256 key for X-ERP-Signature on outbound webhooks.",
    )

    ess_login_captcha_enabled: bool = Field(
        default=False,
        alias="ESS_LOGIN_CAPTCHA_ENABLED",
        description="Require math CAPTCHA on ESS employee code login.",
    )

    opensearch_url: str = Field(
        default="http://172.16.200.26:9200",
        alias="OPENSEARCH_URL",
    )
    opensearch_url_fallback: str = Field(
        default="",
        alias="OPENSEARCH_URL_FALLBACK",
    )

    jwt_secret_key: str = Field(default="change-me-in-production", alias="JWT_SECRET_KEY")
    # Comma-separated; first key encrypts, all keys decrypt (prepend to rotate).
    field_encryption_keys: str = Field(default="", alias="FIELD_ENCRYPTION_KEYS")
    # Passphrase or Fernet key. Changing it makes existing ciphertext unreadable.
    pii_encryption_key: str = Field(
        default="change-me-in-production",
        alias="PII_ENCRYPTION_KEY",
    )
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
    # Global API rate limit per client IP (0 disables). Keep 0 locally — home dashboard
    # fans out many module calls; set API_RATE_LIMIT=300+ in AppScan / production.
    api_rate_limit: int = Field(default=0, alias="API_RATE_LIMIT")
    api_rate_window_seconds: int = Field(default=60, alias="API_RATE_WINDOW_SECONDS")
    # Mutating methods (POST/PUT/PATCH/DELETE). Enabled by default to stop data-entry floods.
    api_write_rate_limit: int = Field(default=120, alias="API_WRITE_RATE_LIMIT")
    api_write_rate_window_seconds: int = Field(default=60, alias="API_WRITE_RATE_WINDOW_SECONDS")
    # Uploads (multipart + upload-path JSON). Stricter than general writes.
    api_upload_rate_limit: int = Field(default=30, alias="API_UPLOAD_RATE_LIMIT")
    api_upload_rate_window_seconds: int = Field(
        default=60, alias="API_UPLOAD_RATE_WINDOW_SECONDS"
    )
    # Max JSON string length for normal entry fields (content_base64 exempt).
    api_max_entry_string_length: int = Field(
        default=20_000, alias="API_MAX_ENTRY_STRING_LENGTH"
    )
    # Max Content-Length for multipart / known upload routes (bytes). 0 disables.
    api_max_upload_request_bytes: int = Field(
        default=45 * 1024 * 1024, alias="API_MAX_UPLOAD_REQUEST_BYTES"
    )
    # Access token lifetime for platform/super admins (VAPT session hijack window).
    jwt_privileged_access_token_expire_minutes: int = Field(
        default=15, alias="JWT_PRIVILEGED_ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    # Bind access tokens to the session's User-Agent / IP on every request.
    access_bind_user_agent: bool = Field(default=True, alias="ACCESS_BIND_USER_AGENT")
    access_bind_ip: bool = Field(default=False, alias="ACCESS_BIND_IP")
    # Refresh-token reuse detection: presenting a revoked refresh kills the session family.
    refresh_reuse_detection: bool = Field(default=True, alias="REFRESH_REUSE_DETECTION")
    # Reject well-known demo passwords when false. Default true for local DX;
    # production / VAPT hosts must set ALLOW_DEMO_LOGIN=false.
    allow_demo_login: bool = Field(default=True, alias="ALLOW_DEMO_LOGIN")
    # Interactive OpenAPI /docs — off by default even in development (VAPT).
    enable_api_docs: bool = Field(default=False, alias="ENABLE_API_DOCS")
    # Bind refresh tokens to User-Agent (and optionally IP) to reduce token replay (VAPT session hijack).
    session_bind_user_agent: bool = Field(default=True, alias="SESSION_BIND_USER_AGENT")
    session_bind_ip: bool = Field(default=False, alias="SESSION_BIND_IP")
    # Auth cookie names (HttpOnly) - preferred over localStorage.
    auth_cookie_access: str = Field(default="erp_access_token", alias="AUTH_COOKIE_ACCESS")
    auth_cookie_refresh: str = Field(default="erp_refresh_token", alias="AUTH_COOKIE_REFRESH")
    auth_cookie_secure: bool = Field(default=True, alias="AUTH_COOKIE_SECURE")
    auth_cookie_samesite: str = Field(default="lax", alias="AUTH_COOKIE_SAMESITE")
    account_lockout_threshold: int = Field(default=5, alias="ACCOUNT_LOCKOUT_THRESHOLD")
    account_lockout_minutes: int = Field(default=15, alias="ACCOUNT_LOCKOUT_MINUTES")
    # Business-day timezone for attendance punch "today" (IST by default)
    app_timezone: str = Field(default="Asia/Kolkata", alias="APP_TIMEZONE")
    # Push notifications (legacy FCM). Leave empty to keep stub deliveries.
    fcm_server_key: str | None = Field(default=None, alias="FCM_SERVER_KEY")

    # Notification Engine email channel delivers through SMTP_* below.
    # sync = deliver in-request (local/dev); async = Celery only
    email_delivery_mode: str = Field(default="sync", alias="EMAIL_DELIVERY_MODE")
    # Project stage-save emails - keep false until SMTP is configured
    project_stage_email_notifications_enabled: bool = Field(
        default=False,
        alias="PROJECT_STAGE_EMAIL_NOTIFICATIONS_ENABLED",
    )

    # Email → Service Request Ticket automation (inbox read via IMAP_*)
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
    # Minimum seconds between SMTP sends (rate-limit friendly; Hostinger etc.)
    smtp_send_delay_seconds: float = Field(default=2.0, alias="SMTP_SEND_DELAY_SECONDS")
    imap_enabled: bool = Field(default=False, alias="IMAP_ENABLED")
    imap_host: str = Field(default="", alias="IMAP_HOST")
    imap_port: int = Field(default=993, alias="IMAP_PORT")
    imap_user: str = Field(default="", alias="IMAP_USER")
    imap_password: str = Field(default="", alias="IMAP_PASSWORD")
    imap_mailbox: str = Field(default="INBOX", alias="IMAP_MAILBOX")
    imap_poll_interval_seconds: int = Field(default=120, alias="IMAP_POLL_INTERVAL_SECONDS")
    service_followup_hours: int = Field(default=24, alias="SERVICE_FOLLOWUP_HOURS")

    # ElevenLabs Conversational AI (voice agent - server-side only)
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
    employee_app_url: str = Field(
        default="http://localhost:3001",
        alias="EMPLOYEE_APP_URL",
    )

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_base_url: str = Field(default="https://api.openai.com/v1", alias="OPENAI_BASE_URL")
    openai_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")

    org_email_domain: str = Field(default="cachedigitech.com", alias="ORG_EMAIL_DOMAIN")
    # HRMS employee codes that count as real onboarded employees (e.g. CT5345, CDPL2014).
    hrms_employee_code_pattern: str = Field(
        default=r"^[A-Za-z]{2,6}[0-9]{3,}$",
        alias="HRMS_EMPLOYEE_CODE_PATTERN",
    )
    password_reset_token_minutes: int = Field(default=30, alias="PASSWORD_RESET_TOKEN_MINUTES")

    # Landing access gate (iconnectplus.com Sign in → code → demo | iConnectPlus ERP)
    access_code_demo: str = Field(default="ICP-DEMO-2026", alias="ACCESS_CODE_DEMO")
    access_code_connectplus: str = Field(
        default="ICP-CONNECT-2026",
        alias="ACCESS_CODE_CONNECTPLUS",
    )
    access_gate_token_hours: int = Field(default=12, alias="ACCESS_GATE_TOKEN_HOURS")

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
    def uses_minio_object_storage(self) -> bool:
        backend = (self.object_storage_backend or "local").strip().lower()
        return backend in {"minio", "s3"}

    @property
    def uses_minio_asset_storage(self) -> bool:
        backend = (self.asset_storage_backend or "local").strip().lower()
        return backend in {"minio", "s3"}

    @property
    def s3_configured(self) -> bool:
        """MinIO requires bucket, endpoint, and access keys (no AWS IAM fallback)."""
        return bool(
            self.s3_bucket.strip()
            and self.s3_endpoint_url.strip()
            and self.aws_access_key_id.strip()
            and self.aws_secret_access_key.strip()
        )

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_from_address)

    @property
    def imap_configured(self) -> bool:
        return bool(self.imap_enabled and self.imap_host and self.imap_user and self.imap_password)

    def smtp_diagnostics(self) -> dict:
        """Safe SMTP diagnostics for UI (never returns secret values)."""
        checks = {
            "SMTP_HOST": bool(self.smtp_host.strip()),
            "SMTP_FROM_ADDRESS": bool(self.smtp_from_address.strip()),
        }
        missing = [name for name, ok in checks.items() if not ok]
        return {
            "configured": not missing,
            "missing": missing,
            "present": [name for name, ok in checks.items() if ok],
            "host": self.smtp_host.strip() or None,
            "port": self.smtp_port,
            "use_tls": self.smtp_use_tls,
            "auth": bool(self.smtp_user.strip()),
            "from_email": self.smtp_from_address.strip() or None,
            "send_delay_seconds": self.smtp_send_delay_seconds,
            "env_files_found": [p for p in _ENV_FILES if Path(p).is_file()],
            "hint": (
                None
                if not missing
                else "Set SMTP_HOST and SMTP_FROM_ADDRESS (plus SMTP_USER / SMTP_PASSWORD if "
                "your relay needs auth), then restart the API."
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
