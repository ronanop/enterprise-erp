"""Marketing campaign service."""

from __future__ import annotations

import re
from datetime import date, datetime, time, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.erp_modules import (
    MARKETING_ROLE_APPROVAL_HEAD,
    MARKETING_ROLE_CONTENT_CREATOR,
    MARKETING_ROLE_GRAPHIC_DESIGNER,
    MARKETING_ROLE_SUPPORTING_MEMBER,
    MARKETING_ROLE_VIDEO_EDITOR,
    MODULE_ROLE_MEMBER,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.repository.user_module_repository import UserModuleRepository
from modules.foundation.service.audit_service import AuditService
from modules.marketing.adapters.crm_port import CrmCampaignPort
from modules.marketing.domain.enums import CampaignStatus
from modules.marketing.domain.exceptions import NotFoundException, ValidationException
from modules.marketing.models import MktCampaign, MktTask
from modules.marketing.repository.base import MktScopedRepository
from modules.marketing.service.number_service import MarketingNumberService
from modules.marketing.service.ops_service import M365Service, TaskService

CONTENT_PROVIDER_ROLES = frozenset({MARKETING_ROLE_CONTENT_CREATOR})
APPROVAL_HEAD_ROLES = frozenset({MARKETING_ROLE_APPROVAL_HEAD})
EDITOR_ROLES = frozenset(
    {
        MARKETING_ROLE_VIDEO_EDITOR,
        MARKETING_ROLE_GRAPHIC_DESIGNER,
        MARKETING_ROLE_SUPPORTING_MEMBER,
    }
)


def _slug_deliverable_type(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")
    if not cleaned:
        raise ValidationException("Deliverable type is required")
    return cleaned[:40]


def _title_from_type(deliverable_type: str) -> str:
    return deliverable_type.replace("_", " ").strip().title()


def _uuid_from_meta(meta: dict, key: str) -> UUID | None:
    raw = meta.get(key)
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


class CampaignService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)
        self._numbers = MarketingNumberService(db)
        self._crm = CrmCampaignPort(db)
        self._audit = AuditService(db)
        self._modules = UserModuleRepository(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktCampaign, ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> MktCampaign:
        row = self._repo.get_by_id(MktCampaign, ctx, row_id)
        if row is None:
            raise NotFoundException("Campaign not found")
        return row

    def create(self, ctx: TenantContext, **fields) -> MktCampaign:
        from modules.marketing.service.role_access import ensure_can_create_campaign

        ensure_can_create_campaign(self.db, ctx)
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        crm_id = fields.get("crm_campaign_id")
        if crm_id and not self._crm.exists(ctx.tenant_id, crm_id):
            raise ValidationException("Linked CRM campaign not found for tenant")
        code = self._numbers.next_code(MktCampaign, company_id, "campaign_code", "MKT")
        fields.setdefault("status", CampaignStatus.DRAFT.value)
        fields.setdefault("owner_user_id", ctx.user_id)
        row = self._repo.create_row(
            MktCampaign,
            ctx,
            company_id=company_id,
            campaign_code=code,
            **fields,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="mkt_campaign",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"campaign_code": row.campaign_code, "campaign_name": row.campaign_name},
        )
        M365Service(self.db).provision_for_campaign(ctx, row)
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktCampaign:
        crm_id = fields.get("crm_campaign_id")
        if crm_id and not self._crm.exists(ctx.tenant_id, crm_id):
            raise ValidationException("Linked CRM campaign not found for tenant")
        row = self._repo.update_row(MktCampaign, ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Campaign not found")
        return row

    def activate(self, ctx: TenantContext, row_id: UUID) -> MktCampaign:
        return self.update(ctx, row_id, status=CampaignStatus.ACTIVE.value)

    def list_team_members(self, ctx: TenantContext) -> list[dict]:
        """Marketing module roster for deliverable assignment dropdowns."""
        from modules.marketing.service.role_access import ensure_can_manage_deliverables

        ensure_can_manage_deliverables(self.db, ctx)
        rows = self._modules.list_rows_for_module(ctx.tenant_id, "marketing")
        if not rows:
            return []
        user_ids = [row.user_id for row in rows]
        users = {
            u.id: u
            for u in self.db.scalars(
                select(SecUser).where(
                    SecUser.tenant_id == ctx.tenant_id,
                    SecUser.id.in_(user_ids),
                    SecUser.is_deleted.is_(False),
                    SecUser.status == "active",
                )
            ).all()
        }
        out: list[dict] = []
        for row in rows:
            user = users.get(row.user_id)
            if user is None:
                continue
            out.append(
                {
                    "user_id": user.id,
                    "display_name": user.display_name,
                    "email": user.email,
                    "role": row.role or MODULE_ROLE_MEMBER,
                }
            )
        out.sort(key=lambda item: (str(item["role"]), str(item["display_name"]).lower()))
        return out

    def list_deliverables(self, ctx: TenantContext, campaign_id: UUID) -> list[MktTask]:
        campaign = self.get(ctx, campaign_id)
        rows = TaskService(self.db).list(
            ctx,
            campaign.company_id,
            campaign_id=campaign_id,
            deliverables_only=True,
        )
        return sorted(
            rows,
            key=lambda r: (r.due_at is None, r.due_at or datetime.min.replace(tzinfo=timezone.utc), r.title),
        )

    def create_deliverable(
        self,
        ctx: TenantContext,
        campaign_id: UUID,
        *,
        deliverable_type: str,
        due_date: date,
        title: str | None = None,
        notes: str | None = None,
        content_provider_user_id: UUID | None = None,
        approval_head_user_id: UUID | None = None,
        editor_user_id: UUID | None = None,
    ) -> MktTask:
        from modules.marketing.service.role_access import ensure_can_manage_deliverables

        ensure_can_manage_deliverables(self.db, ctx)
        campaign = self.get(ctx, campaign_id)
        dtype = _slug_deliverable_type(deliverable_type)
        resolved_title = (title or "").strip() or _title_from_type(dtype)
        due_at = datetime.combine(due_date, time(23, 59, 59), tzinfo=timezone.utc)

        content_provider = self._resolve_assignee(
            ctx,
            content_provider_user_id,
            allowed_roles=CONTENT_PROVIDER_ROLES,
            label="Content provider",
        )
        approval_head = self._resolve_assignee(
            ctx,
            approval_head_user_id,
            allowed_roles=APPROVAL_HEAD_ROLES,
            label="Approval head",
        )
        editor = self._resolve_assignee(
            ctx,
            editor_user_id,
            allowed_roles=EDITOR_ROLES,
            label="Editor",
        )

        metadata = {
            "is_deliverable": True,
            "deliverable_type": dtype,
            "content_provider_user_id": str(content_provider["user_id"]) if content_provider else None,
            "content_provider_name": content_provider["display_name"] if content_provider else None,
            "approval_head_user_id": str(approval_head["user_id"]) if approval_head else None,
            "approval_head_name": approval_head["display_name"] if approval_head else None,
            "editor_user_id": str(editor["user_id"]) if editor else None,
            "editor_name": editor["display_name"] if editor else None,
        }

        return TaskService(self.db).create(
            ctx,
            company_id=campaign.company_id,
            branch_id=campaign.branch_id,
            campaign_id=campaign.id,
            title=resolved_title,
            description=notes,
            task_kind=dtype,
            due_at=due_at,
            owner_user_id=content_provider["user_id"] if content_provider else ctx.user_id,
            assignee_user_id=editor["user_id"] if editor else None,
            reviewer_user_id=approval_head["user_id"] if approval_head else None,
            metadata_json=metadata,
            status="assigned" if editor else "draft",
        )

    def _resolve_assignee(
        self,
        ctx: TenantContext,
        user_id: UUID | None,
        *,
        allowed_roles: frozenset[str],
        label: str,
    ) -> dict | None:
        if user_id is None:
            return None
        assignment = self._modules.get_assignment(ctx.tenant_id, user_id, "marketing")
        if assignment is None:
            raise ValidationException(f"{label} must be a Marketing module member")
        role = assignment.role or MODULE_ROLE_MEMBER
        if role not in allowed_roles:
            allowed = ", ".join(sorted(allowed_roles))
            raise ValidationException(f"{label} must have one of these roles: {allowed}")
        user = self.db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.id == user_id,
                SecUser.is_deleted.is_(False),
            )
        )
        if user is None or user.status != "active":
            raise ValidationException(f"{label} user was not found or is inactive")
        return {
            "user_id": user.id,
            "display_name": user.display_name,
            "email": user.email,
            "role": role,
        }

    @staticmethod
    def deliverable_payload(row: MktTask) -> dict:
        due = row.due_at.date() if row.due_at else None
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        return {
            "id": row.id,
            "campaign_id": row.campaign_id,
            "deliverable_code": row.task_code,
            "title": row.title,
            "deliverable_type": row.task_kind,
            "due_date": due,
            "status": row.status,
            "notes": row.description,
            "content_provider_user_id": _uuid_from_meta(meta, "content_provider_user_id") or row.owner_user_id,
            "content_provider_name": meta.get("content_provider_name"),
            "approval_head_user_id": _uuid_from_meta(meta, "approval_head_user_id") or row.reviewer_user_id,
            "approval_head_name": meta.get("approval_head_name"),
            "editor_user_id": _uuid_from_meta(meta, "editor_user_id") or row.assignee_user_id,
            "editor_name": meta.get("editor_name"),
        }
