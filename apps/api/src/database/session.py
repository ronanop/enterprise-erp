"""Database engine and session management."""

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from core.config import settings
from database.base import Base

engine: Engine = create_engine(
    str(settings.database_url),
    pool_pre_ping=True,
    # Platform home fans out many list GETs; keep headroom under Postgres max_connections.
    pool_size=25,
    max_overflow=50,
    pool_timeout=20,
    pool_recycle=1800,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session]:
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> bool:
    """Verify database connectivity for health checks."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


__all__ = ["Base", "SessionLocal", "engine", "get_db", "check_database_connection"]
