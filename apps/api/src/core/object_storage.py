"""Object storage helpers (MinIO / S3-compatible).

CRM attachments still use local disk via ``CRM_UPLOAD_ROOT``. When object
storage is enabled, use this module for modules that upload to MinIO.
"""

from __future__ import annotations

from core.config import settings


def storage_diagnostics() -> dict[str, object]:
    """Safe summary for health/admin endpoints (no secrets)."""
    return {
        "crm_upload_root": str(settings.resolved_crm_upload_root),
        "minio_configured": settings.minio_configured,
        "minio_endpoint": settings.minio_endpoint.strip() or None,
        "minio_bucket": settings.minio_bucket,
        "minio_secure": settings.minio_secure,
    }
