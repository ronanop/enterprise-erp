"""Duplicate checker service (DA-03)."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException


class DuplicateCheckerService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def ensure_unique_code(
        self,
        *,
        model,
        company_id: UUID,
        code: str,
        code_field: str,
        label: str,
        exclude_id: UUID | None = None,
    ) -> None:
        col = getattr(model, code_field)
        stmt = select(model).where(
            model.company_id == company_id,
            col == code,
            model.is_deleted.is_(False),
        )
        if exclude_id:
            stmt = stmt.where(model.id != exclude_id)
        if self._db.scalar(stmt) is not None:
            raise ConflictException(f"{label} code already exists")

    def ensure_unique_email(
        self,
        *,
        model,
        company_id: UUID,
        email: str,
        exclude_id: UUID | None = None,
    ) -> None:
        stmt = select(model).where(
            model.company_id == company_id,
            model.email == email,
            model.is_deleted.is_(False),
        )
        if exclude_id:
            stmt = stmt.where(model.id != exclude_id)
        if self._db.scalar(stmt) is not None:
            raise ConflictException("Employee email already exists for this company")
