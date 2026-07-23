"""Lead application services."""

from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.crm.domain.enums import CrmEntityType, LeadStatus
from modules.crm.models import CrmLead
from modules.crm.repository.company_repository import CompanyRepository
from modules.crm.repository.lead_activity_repository import LeadActivityRepository
from modules.crm.repository.lead_assignment_repository import LeadAssignmentRepository
from modules.crm.repository.lead_repository import LeadRepository
from modules.crm.repository.lead_source_repository import LeadSourceRepository
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.crm.service.engines import (
    LeadActivityEngine,
    LeadAssignmentEngine,
    LeadEngine,
    sales_blueprint_engine,
)
from modules.crm.service.integration_service import CRMIntegrationService
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class LeadSourceService:
    def __init__(self, db: Session) -> None:
        self._repo = LeadSourceRepository(db)
        self._scope = CrmScopeValidator(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_sources(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Lead source not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.create(ctx, company_id=cid, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Lead source not found")
        return row


class LeadService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = LeadRepository(db)
        self._companies = CompanyRepository(db)
        self._assignments = LeadAssignmentRepository(db)
        self._activities = LeadActivityRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = LeadEngine()
        self._assign_engine = LeadAssignmentEngine()
        self._activity_engine = LeadActivityEngine()
        self._integration = CRMIntegrationService(db)
        self._audit = AuditService(db)

    def list(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        company_account_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_leads(ctx, cid, company_account_id)

    def get(self, ctx: TenantContext, lead_id: UUID) -> CrmLead:
        row = self._repo.get(ctx, lead_id)
        if row is None:
            raise NotFoundException("Lead not found")
        self._ensure_display_snapshot(ctx, row)
        return row

    def _ensure_display_snapshot(self, ctx: TenantContext, lead: CrmLead) -> None:
        """Backfill blank address/entity fields from the linked company account."""
        if lead.company_account_id is None:
            return
        snapshot_keys = (
            "company_name",
            "email",
            "mobile",
            "industry",
            "street",
            "city",
            "state",
            "zip",
            "country",
            "entity_name",
            "entity_email",
            "entity_address",
            "entity_contact",
        )
        if not any(not (getattr(lead, key, None) or "").strip() for key in snapshot_keys):
            return
        account = self._companies.get(ctx, lead.company_account_id)
        if account is None:
            return
        billing_address = ", ".join(
            str(value)
            for value in (
                account.billing_street,
                account.billing_city,
                account.billing_state,
                account.billing_code,
                account.billing_country,
            )
            if value
        )
        patches = {
            "company_name": account.customer_name,
            "email": account.customer_email,
            "mobile": account.phone,
            "industry": account.industry,
            "street": account.billing_street,
            "city": account.billing_city,
            "state": account.billing_state,
            "zip": account.billing_code,
            "country": account.billing_country,
            "entity_name": account.customer_name,
            "entity_email": account.customer_email,
            "entity_address": billing_address or None,
            "entity_contact": account.phone,
        }
        patched = False
        for key, value in patches.items():
            current = getattr(lead, key, None)
            if (not current or not str(current).strip()) and value:
                setattr(lead, key, value)
                patched = True
        if patched:
            self._db.flush()

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        code = self._numbers.generate(CrmEntityType.LEAD, cid, CrmLead, "lead_code")
        fields.setdefault("document_date", date.today())
        fields.setdefault("status", LeadStatus.NEW.value)
        row = self._repo.create(ctx, company_id=cid, branch_id=branch_id, lead_code=code, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="crm_lead",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, lead_id: UUID, **fields):
        self.get(ctx, lead_id)
        row = self._repo.update(ctx, lead_id, **fields)
        if row is None:
            raise NotFoundException("Lead not found")
        return row

    def assign(
        self,
        ctx: TenantContext,
        lead_id: UUID,
        *,
        to_employee_id: UUID,
        assignment_type: str = "manual",
        assignment_reason: str | None = None,
        from_employee_id: UUID | None = None,
    ):
        lead = self.get(ctx, lead_id)
        self._engine.apply_assign(lead)
        for existing in self._assignments.list_assignments(ctx, lead.company_id):
            if existing.lead_id == lead_id and existing.status == "active":
                self._assign_engine.supersede(existing)
        assignment = self._assignments.create(
            ctx,
            company_id=lead.company_id,
            branch_id=lead.branch_id,
            lead_id=lead_id,
            assignment_type=assignment_type,
            to_employee_id=to_employee_id,
            from_employee_id=from_employee_id or lead.owner_employee_id,
            assigned_at=datetime.now(timezone.utc),
            assignment_reason=assignment_reason,
            status="active",
        )
        self._repo.update(ctx, lead_id, owner_employee_id=to_employee_id, status=LeadStatus.ASSIGNED.value)
        return assignment

    def convert(
        self,
        ctx: TenantContext,
        lead_id: UUID,
        *,
        pipeline_id: UUID,
        opportunity_name: str,
        expected_revenue: float = 0,
        existing_customer_id: UUID | None = None,
        create_customer: bool = True,
        remark: str | None = None,
    ):
        lead = self.get(ctx, lead_id)
        if lead.company_account_id is not None:
            # Sales-blueprint lead (rule #1/#2): lifecycle is governed by
            # ``blueprint_state``, not the legacy ``status`` qualification
            # gate — only require it to still be in the initial "open" state
            # and unlocked.
            if lead.blueprint_state != "open":
                raise ConflictException(
                    f"Lead is in blueprint state '{lead.blueprint_state}'; only an 'open' "
                    "sales lead can be converted"
                )
            sales_blueprint_engine.assert_not_locked(lead)
        else:
            self._engine.validate_convertible(lead)
        customer_id = existing_customer_id or lead.customer_id
        # ``crm_company`` is an optional, non-duplicate link to
        # ``master_customer`` (per the sales-account spec) — sales-blueprint
        # leads therefore don't auto-create a master_customer on convert;
        # legacy (non-blueprint) leads keep the previous auto-create-customer
        # behaviour for backward compatibility.
        if create_customer and customer_id is None and lead.company_account_id is None:
            customer = self._integration.convert_lead_to_customer(ctx, lead_id)
            customer_id = customer.id
            lead = self.get(ctx, lead_id)
        from modules.crm.service.opportunity_service import OpportunityService

        opp_svc = OpportunityService(self._db)
        opp_fields = {
            "branch_id": lead.branch_id,
            "company_id": lead.company_id,
            "opportunity_name": opportunity_name or lead.project_title or f"{lead.company_name} — Opportunity",
            "pipeline_id": pipeline_id,
            "owner_employee_id": lead.owner_employee_id,
            "lead_id": lead_id,
            "customer_id": customer_id,
            "expected_revenue": expected_revenue or lead.expected_amount or 0,
            "expected_close_date": lead.expected_closure_date,
            "probability_percent": 25,
            "current_stage": "qualification",
        }
        # Rule #2: an Opportunity is only ever created "for the sales process"
        # (i.e. blueprint-enabled) via this lead-convert path — direct
        # POST /crm/opportunities calls leave blueprint_state unset.
        if lead.company_account_id is not None:
            opp_fields["company_account_id"] = lead.company_account_id
            opp_fields["blueprint_state"] = "open"
            opp_fields["project_title"] = lead.project_title

        opportunity = opp_svc.create(ctx, **opp_fields)
        now = datetime.now(timezone.utc)
        if lead.company_account_id is None:
            self._engine.apply_convert(lead)
        self._repo.update(
            ctx,
            lead_id,
            status=LeadStatus.CONVERTED.value,
            blueprint_state="converted",
            converted_opportunity_id=opportunity.id,
            converted_at=now,
            customer_id=customer_id,
            convert_remark=remark,
        )
        return opportunity

    def mark_lost(self, ctx: TenantContext, lead_id: UUID, *, reason: str | None = None) -> CrmLead:
        lead = self.get(ctx, lead_id)
        if lead.status in {LeadStatus.CONVERTED.value, LeadStatus.LOST.value}:
            raise ConflictException("Lead is already converted or lost")
        sales_blueprint_engine.assert_not_locked(lead)
        row = self._repo.update(
            ctx,
            lead_id,
            status=LeadStatus.LOST.value,
            blueprint_state="lost",
            lost_reason=reason,
        )
        if row is None:
            raise NotFoundException("Lead not found")
        return row

    def add_activity(self, ctx: TenantContext, lead_id: UUID, **fields):
        lead = self.get(ctx, lead_id)
        return self._activities.create(
            ctx,
            company_id=lead.company_id,
            branch_id=lead.branch_id,
            lead_id=lead_id,
            **fields,
        )


class LeadAssignmentService:
    def __init__(self, db: Session) -> None:
        self._repo = LeadAssignmentRepository(db)
        self._scope = CrmScopeValidator(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_assignments(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Lead assignment not found")
        return row


class LeadActivityService:
    def __init__(self, db: Session) -> None:
        self._repo = LeadActivityRepository(db)
        self._scope = CrmScopeValidator(db)
        self._engine = LeadActivityEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_activities(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Lead activity not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.create(ctx, company_id=cid, **fields)

    def complete(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.complete(row)
        return self._repo.update(ctx, row_id, status="completed")
