"""Resolve primary vs fallback infrastructure endpoints at process start.

Primary targets (typically LAN VM) are TCP-probed. When unreachable and
``INFRA_FALLBACK_ENABLED`` is true, connection URLs are switched to the
``*_FALLBACK`` values from the environment.
"""

from __future__ import annotations

import logging
import os
import socket
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, urlunparse

logger = logging.getLogger(__name__)

_FALLBACK_KEYS = (
    ("DATABASE_URL", "DATABASE_URL_FALLBACK"),
    ("REDIS_URL", "REDIS_URL_FALLBACK"),
    ("CELERY_BROKER_URL", "CELERY_BROKER_URL_FALLBACK"),
    ("CELERY_RESULT_BACKEND", "CELERY_RESULT_BACKEND_FALLBACK"),
    ("MINIO_ENDPOINT", "MINIO_ENDPOINT_FALLBACK"),
    ("OPENSEARCH_URL", "OPENSEARCH_URL_FALLBACK"),
)

_PROBE_TIMEOUT_SEC = 1.5


def _running_in_docker() -> bool:
    if Path("/.dockerenv").exists():
        return True
    try:
        return "docker" in Path("/proc/1/cgroup").read_text(encoding="utf-8").lower()
    except OSError:
        return False


def _rewrite_loopback_for_docker(value: str) -> str:
    """Map localhost/127.0.0.1 to host.docker.internal when API runs in a container."""
    if not value or not _running_in_docker():
        return value
    return (
        value.replace("://localhost", "://host.docker.internal")
        .replace("://127.0.0.1", "://host.docker.internal")
        .replace("@localhost:", "@host.docker.internal:")
        .replace("@127.0.0.1:", "@host.docker.internal:")
    )


def _host_port_from_url(url: str, *, default_port: int) -> tuple[str, int] | None:
    raw = (url or "").strip()
    if not raw:
        return None
    # SQLAlchemy dialect URLs: postgresql+psycopg://...
    normalized = raw.replace("postgresql+psycopg://", "postgresql://", 1)
    if "://" not in normalized and ":" in normalized and not normalized.startswith("["):
        # bare host:port (MinIO)
        host, _, port_s = normalized.partition(":")
        try:
            return host.strip(), int(port_s.strip())
        except ValueError:
            return host.strip(), default_port
    parsed = urlparse(normalized)
    host = parsed.hostname
    if not host:
        return None
    port = parsed.port or default_port
    return host, port


def tcp_reachable(host: str, port: int, *, timeout: float = _PROBE_TIMEOUT_SEC) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _env_truthy(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def primary_infra_reachable() -> bool:
    """Probe VM/primary Postgres, then Redis if configured."""
    database_url = os.environ.get("DATABASE_URL", "").strip()
    target = _host_port_from_url(database_url, default_port=5432)
    if target is None:
        return False
    host, port = target
    if not tcp_reachable(host, port):
        logger.warning("Primary Postgres unreachable at %s:%s", host, port)
        return False

    redis_url = os.environ.get("REDIS_URL", "").strip()
    redis_target = _host_port_from_url(redis_url, default_port=6379)
    if redis_target is not None:
        r_host, r_port = redis_target
        if not tcp_reachable(r_host, r_port):
            logger.warning("Primary Redis unreachable at %s:%s", r_host, r_port)
            return False
    return True


def apply_infra_fallback_to_environ() -> dict[str, Any]:
    """Mutate ``os.environ`` to fallback URLs when primary infra is down.

    Must run before Settings() / engine creation.
    """
    enabled = _env_truthy("INFRA_FALLBACK_ENABLED", default=False)
    report: dict[str, Any] = {
        "fallback_enabled": enabled,
        "using_fallback": False,
        "primary_reachable": None,
        "switched": [],
    }
    if not enabled:
        return report

    reachable = primary_infra_reachable()
    report["primary_reachable"] = reachable
    if reachable:
        logger.info("Using primary infrastructure (VM / configured DATABASE_URL host)")
        return report

    switched: list[str] = []
    for primary_key, fallback_key in _FALLBACK_KEYS:
        fallback = os.environ.get(fallback_key, "").strip()
        if not fallback:
            continue
        rewritten = _rewrite_loopback_for_docker(fallback)
        os.environ[primary_key] = rewritten
        switched.append(primary_key)

    report["using_fallback"] = bool(switched)
    report["switched"] = switched
    if switched:
        logger.warning(
            "Primary infra unreachable — switched to local fallback for: %s",
            ", ".join(switched),
        )
    else:
        logger.error(
            "Primary infra unreachable and no *_FALLBACK URLs configured"
        )
    return report


def redact_url(url: str) -> str:
    """Mask password in a URL for logs."""
    try:
        normalized = url.replace("postgresql+psycopg://", "postgresql://", 1)
        parsed = urlparse(normalized)
        if parsed.password is None:
            return url
        netloc = parsed.netloc.replace(f":{parsed.password}@", ":***@")
        return urlunparse(parsed._replace(netloc=netloc)).replace(
            "postgresql://", "postgresql+psycopg://", 1
        ) if url.startswith("postgresql+psycopg://") else urlunparse(
            parsed._replace(netloc=netloc)
        )
    except Exception:
        return "***"
