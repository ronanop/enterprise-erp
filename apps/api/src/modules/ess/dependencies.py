"""ESS module dependencies."""

from collections.abc import Generator

from sqlalchemy.orm import Session

from database.session import SessionLocal
from modules.foundation.dependencies import get_tenant_context
from modules.foundation.domain.value_objects import TenantContext

__all__ = ["get_db", "get_tenant_context", "TenantContext"]


def get_db() -> Generator[Session]:
    """ESS request-scoped unit of work — commit on success, roll back on failure."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
