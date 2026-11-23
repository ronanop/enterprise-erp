"""Master-data published language for other modules — employees only (standalone HRMS)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import event
from sqlalchemy.orm import Session

from database.base import Base
from modules.master_data.models.employee import MasterEmployee


class PublishedReadOnlyError(RuntimeError):
    """Raised when a consumer tries to persist changes through a read projection."""


class _ReadOnlyProjection:
    pass


class EmployeeRead(_ReadOnlyProjection, Base):
    __table__ = MasterEmployee.__table__


@event.listens_for(Session, "before_flush")
def _reject_projection_writes(session: Session, _flush_context, _instances) -> None:
    for obj in (*session.new, *session.deleted):
        if isinstance(obj, _ReadOnlyProjection):
            raise PublishedReadOnlyError(
                f"{type(obj).__name__} is read-only; use master_data owner commands"
            )
    for obj in session.dirty:
        if isinstance(obj, _ReadOnlyProjection) and session.is_modified(
            obj, include_collections=False
        ):
            raise PublishedReadOnlyError(
                f"{type(obj).__name__} is read-only; use master_data owner commands"
            )


class EmployeeCommands:
    """Owner write commands for master employee rows used by other modules."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def link_user(self, employee_id: UUID, user_id: UUID, *, updated_by: UUID | None = None) -> None:
        row = self._row(employee_id)
        if row.user_id == user_id:
            return
        row.user_id = user_id
        self._touch(row, updated_by)

    def unlink_user(self, employee_id: UUID, *, updated_by: UUID | None = None) -> None:
        row = self._row(employee_id)
        if row.user_id is None:
            return
        row.user_id = None
        self._touch(row, updated_by)

    def set_status(self, employee_id: UUID, status: str, *, updated_by: UUID | None = None) -> None:
        row = self._row(employee_id)
        if row.status == status:
            return
        row.status = status
        self._touch(row, updated_by)

    def assign_department(
        self,
        employee_id: UUID,
        *,
        department_id: UUID | None,
        branch_id: UUID | None = None,
        company_id: UUID | None = None,
        updated_by: UUID | None = None,
    ) -> None:
        row = self._row(employee_id)
        row.department_id = department_id
        if branch_id is not None:
            row.branch_id = branch_id
        if company_id is not None:
            row.company_id = company_id
        self._touch(row, updated_by)

    def move_company(
        self,
        employee_id: UUID,
        *,
        company_id: UUID,
        branch_id: UUID,
        updated_by: UUID | None = None,
    ) -> None:
        row = self._row(employee_id)
        row.company_id = company_id
        row.branch_id = branch_id
        self._touch(row, updated_by)

    def soft_delete_freeing_identity(
        self, employee_id: UUID, *, suffix: str, deleted_by: UUID | None
    ) -> None:
        """Soft-delete and rename code/email so the unique keys can be re-imported."""
        row = self._row(employee_id)
        row.is_deleted = True
        row.deleted_at = datetime.now(timezone.utc)
        row.deleted_by = deleted_by
        row.employee_code = f"{row.employee_code}-DEL-{suffix}"[:50]
        row.email = f"deleted-{row.id.hex[:12]}-{suffix}@cleared.local"[:255]
        self._touch(row, deleted_by)

    def create_system_employee(self, *, created_by: UUID | None, **fields) -> UUID:
        """Provision a minimal employee for a login."""
        row = MasterEmployee(id=uuid4(), created_by=created_by, updated_by=created_by, **fields)
        self._db.add(row)
        self._db.flush()
        return row.id

    def _row(self, employee_id: UUID) -> MasterEmployee:
        row = self._db.get(MasterEmployee, employee_id)
        if row is None:
            raise LookupError(f"Employee {employee_id} not found")
        return row

    def _touch(self, row: MasterEmployee, updated_by: UUID | None) -> None:
        if updated_by is not None:
            row.updated_by = updated_by
        row.version = int(row.version or 1) + 1
        self._db.flush()
        projection = self._db.identity_map.get(self._db.identity_key(EmployeeRead, row.id))
        if projection is not None:
            self._db.expire(projection)


__all__ = [
    "EmployeeCommands",
    "EmployeeRead",
    "PublishedReadOnlyError",
]
