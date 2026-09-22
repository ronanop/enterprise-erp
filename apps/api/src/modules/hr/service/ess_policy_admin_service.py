"""HR admin service for ESS policy documents."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.models.ess_policy import HrEssPolicy
from modules.hr.service.hr_scope_validator import HrScopeValidator


class EssPolicyAdminService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._scope = HrScopeValidator(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return list(
            self._db.scalars(
                select(HrEssPolicy)
                .where(
                    HrEssPolicy.tenant_id == ctx.tenant_id,
                    HrEssPolicy.company_id == cid,
                    HrEssPolicy.is_deleted.is_(False),
                )
                .order_by(HrEssPolicy.display_order, HrEssPolicy.title)
            ).all()
        )

    def get(self, ctx: TenantContext, row_id: UUID) -> HrEssPolicy:
        row = self._db.get(HrEssPolicy, row_id)
        if row is None or row.is_deleted or row.tenant_id != ctx.tenant_id:
            raise NotFoundException("ESS policy not found")
        self._scope.validate_company_access(ctx, row.company_id)
        return row

    def create(self, ctx: TenantContext, *, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        code = fields.pop("policy_code", None)
        if not code:
            raise ConflictException("policy_code is required")
        existing = self._db.scalar(
            select(HrEssPolicy).where(
                HrEssPolicy.company_id == cid,
                HrEssPolicy.policy_code == code,
                HrEssPolicy.is_deleted.is_(False),
            )
        )
        if existing:
            raise ConflictException("Policy code already exists")
        row = HrEssPolicy(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=cid,
            policy_code=code,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            status=fields.pop("status", "draft"),
            **fields,
        )
        self._db.add(row)
        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_ess_policy",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        content = fields.get("content_markdown")
        bump = (
            content is not None
            and content != row.content_markdown
            and row.status == "published"
        )
        for key, val in fields.items():
            if val is not None:
                setattr(row, key, val)
        if bump:
            row.policy_version = int(row.policy_version or 1) + 1
            row.published_at = datetime.now(timezone.utc)
        row.updated_by = ctx.user_id
        self._db.flush()
        return row

    def publish(self, ctx: TenantContext, row_id: UUID) -> HrEssPolicy:
        row = self.get(ctx, row_id)
        if row.status == "archived":
            raise ConflictException("Cannot publish archived policy")
        if row.status == "published":
            row.policy_version = int(row.policy_version or 1) + 1
        else:
            row.status = "published"
            if not row.policy_version:
                row.policy_version = 1
        row.published_at = datetime.now(timezone.utc)
        row.updated_by = ctx.user_id
        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_ess_policy",
            entity_id=row.id,
            operation="publish",
            performed_by=ctx.user_id,
            new_value={"policy_version": row.policy_version},
        )
        return row

    def archive(self, ctx: TenantContext, row_id: UUID) -> HrEssPolicy:
        row = self.get(ctx, row_id)
        row.status = "archived"
        row.updated_by = ctx.user_id
        self._db.flush()
        return row
