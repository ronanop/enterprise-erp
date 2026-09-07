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


def _url_tcp_reachable(url: str, default_port: int, timeout: float = 2.0) -> bool:
    parsed = _host_port_from_url(url, default_port)
    if not parsed:
        return False
    return _tcp_reachable(parsed[0], parsed[1], timeout=timeout)


def _fallback_unreachable_redis(settings: Settings) -> None:
    """Postgres can be up while VM Redis is down; switch Redis URLs independently."""
    redis_fb = str(getattr(settings, "redis_url_fallback", None) or "").strip()
    if not redis_fb:
        return
    if _url_tcp_reachable(str(settings.redis_url), 6379):
        return
    settings.redis_url = redis_fb
    celery_fb = str(getattr(settings, "celery_result_backend_fallback", None) or "").strip()
    if celery_fb:
        settings.celery_result_backend = celery_fb


def apply_infra_fallback(settings: Settings) -> str:
    """
    Mutate settings to local Docker fallbacks when primary (VM) is unreachable.

    Returns the active source: ``primary`` or ``fallback``.
    """
    global ACTIVE_INFRA_SOURCE

    if not settings.infra_fallback_enabled:
        ACTIVE_INFRA_SOURCE = "primary"
        return ACTIVE_INFRA_SOURCE

    def fallback(name: str) -> str:
        return str(getattr(settings, name, None) or "").strip()

    has_fallback = bool(fallback("database_url_fallback") or fallback("redis_url_fallback"))
    if not has_fallback:
        ACTIVE_INFRA_SOURCE = "primary"
        return ACTIVE_INFRA_SOURCE

    if primary_infra_reachable(settings):
        ACTIVE_INFRA_SOURCE = "primary"
        _fallback_unreachable_redis(settings)
        return ACTIVE_INFRA_SOURCE

    # Switch each configured fallback independently (blank = keep primary value).
    if fallback("database_url_fallback"):
        settings.database_url = fallback("database_url_fallback")
    if fallback("redis_url_fallback"):
        settings.redis_url = fallback("redis_url_fallback")
    if fallback("celery_broker_url_fallback"):
        settings.celery_broker_url = fallback("celery_broker_url_fallback")
    if fallback("celery_result_backend_fallback"):
        settings.celery_result_backend = fallback("celery_result_backend_fallback")
    if fallback("minio_endpoint_fallback"):
        settings.minio_endpoint = fallback("minio_endpoint_fallback")
    if fallback("opensearch_url_fallback"):
        settings.opensearch_url = fallback("opensearch_url_fallback")

    ACTIVE_INFRA_SOURCE = "fallback"
    return ACTIVE_INFRA_SOURCE


__all__ = [
    "ACTIVE_INFRA_SOURCE",
    "apply_infra_fallback",
    "primary_infra_reachable",
]
