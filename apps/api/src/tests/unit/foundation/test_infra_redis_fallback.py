"""Redis fallback and fail-fast session cache."""

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import redis

from core.infra_resolve import apply_infra_fallback
from core.redis import SessionStore


def _settings(**overrides):
    base = {
        "infra_fallback_enabled": True,
        "database_url": "postgresql+psycopg://erp:erp@172.16.200.26:5432/erp",
        "database_url_fallback": "postgresql+psycopg://erp:erp@localhost:5433/erp",
        "redis_url": "redis://172.16.200.26:6379/0",
        "redis_url_fallback": "redis://localhost:6379/0",
        "celery_result_backend": "redis://172.16.200.26:6379/1",
        "celery_result_backend_fallback": "redis://localhost:6379/1",
        "celery_broker_url": "amqp://erp:erp@172.16.200.26:5672//",
        "celery_broker_url_fallback": "amqp://erp:erp@localhost:5672//",
        "minio_endpoint_fallback": "",
        "opensearch_url_fallback": "",
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_redis_falls_back_when_postgres_is_up(monkeypatch):
    settings = _settings()

    def fake_tcp(host: str, port: int, timeout: float = 2.0) -> bool:
        if port == 5432:
            return True
        if port == 6379:
            return host == "localhost"
        return False

    monkeypatch.setattr("core.infra_resolve._tcp_reachable", fake_tcp)
    source = apply_infra_fallback(settings)
    assert source == "primary"
    assert settings.redis_url == "redis://localhost:6379/0"
    assert settings.celery_result_backend == "redis://localhost:6379/1"


def test_session_store_returns_none_when_redis_times_out():
    client = MagicMock()
    client.get.side_effect = redis.TimeoutError("timed out")
    store = SessionStore(client=client)
    assert store.get_session(uuid4()) is None
