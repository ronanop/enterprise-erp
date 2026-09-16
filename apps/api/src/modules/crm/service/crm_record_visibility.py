"""CRM record visibility - non-admins only see records they created (and downstream).

Admins / ERP admins see everything. Assignees with a pending My Jobs approval
on an entity may read that entity even if they did not create it.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.crm.models import CrmApprovalTask, CrmCompany, CrmLead, CrmOpportunity, CrmOvf, CrmQuote
from modules.crm.service.crm_module_admin import CrmModuleAdminService
from modules.foundation.domain.value_objects import TenantContext


class CrmRecordVisibility:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._admin = CrmModuleAdminService(db)

    def is_admin(self, ctx: TenantContext) -> bool:
        return self._admin.is_admin(ctx)

    def requires_creator_scope(self, ctx: TenantContext) -> bool:
        return not self.is_admin(ctx)

    def current_user_id(self, ctx: TenantContext) -> UUID | None:
        return ctx.user_id

    def has_pending_approval_on(
        self,
        ctx: TenantContext,
        *,
        entity_type: str,
        entity_id: UUID,
    ) -> bool:
        if ctx.user_id is None:
            return False
        stmt = select(CrmApprovalTask.id).where(
            CrmApprovalTask.tenant_id == ctx.tenant_id,
            CrmApprovalTask.is_deleted.is_(False),
            CrmApprovalTask.status == "pending",
            CrmApprovalTask.entity_type == entity_type,
            CrmApprovalTask.entity_id == entity_id,
            CrmApprovalTask.assigned_user_id == ctx.user_id,
        )
        return self._db.scalar(stmt) is not None

    def ensure_lead_access(self, ctx: TenantContext, lead: CrmLead) -> None:
        if self.is_admin(ctx):
            return
        if ctx.user_id is None or lead.created_by != ctx.user_id:
            raise ForbiddenException("You can only access leads you created")

    def can_access_opportunity(self, ctx: TenantContext, opp: CrmOpportunity) -> bool:
        if self.is_admin(ctx):
            return True
        if ctx.user_id is None:
            return False
        if opp.created_by == ctx.user_id:
            return True
        if opp.lead_id is not None:
            lead = self._db.scalar(
                select(CrmLead).where(
                    CrmLead.id == opp.lead_id,
                    CrmLead.is_deleted.is_(False),
                    CrmLead.tenant_id == ctx.tenant_id,
                )
            )
            if lead is not None and lead.created_by == ctx.user_id:
                return True
        if self.has_pending_approval_on(ctx, entity_type="opportunity", entity_id=opp.id):
            return True
        return False

    def ensure_opportunity_access(self, ctx: TenantContext, opp: CrmOpportunity) -> None:
        if not self.can_access_opportunity(ctx, opp):
            raise ForbiddenException("You can only access opportunities from leads you created")

    def can_access_quote(self, ctx: TenantContext, quote: CrmQuote) -> bool:
        if self.is_admin(ctx):
            return True
        if ctx.user_id is None:
            return False
        if quote.created_by == ctx.user_id:
            return True
        opp = self._db.scalar(
            select(CrmOpportunity).where(
                CrmOpportunity.id == quote.opportunity_id,
                CrmOpportunity.is_deleted.is_(False),
                CrmOpportunity.tenant_id == ctx.tenant_id,
            )
        )
        if opp is not None and self.can_access_opportunity(ctx, opp):
            return True
        if self.has_pending_approval_on(ctx, entity_type="quote", entity_id=quote.id):
            return True
        return False

    def ensure_quote_access(self, ctx: TenantContext, quote: CrmQuote) -> None:
        if not self.can_access_quote(ctx, quote):
            raise ForbiddenException("You can only access quotes from opportunities you created")

    def can_access_ovf(self, ctx: TenantContext, ovf: CrmOvf) -> bool:
        if self.is_admin(ctx):
            return True
        if ctx.user_id is None:
            return False
        if ovf.created_by == ctx.user_id:
            return True
        opp = self._db.scalar(
            select(CrmOpportunity).where(
                CrmOpportunity.id == ovf.opportunity_id,
                CrmOpportunity.is_deleted.is_(False),
                CrmOpportunity.tenant_id == ctx.tenant_id,
            )
        )
        if opp is not None and self.can_access_opportunity(ctx, opp):
            return True
        if self.has_pending_approval_on(ctx, entity_type="ovf", entity_id=ovf.id):
            return True
        return False

    def ensure_ovf_access(self, ctx: TenantContext, ovf: CrmOvf) -> None:
        if not self.can_access_ovf(ctx, ovf):
            raise ForbiddenException("You can only access OVFs from opportunities you created")

    def can_access_company(self, ctx: TenantContext, company: CrmCompany) -> bool:
        if self.is_admin(ctx):
            return True
        if ctx.user_id is None:
            return False
        if company.created_by == ctx.user_id:
            return True
        # Visible if the user created a lead (or opportunity) under this account.
        lead_hit = self._db.scalar(
            select(CrmLead.id).where(
                CrmLead.company_account_id == company.id,
                CrmLead.created_by == ctx.user_id,
                CrmLead.is_deleted.is_(False),
                CrmLead.tenant_id == ctx.tenant_id,
            ).limit(1)
        )
        if lead_hit is not None:
            return True
        opp_hit = self._db.scalar(
            select(CrmOpportunity.id).where(
                CrmOpportunity.company_account_id == company.id,
                CrmOpportunity.created_by == ctx.user_id,
                CrmOpportunity.is_deleted.is_(False),
                CrmOpportunity.tenant_id == ctx.tenant_id,
            ).limit(1)
        )
        return opp_hit is not None

    def ensure_company_access(self, ctx: TenantContext, company: CrmCompany) -> None:
        if not self.can_access_company(ctx, company):
            raise ForbiddenException("You can only access company accounts you created or use")

    def filter_opportunity_ids_for_user(self, ctx: TenantContext, company_id: UUID) -> list[UUID] | None:
        """Return allowed opportunity ids for non-admins, or None when admin (no filter)."""
        if self.is_admin(ctx):
            return None
        if ctx.user_id is None:
            return []
        # Opportunities the user created.
        created = list(
            self._db.scalars(
                select(CrmOpportunity.id).where(
                    CrmOpportunity.company_id == company_id,
                    CrmOpportunity.is_deleted.is_(False),
                    CrmOpportunity.created_by == ctx.user_id,
                )
            ).all()
        )
        # Opportunities from leads the user created.
        from_leads = list(
            self._db.scalars(
                select(CrmOpportunity.id)
                .join(CrmLead, CrmLead.id == CrmOpportunity.lead_id)
                .where(
                    CrmOpportunity.company_id == company_id,
                    CrmOpportunity.is_deleted.is_(False),
                    CrmLead.is_deleted.is_(False),
                    CrmLead.created_by == ctx.user_id,
                )
            ).all()
        )
        # Pending approval assignments.
        approval_ids = list(
            self._db.scalars(
                select(CrmApprovalTask.entity_id).where(
                    CrmApprovalTask.tenant_id == ctx.tenant_id,
                    CrmApprovalTask.is_deleted.is_(False),
                    CrmApprovalTask.status == "pending",
                    CrmApprovalTask.entity_type == "opportunity",
                    CrmApprovalTask.assigned_user_id == ctx.user_id,
                    CrmApprovalTask.company_id == company_id,
                )
            ).all()
        )
        return list({*created, *from_leads, *approval_ids})

    def filter_quote_scope(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[list[UUID] | None, UUID | None, list[UUID]]:
        """Returns (opportunity_ids|None for admin, created_by filter, approval quote ids)."""
        if self.is_admin(ctx):
            return None, None, []
        if ctx.user_id is None:
            return [], None, []
        opp_ids = self.filter_opportunity_ids_for_user(ctx, company_id) or []
        approval_quote_ids = list(
            self._db.scalars(
                select(CrmApprovalTask.entity_id).where(
                    CrmApprovalTask.tenant_id == ctx.tenant_id,
                    CrmApprovalTask.is_deleted.is_(False),
                    CrmApprovalTask.status == "pending",
                    CrmApprovalTask.entity_type == "quote",
                    CrmApprovalTask.assigned_user_id == ctx.user_id,
                    CrmApprovalTask.company_id == company_id,
                )
            ).all()
        )
        return opp_ids, ctx.user_id, approval_quote_ids

    def filter_ovf_scope(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[list[UUID] | None, UUID | None, list[UUID]]:
        if self.is_admin(ctx):
            return None, None, []
        if ctx.user_id is None:
            return [], None, []
        opp_ids = self.filter_opportunity_ids_for_user(ctx, company_id) or []
        approval_ovf_ids = list(
            self._db.scalars(
                select(CrmApprovalTask.entity_id).where(
                    CrmApprovalTask.tenant_id == ctx.tenant_id,
                    CrmApprovalTask.is_deleted.is_(False),
                    CrmApprovalTask.status == "pending",
                    CrmApprovalTask.entity_type == "ovf",
                    CrmApprovalTask.assigned_user_id == ctx.user_id,
                    CrmApprovalTask.company_id == company_id,
                )
            ).all()
        )
        return opp_ids, ctx.user_id, approval_ovf_ids

    def company_account_ids_for_user(self, ctx: TenantContext, company_id: UUID) -> list[UUID] | None:
        """Allowed sales-account ids for non-admins, or None when admin."""
        if self.is_admin(ctx):
            return None
        if ctx.user_id is None:
            return []
        created = list(
            self._db.scalars(
                select(CrmCompany.id).where(
                    CrmCompany.company_id == company_id,
                    CrmCompany.is_deleted.is_(False),
                    CrmCompany.created_by == ctx.user_id,
                )
            ).all()
        )
        from_leads = list(
            self._db.scalars(
                select(CrmLead.company_account_id).where(
                    CrmLead.company_id == company_id,
                    CrmLead.is_deleted.is_(False),
                    CrmLead.created_by == ctx.user_id,
                    CrmLead.company_account_id.is_not(None),
                )
            ).all()
        )
        from_opps = list(
            self._db.scalars(
                select(CrmOpportunity.company_account_id).where(
                    CrmOpportunity.company_id == company_id,
                    CrmOpportunity.is_deleted.is_(False),
                    CrmOpportunity.created_by == ctx.user_id,
                    CrmOpportunity.company_account_id.is_not(None),
                )
            ).all()
        )
        ids = {cid for cid in (*created, *from_leads, *from_opps) if cid is not None}
        return list(ids)

    def filter_created_rows(self, ctx: TenantContext, rows: list) -> list:
        if self.is_admin(ctx):
            return rows
        if ctx.user_id is None:
            return []
        return [row for row in rows if getattr(row, "created_by", None) == ctx.user_id]

    def ensure_created_access(self, ctx: TenantContext, row, *, label: str = "record") -> None:
        if self.is_admin(ctx):
            return
        if ctx.user_id is None or getattr(row, "created_by", None) != ctx.user_id:
            raise ForbiddenException(f"You can only access {label}s you created")
