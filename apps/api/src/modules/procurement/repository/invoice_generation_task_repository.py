"""Repository for procurement.proc_invoice_generation_task."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.models.invoice_generation_task import ProcInvoiceGenerationTask


class ProcInvoiceGenerationTaskRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_for_assignee(
        self,
        ctx: TenantContext,
        *,
        user_id: UUID,
        status: str | None = None,
    ) -> list[ProcInvoiceGenerationTask]:
        stmt = select(ProcInvoiceGenerationTask).where(
            ProcInvoiceGenerationTask.tenant_id == ctx.tenant_id,
            ProcInvoiceGenerationTask.assigned_user_id == user_id,
            ProcInvoiceGenerationTask.is_deleted.is_(False),
        )
        if status:
            stmt = stmt.where(ProcInvoiceGenerationTask.status == status)
        stmt = stmt.order_by(ProcInvoiceGenerationTask.created_at.desc())
        return list(self._db.scalars(stmt).all())

    def get(self, ctx: TenantContext, task_id: UUID) -> ProcInvoiceGenerationTask | None:
        stmt = select(ProcInvoiceGenerationTask).where(
            ProcInvoiceGenerationTask.tenant_id == ctx.tenant_id,
            ProcInvoiceGenerationTask.id == task_id,
            ProcInvoiceGenerationTask.is_deleted.is_(False),
        )
        return self._db.scalars(stmt).first()

    def list_for_batch(
        self,
        ctx: TenantContext,
        *,
        receipt_batch_id: UUID,
    ) -> list[ProcInvoiceGenerationTask]:
        stmt = (
            select(ProcInvoiceGenerationTask)
            .where(
                ProcInvoiceGenerationTask.tenant_id == ctx.tenant_id,
                ProcInvoiceGenerationTask.receipt_batch_id == receipt_batch_id,
                ProcInvoiceGenerationTask.is_deleted.is_(False),
            )
            .order_by(ProcInvoiceGenerationTask.created_at.desc())
        )
        return list(self._db.scalars(stmt).all())

    def find_for_batch_assignee(
        self,
        ctx: TenantContext,
        *,
        receipt_batch_id: UUID,
        assigned_user_id: UUID,
        status: str | None = None,
    ) -> ProcInvoiceGenerationTask | None:
        stmt = select(ProcInvoiceGenerationTask).where(
            ProcInvoiceGenerationTask.tenant_id == ctx.tenant_id,
            ProcInvoiceGenerationTask.receipt_batch_id == receipt_batch_id,
            ProcInvoiceGenerationTask.assigned_user_id == assigned_user_id,
            ProcInvoiceGenerationTask.is_deleted.is_(False),
        )
        if status:
            stmt = stmt.where(ProcInvoiceGenerationTask.status == status)
        stmt = stmt.order_by(ProcInvoiceGenerationTask.created_at.desc())
        return self._db.scalars(stmt).first()

    def list_pending_for_order_assignee(
        self,
        ctx: TenantContext,
        *,
        order_header_id: UUID,
        assigned_user_id: UUID,
    ) -> list[ProcInvoiceGenerationTask]:
        stmt = (
            select(ProcInvoiceGenerationTask)
            .where(
                ProcInvoiceGenerationTask.tenant_id == ctx.tenant_id,
                ProcInvoiceGenerationTask.order_header_id == order_header_id,
                ProcInvoiceGenerationTask.assigned_user_id == assigned_user_id,
                ProcInvoiceGenerationTask.status == "pending",
                ProcInvoiceGenerationTask.is_deleted.is_(False),
            )
            .order_by(ProcInvoiceGenerationTask.created_at.desc())
        )
        return list(self._db.scalars(stmt).all())

    def list_for_order(
        self,
        ctx: TenantContext,
        *,
        order_header_id: UUID,
    ) -> list[ProcInvoiceGenerationTask]:
        stmt = (
            select(ProcInvoiceGenerationTask)
            .where(
                ProcInvoiceGenerationTask.tenant_id == ctx.tenant_id,
                ProcInvoiceGenerationTask.order_header_id == order_header_id,
                ProcInvoiceGenerationTask.is_deleted.is_(False),
            )
            .order_by(ProcInvoiceGenerationTask.created_at.desc())
        )
        return list(self._db.scalars(stmt).all())

    def add(self, row: ProcInvoiceGenerationTask) -> ProcInvoiceGenerationTask:
        self._db.add(row)
        self._db.flush()
        return row
