"""Startup probes for shared infrastructure (Postgres, Redis, RabbitMQ, MinIO, OpenSearch)."""

from __future__ import annotations

import socket
from urllib.parse import urlparse, urlunparse

import httpx
from sqlalchemy import text

from core.config import settings
from core.logging import get_logger
from core.redis import get_redis
from database.session import engine

logger = get_logger(__name__)


def _redact_url(url: str) -> str:
    """Hide password in connection URLs for logs."""
    try:
        parsed = urlparse(url)
        if not parsed.password:
            return url
        host = parsed.hostname or ""
        if parsed.port:
            host = f"{host}:{parsed.port}"
        user = parsed.username or ""
        netloc = f"{user}:***@{host}" if user else f"***@{host}"
        return urlunparse(parsed._replace(netloc=netloc))
    except Exception:
        return "<unparseable-url>"


def _tcp_ok(host: str, port: int, timeout: float = 3.0) -> tuple[bool, str]:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True, "tcp ok"
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


def _check_postgres() -> tuple[bool, str, str]:
    target = _redact_url(str(settings.database_url))
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, target, "select 1 ok"
    except Exception as exc:
        return False, target, f"{type(exc).__name__}: {exc}"


def _check_redis() -> tuple[bool, str, str]:
    target = _redact_url(settings.redis_url)
    try:
        client = get_redis()
        pong = client.ping()
        return True, target, f"ping={pong}"
    except Exception as exc:
        return False, target, f"{type(exc).__name__}: {exc}"


def _check_rabbitmq() -> tuple[bool, str, str]:
    target = _redact_url(settings.celery_broker_url)
    try:
        parsed = urlparse(settings.celery_broker_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 5672
        ok, detail = _tcp_ok(host, port)
        if not ok:
            return False, target, detail
        try:
            with socket.create_connection((host, port), timeout=3.0) as sock:
                sock.settimeout(2.0)
                banner = sock.recv(16)
            if banner.startswith(b"AMQP"):
                return True, target, f"amqp banner ok ({host}:{port})"
            if banner:
                return True, target, f"tcp ok, banner={banner!r}"
        except TimeoutError:
            # Port open; broker may not send a banner before client frames.
            return True, target, f"tcp ok ({host}:{port})"
        return True, target, f"tcp ok ({host}:{port})"
    except Exception as exc:
        return False, target, f"{type(exc).__name__}: {exc}"


def _check_minio() -> tuple[bool, str, str]:
    endpoint = settings.minio_endpoint.strip()
    if not endpoint:
        return False, "(not configured)", "MINIO_ENDPOINT empty"
    scheme = "https" if settings.minio_secure else "http"
    base = endpoint if "://" in endpoint else f"{scheme}://{endpoint}"
    health_url = f"{base.rstrip('/')}/minio/health/live"
    try:
        with httpx.Client(timeout=3.0) as client:
            response = client.get(health_url)
        if response.status_code < 500:
            return True, base, f"health HTTP {response.status_code}"
        return False, base, f"health HTTP {response.status_code}"
    except Exception as exc:
        # Fallback: TCP only
        parsed = urlparse(base if "://" in base else f"http://{base}")
        host = parsed.hostname or endpoint.split(":")[0]
        port = parsed.port or (443 if settings.minio_secure else 9000)
        ok, detail = _tcp_ok(host, port)
        if ok:
            return True, base, f"tcp ok (health endpoint unreachable: {exc})"
        return False, base, f"{type(exc).__name__}: {exc}"


def _check_opensearch() -> tuple[bool, str, str]:
    url = (settings.opensearch_url or "").strip().rstrip("/")
    if not url:
        return False, "(not configured)", "OPENSEARCH_URL empty"
    try:
        with httpx.Client(timeout=3.0) as client:
            response = client.get(url)
        if response.status_code < 500:
            return True, url, f"HTTP {response.status_code}"
        return False, url, f"HTTP {response.status_code}: {response.text[:120]}"
    except Exception as exc:
        return False, url, f"{type(exc).__name__}: {exc}"


def log_infrastructure_connections() -> dict[str, bool]:
    """Probe infra targets and emit one log line per service. Returns ok flags."""
    checks = (
        ("postgres", _check_postgres),
        ("redis", _check_redis),
        ("rabbitmq", _check_rabbitmq),
        ("minio", _check_minio),
        ("opensearch", _check_opensearch),
    )
    results: dict[str, bool] = {}
    logger.info("Checking infrastructure connections…")
    for name, probe in checks:
        ok, target, detail = probe()
        results[name] = ok
        if ok:
            logger.info("Infra OK  %-11s %s (%s)", name, target, detail)
        else:
            logger.error("Infra FAIL %-11s %s (%s)", name, target, detail)
    summary = ", ".join(f"{k}={'ok' if v else 'FAIL'}" for k, v in results.items())
    logger.info("Infrastructure check complete: %s", summary)
    return results


__all__ = ["log_infrastructure_connections"]
