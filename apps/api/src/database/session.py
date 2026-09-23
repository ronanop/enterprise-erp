"""Database engine and session management."""

from __future__ import annotations

import os
import sys
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from core.config import settings
from database.base import Base


def _ensure_libpq_on_path() -> None:
    """On Windows, ensure PostgreSQL's libpq.dll is discoverable.

    When Application Control blocks ``psycopg_binary``'s bundled DLLs, psycopg
    falls back to its pure-Python implementation, which needs system libpq.
    """
    if sys.platform != "win32":
        return

    path_env = os.environ.get("PATH", "")
    path_parts = path_env.split(os.pathsep)
    candidates: list[Path] = []

    program_files = os.environ.get("ProgramFiles", r"C:\Program Files")
    pg_root = Path(program_files) / "PostgreSQL"
    if pg_root.is_dir():
        # Prefer highest installed major version (e.g. 18 before 16).
        for version_dir in sorted(pg_root.iterdir(), reverse=True):
            bin_dir = version_dir / "bin"
            if (bin_dir / "libpq.dll").is_file():
                candidates.append(bin_dir)

    for bin_dir in candidates:
        bin_str = str(bin_dir)
        if bin_str not in path_parts:
            os.environ["PATH"] = bin_str + os.pathsep + path_env
            break


_ensure_libpq_on_path()

engine: Engine = create_engine(
    str(settings.database_url),
    pool_pre_ping=True,
    # Platform home fans out many list GETs; keep headroom under Postgres max_connections.
    pool_size=25,
    max_overflow=50,
    pool_timeout=20,
    pool_recycle=1800,
    # Fail fast when RDS/SG/DNS is wrong (default TCP wait can exceed Coolify deploy timeout).
    connect_args={"connect_timeout": 10},
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
