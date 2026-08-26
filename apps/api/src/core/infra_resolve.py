"""Prefer VM infrastructure; fall back to local Docker when unreachable."""

from __future__ import annotations

import socket
from typing import TYPE_CHECKING
from urllib.parse import urlparse

if TYPE_CHECKING:
    from core.config import Settings

# Set by apply_infra_fallback — "primary" | "fallback"
ACTIVE_INFRA_SOURCE = "primary"


def _tcp_reachable(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _host_port_from_url(url: str, default_port: int) -> tuple[str, int] | None:
    raw = (url or "").strip()
    if not raw:
        return None
    if "://" not in raw:
        raw = f"tcp://{raw}"
    parsed = urlparse(raw)
    host = parsed.hostname
    if not host:
        return None
    port = parsed.port or default_port
    return host, port


def primary_infra_reachable(settings: Settings, timeout: float = 2.0) -> bool:
    """True when primary (VM) Postgres accepts TCP — gate for the whole primary set."""
    db = _host_port_from_url(str(settings.database_url), 5432)
    if not db:
        return False
    return _tcp_reachable(db[0], db[1], timeout=timeout)


def apply_infra_fallback(settings: Settings) -> str:
    """
    Mutate settings to local Docker fallbacks when primary (VM) is unreachable.

    Returns the active source: ``primary`` or ``fallback``.
    """
    global ACTIVE_INFRA_SOURCE

    if not settings.infra_fallback_enabled:
        ACTIVE_INFRA_SOURCE = "primary"
        return ACTIVE_INFRA_SOURCE

    has_fallback = bool(
        (settings.database_url_fallback or "").strip()
        or (settings.redis_url_fallback or "").strip()
    )
    if not has_fallback:
        ACTIVE_INFRA_SOURCE = "primary"
        return ACTIVE_INFRA_SOURCE

    if primary_infra_reachable(settings):
        ACTIVE_INFRA_SOURCE = "primary"
        return ACTIVE_INFRA_SOURCE

    # Switch each configured fallback independently (blank = keep primary value).
    if (settings.database_url_fallback or "").strip():
        settings.database_url = settings.database_url_fallback.strip()
    if (settings.redis_url_fallback or "").strip():
        settings.redis_url = settings.redis_url_fallback.strip()
    if (settings.celery_broker_url_fallback or "").strip():
        settings.celery_broker_url = settings.celery_broker_url_fallback.strip()
    if (settings.celery_result_backend_fallback or "").strip():
        settings.celery_result_backend = settings.celery_result_backend_fallback.strip()
    if (settings.minio_endpoint_fallback or "").strip():
        settings.minio_endpoint = settings.minio_endpoint_fallback.strip()
    if (settings.opensearch_url_fallback or "").strip():
        settings.opensearch_url = settings.opensearch_url_fallback.strip()

    ACTIVE_INFRA_SOURCE = "fallback"
    return ACTIVE_INFRA_SOURCE


__all__ = [
    "ACTIVE_INFRA_SOURCE",
    "apply_infra_fallback",
    "primary_infra_reachable",
]
