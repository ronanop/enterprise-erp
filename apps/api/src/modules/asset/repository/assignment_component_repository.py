"""Repository for assignment ↔ component custody lines (Sub-phase 4C)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.domain.enums import AssignmentComponentIssueStatus
from modules.asset.models import AstAssignmentComponent
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


@dataclass(frozen=True)
class AssignmentComponentListFilters:
    company_id: UUID
    assignment_id: UUID | None = None
    component_id: UUID | None = None
    issue_status: str | None = None


class AssignmentComponentRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssignmentComponent | None:
        stmt = select(AstAssignmentComponent).where(
            AstAssignmentComponent.id == row_id,
            AstAssignmentComponent.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssignmentComponent, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_for_assignment(
        self, ctx: TenantContext, assignment_id: UUID
    ) -> list[AstAssignmentComponent]:
        stmt = (
            select(AstAssignmentComponent)
            .where(
                AstAssignmentComponent.assignment_id == assignment_id,
                AstAssignmentComponent.is_deleted.is_(False),
            )
            .order_by(AstAssignmentComponent.created_at.asc())
        )
        stmt = self.apply_ast_filter(stmt, AstAssignmentComponent, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def list_issued_for_assignment(
        self, ctx: TenantContext, assignment_id: UUID
    ) -> list[AstAssignmentComponent]:
        stmt = (
            select(AstAssignmentComponent)
            .where(
                AstAssignmentComponent.assignment_id == assignment_id,
                AstAssignmentComponent.issue_status == AssignmentComponentIssueStatus.ISSUED.value,
                AstAssignmentComponent.is_deleted.is_(False),
            )
            .order_by(AstAssignmentComponent.created_at.asc())
        )
        stmt = self.apply_ast_filter(stmt, AstAssignmentComponent, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def list_issued_for_asset(
        self, ctx: TenantContext, asset_id: UUID
    ) -> list[AstAssignmentComponent]:
        """Active ISSUED custody lines for any assignment on this asset."""
        from modules.asset.models import AstAssetAssignment

        stmt = (
            select(AstAssignmentComponent)
            .join(
                AstAssetAssignment,
                AstAssetAssignment.id == AstAssignmentComponent.assignment_id,
            )
            .where(
                AstAssetAssignment.asset_id == asset_id,
                AstAssetAssignment.is_deleted.is_(False),
                AstAssignmentComponent.issue_status
                == AssignmentComponentIssueStatus.ISSUED.value,
                AstAssignmentComponent.is_deleted.is_(False),
            )
            .order_by(AstAssignmentComponent.created_at.asc())
        )
        stmt = self.apply_ast_filter(stmt, AstAssignmentComponent, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def find_blocking_for_component(
        self,
        ctx: TenantContext,
        *,
        component_id: UUID,
        exclude_assignment_id: UUID | None = None,
    ) -> AstAssignmentComponent | None:
        """Return a custody row that prevents re-issue (ISSUED/MISSING/DAMAGED/RETAINED)."""
        from modules.asset.domain.enums import ASSIGNMENT_COMPONENT_UNAVAILABLE_STATUSES

        stmt = select(AstAssignmentComponent).where(
            AstAssignmentComponent.component_id == component_id,
            AstAssignmentComponent.issue_status.in_(
                list(ASSIGNMENT_COMPONENT_UNAVAILABLE_STATUSES)
            ),
            AstAssignmentComponent.is_deleted.is_(False),
        )
        if exclude_assignment_id is not None:
            stmt = stmt.where(AstAssignmentComponent.assignment_id != exclude_assignment_id)
        stmt = self.apply_ast_filter(stmt, AstAssignmentComponent, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def find_active_issue(
        self,
        ctx: TenantContext,
        *,
        component_id: UUID,
        exclude_assignment_id: UUID | None = None,
    ) -> AstAssignmentComponent | None:
        stmt = select(AstAssignmentComponent).where(
            AstAssignmentComponent.component_id == component_id,
            AstAssignmentComponent.issue_status == AssignmentComponentIssueStatus.ISSUED.value,
            AstAssignmentComponent.is_deleted.is_(False),
        )
        if exclude_assignment_id is not None:
            stmt = stmt.where(AstAssignmentComponent.assignment_id != exclude_assignment_id)
        stmt = self.apply_ast_filter(stmt, AstAssignmentComponent, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_blocking_component_ids(
        self, ctx: TenantContext, *, component_ids: list[UUID]
    ) -> set[UUID]:
        if not component_ids:
            return set()
        from modules.asset.domain.enums import ASSIGNMENT_COMPONENT_UNAVAILABLE_STATUSES

        stmt = select(AstAssignmentComponent.component_id).where(
            AstAssignmentComponent.component_id.in_(component_ids),
            AstAssignmentComponent.issue_status.in_(
                list(ASSIGNMENT_COMPONENT_UNAVAILABLE_STATUSES)
            ),
            AstAssignmentComponent.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssignmentComponent, ctx, branch_scoped=False)
        return set(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> AstAssignmentComponent:
        now = utcnow()
        # Explicit timestamps: DB server_default is the safety net; client values
        # match other asset repos and avoid NOT NULL when defaults are missing.
        row = AstAssignmentComponent(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            created_at=fields.pop("created_at", now),
            updated_at=fields.pop("updated_at", now),
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(
        self, ctx: TenantContext, row_id: UUID, **fields
    ) -> AstAssignmentComponent | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Assignment component has been modified by another user; reload and retry"
            )
        for key, value in fields.items():
            setattr(row, key, value)
        row.updated_by = ctx.user_id
        row.updated_at = utcnow()
        if expected_version is not None:
            row.version = int(expected_version) + 1
        self.db.flush()
        return row

    def soft_delete_issued_for_assignment(self, ctx: TenantContext, assignment_id: UUID) -> int:
        """Release reserved/issued lines when draft is cancelled or rejected."""
        rows = self.list_issued_for_assignment(ctx, assignment_id)
        now = utcnow()
        for row in rows:
            row.is_deleted = True
            row.deleted_at = now
            row.deleted_by = ctx.user_id
            row.updated_by = ctx.user_id
            row.updated_at = now
            row.version = int(row.version or 1) + 1
        if rows:
            self.db.flush()
        return len(rows)

    def replace_draft_selection(
        self,
        ctx: TenantContext,
        *,
        assignment_id: UUID,
        company_id: UUID,
        component_ids: list[UUID],
    ) -> list[AstAssignmentComponent]:
        """Replace ISSUED draft/active selection for an assignment (idempotent)."""
        existing = self.list_issued_for_assignment(ctx, assignment_id)
        keep = set(component_ids)
        now = utcnow()
        kept_ids: set[UUID] = set()
        for row in existing:
            if row.component_id not in keep:
                row.is_deleted = True
                row.deleted_at = now
                row.deleted_by = ctx.user_id
                row.updated_by = ctx.user_id
                row.updated_at = now
                row.version = int(row.version or 1) + 1
            else:
                kept_ids.add(row.component_id)
        for cid in component_ids:
            if cid in kept_ids:
                continue
            self.create(
                ctx,
                company_id=company_id,
                assignment_id=assignment_id,
                component_id=cid,
                issue_status=AssignmentComponentIssueStatus.ISSUED.value,
                issued_at=None,
            )
        self.db.flush()
        return self.list_issued_for_assignment(ctx, assignment_id)

    def mark_issued_at(self, ctx: TenantContext, assignment_id: UUID) -> None:
        rows = self.list_issued_for_assignment(ctx, assignment_id)
        now = utcnow()
        for row in rows:
            if row.issued_at is None:
                row.issued_at = now
                row.updated_by = ctx.user_id
                row.updated_at = now
                row.version = int(row.version or 1) + 1
        if rows:
            self.db.flush()

    def count_issued(self, ctx: TenantContext, assignment_id: UUID) -> int:
        stmt: Select = select(func.count()).select_from(AstAssignmentComponent).where(
            AstAssignmentComponent.assignment_id == assignment_id,
            AstAssignmentComponent.issue_status == AssignmentComponentIssueStatus.ISSUED.value,
            AstAssignmentComponent.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssignmentComponent, ctx, branch_scoped=False)
        return int(self.db.scalar(stmt) or 0)
