"""Repository for HR Admin sidebar nav access."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from modules.hr.models.hr_admin_nav_access import HrAdminNavAccess


def _table_missing(exc: ProgrammingError) -> bool:
    text = str(exc.orig if getattr(exc, "orig", None) is not None else exc).lower()
    return "hr_admin_nav_access" in text and "does not exist" in text


class HrAdminNavAccessRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get(self, tenant_id: UUID, user_id: UUID) -> HrAdminNavAccess | None:
        try:
            return self._db.scalar(
                select(HrAdminNavAccess).where(
                    HrAdminNavAccess.tenant_id == tenant_id,
                    HrAdminNavAccess.user_id == user_id,
                    HrAdminNavAccess.is_deleted.is_(False),
                )
            )
        except ProgrammingError as exc:
            if _table_missing(exc):
                self._db.rollback()
                return None
            raise

    def get_including_deleted(self, tenant_id: UUID, user_id: UUID) -> HrAdminNavAccess | None:
        try:
            return self._db.scalar(
                select(HrAdminNavAccess).where(
                    HrAdminNavAccess.tenant_id == tenant_id,
                    HrAdminNavAccess.user_id == user_id,
                )
            )
        except ProgrammingError as exc:
            if _table_missing(exc):
                self._db.rollback()
                return None
            raise

    def list_active_by_users(
        self, tenant_id: UUID, user_ids: list[UUID]
    ) -> dict[UUID, HrAdminNavAccess]:
        if not user_ids:
            return {}
        rows = self._db.scalars(
            select(HrAdminNavAccess).where(
                HrAdminNavAccess.tenant_id == tenant_id,
                HrAdminNavAccess.user_id.in_(user_ids),
                HrAdminNavAccess.is_deleted.is_(False),
            )
        ).all()
        return {row.user_id: row for row in rows}

    def upsert(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        nav_keys: list[str],
        actor_id: UUID | None,
    ) -> HrAdminNavAccess:
        row = self.get_including_deleted(tenant_id, user_id)
        if row is None:
            row = HrAdminNavAccess(
                tenant_id=tenant_id,
                user_id=user_id,
                nav_keys=nav_keys,
                created_by=actor_id,
                updated_by=actor_id,
            )
            self._db.add(row)
            return row
        row.nav_keys = nav_keys
        row.is_deleted = False
        row.deleted_at = None
        row.deleted_by = None
        row.updated_by = actor_id
        row.version = int(row.version or 1) + 1
        return row

    def soft_delete(self, tenant_id: UUID, user_id: UUID, actor_id: UUID | None) -> None:
        row = self.get(tenant_id, user_id)
        if row is None:
            return
        row.is_deleted = True
        row.deleted_at = datetime.now(timezone.utc)
        row.deleted_by = actor_id
        row.updated_by = actor_id
