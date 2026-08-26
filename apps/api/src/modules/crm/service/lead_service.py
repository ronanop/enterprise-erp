"""Lead application services."""

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.crm.domain.enums import CrmEntityType, LeadStatus
from modules.crm.models import CrmLead
from modules.crm.repository.company_repository import CompanyRepository
from modules.crm.repository.lead_activity_repository import LeadActivityRepository
from modules.crm.repository.lead_assignment_repository import LeadAssignmentRepository
from modules.crm.repository.lead_repository import LeadRepository
from modules.crm.repository.lead_source_repository import LeadSourceRepository
from modules.crm.service.cloud_flow import (
    DEFAULT_DISTRIBUTOR_DISCOUNT_PERCENT,
    cloud_sub_product_label,
    cloud_variant_from_lead,
)
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
from modules.foundation.models.security import SecUser
from modules.foundation.service.audit_service import AuditService
from modules.master_data.models.employee import MasterEmployee
from modules.master_data.repository.employee_repository import EmployeeRepository


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

    def _resolve_owner_employee_id(self, ctx: TenantContext, candidate: UUID | None) -> UUID:
        """Ensure lead owner references a real master_employee row (FK on crm_lead)."""
        repo = EmployeeRepository(self._db)
        if candidate is not None:
            row = repo.get_by_id(ctx, candidate)
            if row is not None:
                return candidate

        linked = repo.get_by_user_id(ctx, ctx.user_id) if ctx.user_id else None
        if linked is not None:
            return linked.id

        user: SecUser | None = None
        if ctx.user_id:
            user = self._db.scalar(
                select(SecUser).where(
                    SecUser.id == ctx.user_id,
                    SecUser.tenant_id == ctx.tenant_id,
                    SecUser.is_deleted.is_(False),
                )
            )

        if user and user.employee_id:
            row = repo.get_by_id(ctx, user.employee_id)
            if row is not None:
                return user.employee_id

        if user and user.email:
            email_row = self._db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.tenant_id == ctx.tenant_id,
                    MasterEmployee.is_deleted.is_(False),
                    func.lower(MasterEmployee.email) == user.email.lower(),
                )
            )
            if email_row is not None:
                if user.employee_id != email_row.id:
                    user.employee_id = email_row.id
                if email_row.user_id != user.id:
                    email_row.user_id = user.id
                    email_row.updated_by = ctx.user_id
                self._db.flush()
                return email_row.id

        company_id = ctx.company_id
        if company_id:
            scoped = repo.list_employees(ctx, company_id=company_id)
            if len(scoped) == 1:
                return scoped[0].id

        scoped = repo.list_employees(ctx)
        if len(scoped) == 1:
            return scoped[0].id

        raise ConflictException(
            "Lead owner must be a valid employee. Select an owner from the list, or ask an admin "
            "to link your login to an employee in master data."
        )

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        fields.pop("owner_employee_id", None)
        fields["owner_employee_id"] = self._resolve_owner_employee_id(ctx, None)
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
        pipeline_id: UUID | None = None,
        opportunity_name: str | None = None,
        expected_revenue: float | None = None,
        existing_customer_id: UUID | None = None,
        create_customer: bool = True,
        remark: str | None = None,
    ):
        lead = self.get(ctx, lead_id)
        if pipeline_id is None:
            from modules.crm.repository.pipeline_repository import PipelineRepository

            pipelines = PipelineRepository(self._db).list_pipelines(ctx, lead.company_id)
            if not pipelines:
                raise ConflictException("No sales pipeline is configured for this company")
            pipeline_id = pipelines[0].id
        resolved_name = (opportunity_name or "").strip() or (
            lead.project_title
            or (f"{lead.first_name} {lead.last_name or ''}".strip() + " — Opportunity")
            or f"{lead.company_name or 'Lead'} — Opportunity"
        )
        resolved_revenue = (
            expected_revenue
            if expected_revenue is not None
            else float(lead.expected_amount or 0)
        )
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
            "opportunity_name": resolved_name,
            "pipeline_id": pipeline_id,
            "owner_employee_id": lead.owner_employee_id,
            "lead_id": lead_id,
            "customer_id": customer_id,
            "expected_revenue": resolved_revenue,
            "expected_close_date": lead.expected_closure_date,
            "probability_percent": lead.engagement_score if lead.engagement_score is not None else 25,
            "current_stage": "qualification",
        }
        # Rule #2: an Opportunity is only ever created "for the sales process"
        # (i.e. blueprint-enabled) via this lead-convert path — direct
        # POST /crm/opportunities calls leave blueprint_state unset.
        if lead.company_account_id is not None:
            opp_fields["company_account_id"] = lead.company_account_id
            opp_fields["blueprint_state"] = "open"
            opp_fields["project_title"] = lead.project_title
            cloud_variant = cloud_variant_from_lead(lead)
            if cloud_variant:
                opp_fields["cloud_blueprint_variant"] = cloud_variant
                opp_fields["product_type"] = lead.product_type
                opp_fields["cloud_sub_product"] = cloud_sub_product_label(lead)
                opp_fields["distributor_discount_percent"] = DEFAULT_DISTRIBUTOR_DISCOUNT_PERCENT
                opp_fields["distributor_discount_locked"] = True

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
