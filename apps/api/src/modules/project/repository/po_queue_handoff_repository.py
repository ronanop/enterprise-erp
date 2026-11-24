"""PO queue handoff repository."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select

from modules.foundation.domain.value_objects import TenantContext
from modules.project.models.po_queue_handoff import PrjPoQueueHandoff
from modules.project.repository.base import PrjScopedRepository, utcnow


class PoQueueHandoffRepository(PrjScopedRepository):
    def list_active(self, ctx: TenantContext, company_id: UUID | None) -> list[PrjPoQueueHandoff]:
        stmt = select(PrjPoQueueHandoff).where(PrjPoQueueHandoff.is_deleted.is_(False))
        stmt = self.apply_optional_company_filter(stmt, PrjPoQueueHandoff, company_id)
        stmt = stmt.order_by(PrjPoQueueHandoff.shared_at.desc())
        return list(
            self.db.scalars(
                self.apply_prj_filter(stmt, PrjPoQueueHandoff, ctx, branch_scoped=True)
            ).all()
        )

    def get(self, ctx: TenantContext, row_id: UUID) -> PrjPoQueueHandoff | None:
        stmt = select(PrjPoQueueHandoff).where(
            PrjPoQueueHandoff.id == row_id,
            PrjPoQueueHandoff.is_deleted.is_(False),
        )
        return self.db.scalar(
            self.apply_prj_filter(stmt, PrjPoQueueHandoff, ctx, branch_scoped=True)
        )

    def get_by_order_id(
        self, ctx: TenantContext, proc_order_id: UUID
    ) -> PrjPoQueueHandoff | None:
        stmt = select(PrjPoQueueHandoff).where(
            PrjPoQueueHandoff.proc_order_id == proc_order_id,
            PrjPoQueueHandoff.is_deleted.is_(False),
        )
        return self.db.scalar(
            self.apply_prj_filter(stmt, PrjPoQueueHandoff, ctx, branch_scoped=True)
        )

    def list_by_seed_marker(
        self, ctx: TenantContext, company_id: UUID | None, seed_marker: str
    ) -> list[PrjPoQueueHandoff]:
        stmt = select(PrjPoQueueHandoff).where(
            PrjPoQueueHandoff.is_deleted.is_(False),
            PrjPoQueueHandoff.is_seed.is_(True),
            PrjPoQueueHandoff.seed_marker == seed_marker,
        )
        stmt = self.apply_optional_company_filter(stmt, PrjPoQueueHandoff, company_id)
        return list(
            self.db.scalars(
                self.apply_prj_filter(stmt, PrjPoQueueHandoff, ctx, branch_scoped=True)
            ).all()
        )

    def list_active_seed_customer_po_numbers(
        self,
        ctx: TenantContext,
        company_id: UUID | None,
        *,
        exclude_seed_marker: str | None = None,
    ) -> set[str]:
        """Active seed queue PO numbers (other trackers), for upload dedupe."""
        stmt = select(PrjPoQueueHandoff).where(
            PrjPoQueueHandoff.tenant_id == ctx.tenant_id,
            PrjPoQueueHandoff.is_seed.is_(True),
            PrjPoQueueHandoff.is_deleted.is_(False),
            PrjPoQueueHandoff.customer_po_number.isnot(None),
        )
        if exclude_seed_marker:
            stmt = stmt.where(
                (PrjPoQueueHandoff.seed_marker.is_(None))
                | (PrjPoQueueHandoff.seed_marker != exclude_seed_marker)
            )
        stmt = self.apply_optional_company_filter(stmt, PrjPoQueueHandoff, company_id)
        out: set[str] = set()
        for row in self.db.scalars(stmt).all():
            po = (row.customer_po_number or "").strip()
            if po:
                out.add(po.casefold())
        return out

    def list_by_cloud_name(
        self,
        ctx: TenantContext,
        company_id: UUID | None,
        cloud_name: str,
        *,
        include_deleted: bool = False,
    ) -> list[PrjPoQueueHandoff]:
        needle = (cloud_name or "").strip()
        if not needle:
            return []
        key = needle.casefold()
        if include_deleted:
            # Bypass soft-delete filter so project detail can snapshot completed queue lines.
            stmt = select(PrjPoQueueHandoff).where(
                PrjPoQueueHandoff.tenant_id == ctx.tenant_id,
                PrjPoQueueHandoff.is_seed.is_(True),
                PrjPoQueueHandoff.cloud_name.isnot(None),
            )
            stmt = self.apply_optional_company_filter(stmt, PrjPoQueueHandoff, company_id)
            rows = list(self.db.scalars(stmt).all())
            return [row for row in rows if (row.cloud_name or "").strip().casefold() == key]

        stmt = select(PrjPoQueueHandoff).where(
            PrjPoQueueHandoff.is_deleted.is_(False),
            PrjPoQueueHandoff.is_seed.is_(True),
            PrjPoQueueHandoff.cloud_name.isnot(None),
        )
        stmt = self.apply_optional_company_filter(stmt, PrjPoQueueHandoff, company_id)
        rows = list(
            self.db.scalars(
                self.apply_prj_filter(stmt, PrjPoQueueHandoff, ctx, branch_scoped=True)
            ).all()
        )
        return [row for row in rows if (row.cloud_name or "").strip().casefold() == key]

    def upsert(self, ctx: TenantContext, **fields) -> PrjPoQueueHandoff:
        proc_order_id = fields.get("proc_order_id")
        if proc_order_id is not None:
            existing = self.get_by_order_id(ctx, proc_order_id)
            if existing is not None:
                for key, value in fields.items():
                    if key != "proc_order_id":
                        setattr(existing, key, value)
                existing.updated_at = utcnow()
                existing.updated_by = ctx.user_id
                existing.version = int(existing.version or 1) + 1
                self.db.flush()
                return existing

        row = PrjPoQueueHandoff(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def soft_delete(self, ctx: TenantContext, row_id: UUID) -> None:
        row = self.get(ctx, row_id)
        if row is None:
            return
        row.is_deleted = True
        row.deleted_at = datetime.now(timezone.utc)
        row.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()

    def soft_delete_by_order_id(self, ctx: TenantContext, proc_order_id: UUID) -> None:
        row = self.get_by_order_id(ctx, proc_order_id)
        if row is None:
            return
        self.soft_delete(ctx, row.id)
