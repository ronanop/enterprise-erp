"""Lead application services."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException, ForbiddenException, NotFoundException
from security.field_crypto import pii_lookup
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
from modules.crm.service.crm_module_admin import CrmModuleAdminService
from modules.crm.service.crm_record_visibility import CrmRecordVisibility
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
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.master_data.published import EmployeeCommands, EmployeeRead
from modules.master_data.repository.employee_repository import EmployeeRepository


def _lead_product_types(lead: CrmLead) -> list[str]:
    raw = (lead.product_type or "").replace("&", ",")
    out: list[str] = []
    for part in raw.split(","):
        name = part.strip()
        if not name or name in out:
            continue
        out.append(name)
    return out


def _parse_presales_by_product(raw: str | None) -> dict[str, dict]:
    if not (raw or "").strip():
        return {}
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}
    if not isinstance(parsed, dict):
        return {}
    out: dict[str, dict] = {}
    for key, value in parsed.items():
        product = str(key or "").strip()
        if not product or not isinstance(value, dict):
            continue
        aligned = value.get("aligned")
        if aligned is not True and aligned is not False:
            aligned = None
        out[product] = {
            "aligned": aligned,
            "contact_name": str(value.get("contact_name") or "").strip(),
        }
    return out


def _presales_ready_from_map(product_types: list[str], by_product: dict[str, dict]) -> bool:
    if not product_types:
        return False
    for product in product_types:
        entry = by_product.get(product) or {}
        if entry.get("aligned") is not True:
            return False
        if not str(entry.get("contact_name") or "").strip():
            return False
    return True


class LeadSourceService:
    def __init__(self, db: Session) -> None:
        self._repo = LeadSourceRepository(db)
        self._scope = CrmScopeValidator(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_list_company_id(ctx, company_id)
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
        self._audit = PlatformAuditFacade(db)
        self._crm_admin = CrmModuleAdminService(db)
        self._visibility = CrmRecordVisibility(db)

    def list(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        company_account_id: UUID | None = None,
    ):
        cid = self._scope.resolve_list_company_id(ctx, company_id)
        created_by: UUID | None = None
        if self._visibility.requires_creator_scope(ctx):
            created_by = self._visibility.current_user_id(ctx)
            if created_by is None:
                return []
        rows = self._repo.list_leads(
            ctx, cid, company_account_id, created_by=created_by
        )
        # Convert any open sales leads that already have required BOQ/SOW attached
        # (covers cases where My Jobs finished before auto-convert was deployed).
        convert_ids: list[UUID] = []
        for lead in rows:
            if lead.company_account_id is None or lead.blueprint_state != "open":
                continue
            # Heal orphan opportunities first (partial convert left lead open).
            if self._find_existing_convert_opportunity(lead) is not None:
                convert_ids.append(lead.id)
                continue
            if (
                self._presales_call_ready(lead)
                and (bool(lead.requires_boq) or bool(lead.requires_sow))
                and not self._lead_docs_pending(lead)
            ):
                convert_ids.append(lead.id)
        converted_ids: set[UUID] = set()
        for lead_id in convert_ids:
            try:
                # convert() itself heals existing opps; maybe_auto_convert covers docs-ready.
                self.convert(ctx, lead_id)
                converted_ids.add(lead_id)
            except Exception:
                # Failed convert must not poison this request's session.
                self._db.rollback()
                continue
        if converted_ids:
            rows = self._repo.list_leads(
                ctx, cid, company_account_id, created_by=created_by
            )
            rows = [lead for lead in rows if lead.id not in converted_ids]
        return rows

    def get(self, ctx: TenantContext, lead_id: UUID) -> CrmLead:
        row = self._repo.get(ctx, lead_id)
        if row is None:
            raise NotFoundException("Lead not found")
        self._visibility.ensure_lead_access(ctx, row)
        self._ensure_display_snapshot(ctx, row)
        return row

    def _current_employee_id(self, ctx: TenantContext) -> UUID | None:
        try:
            return self._resolve_owner_employee_id(ctx, None)
        except ConflictException:
            return None

    def _ensure_lead_owner_or_admin(self, ctx: TenantContext, lead: CrmLead) -> None:
        """Backward-compatible alias - visibility is creator-based for non-admins."""
        self._visibility.ensure_lead_access(ctx, lead)
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
                select(EmployeeRead).where(
                    EmployeeRead.tenant_id == ctx.tenant_id,
                    EmployeeRead.is_deleted.is_(False),
                    EmployeeRead.email_lookup == pii_lookup(user.email),
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

        if user is not None:
            provisioned = self._ensure_employee_for_user(ctx, user)
            if provisioned is not None:
                return provisioned

        raise ConflictException(
            "Lead owner must be a valid employee. Select an owner from the list, or ask an admin "
            "to link your login to an employee in master data."
        )

    def _ensure_employee_for_user(self, ctx: TenantContext, user: SecUser) -> UUID | None:
        """Create/link a master employee so CRM users can own leads without admin prep."""
        from uuid import uuid4

        from modules.organization.models.branch import OrgBranch
        from modules.organization.models.hierarchy import OrgDepartment

        company_id = ctx.company_id
        if company_id is None:
            return None

        branch_id = ctx.branch_id
        if branch_id is None:
            branch = self._db.scalar(
                select(OrgBranch)
                .where(
                    OrgBranch.tenant_id == ctx.tenant_id,
                    OrgBranch.company_id == company_id,
                    OrgBranch.is_deleted.is_(False),
                )
                .order_by(OrgBranch.branch_code)
                .limit(1)
            )
            if branch is None:
                return None
            branch_id = branch.id

        department = self._db.scalar(
            select(OrgDepartment)
            .where(
                OrgDepartment.tenant_id == ctx.tenant_id,
                OrgDepartment.company_id == company_id,
                OrgDepartment.branch_id == branch_id,
                OrgDepartment.is_deleted.is_(False),
            )
            .order_by(OrgDepartment.department_code)
            .limit(1)
        )
        if department is None:
            department = self._db.scalar(
                select(OrgDepartment)
                .where(
                    OrgDepartment.tenant_id == ctx.tenant_id,
                    OrgDepartment.company_id == company_id,
                    OrgDepartment.is_deleted.is_(False),
                )
                .order_by(OrgDepartment.department_code)
                .limit(1)
            )
        if department is None:
            return None

        email = (user.email or "").strip().lower()
        if not email:
            email = f"crm-user-{user.id}@local.invalid"

        existing = self._db.scalar(
            select(EmployeeRead).where(
                EmployeeRead.tenant_id == ctx.tenant_id,
                EmployeeRead.company_id == company_id,
                EmployeeRead.is_deleted.is_(False),
                EmployeeRead.email_lookup == pii_lookup(email),
            )
        )
        if existing is not None:
            if user.employee_id != existing.id:
                user.employee_id = existing.id
            EmployeeCommands(self._db).link_user(existing.id, user.id, updated_by=ctx.user_id)
            self._db.flush()
            return existing.id

        display = (user.display_name or email.split("@", 1)[0] or "CRM User").strip()
        parts = display.split(None, 1)
        first_name = (parts[0] if parts else "CRM")[:100]
        last_name = (parts[1] if len(parts) > 1 else "User")[:100]
        employee_code = f"CRM-{str(user.id).replace('-', '')[:12].upper()}"

        code_taken = self._db.scalar(
            select(EmployeeRead.id).where(
                EmployeeRead.tenant_id == ctx.tenant_id,
                EmployeeRead.company_id == company_id,
                EmployeeRead.employee_code == employee_code,
                EmployeeRead.is_deleted.is_(False),
            )
        )
        if code_taken is not None:
            employee_code = f"CRM-{uuid4().hex[:12].upper()}"

        # Insert employee before linking sec_user.employee_id (FK order).
        employee_id = EmployeeCommands(self._db).create_system_employee(
            created_by=ctx.user_id,
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            department_id=department.id,
            employee_code=employee_code,
            first_name=first_name,
            last_name=last_name,
            email=email,
            mobile="0000000000",
            designation="CRM Owner",
            date_of_joining=date.today(),
            status="active",
            user_id=user.id,
        )
        user.employee_id = employee_id
        self._db.flush()
        return employee_id

    def peek_next_dr_number(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        entity_name: str | None = None,
    ) -> str:
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._numbers.next_deal_reg_number(cid, entity_name=entity_name)

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        owner_candidate = fields.pop("owner_employee_id", None)
        fields["owner_employee_id"] = self._resolve_owner_employee_id(ctx, owner_candidate)
        # Sales leads use the DR number as their unique ID from create; other leads keep LEAD-.
        fields.pop("dr_number", None)
        fields.pop("new_dr_number", None)
        is_sales_lead = fields.get("company_account_id") is not None
        if is_sales_lead:
            code = self._numbers.next_deal_reg_number(
                cid, entity_name=fields.get("entity_name")
            )
            fields["dr_number"] = code
        else:
            code = self._numbers.generate(CrmEntityType.LEAD, cid, CrmLead, "lead_code")
        fields.setdefault("document_date", date.today())
        fields.setdefault("status", LeadStatus.NEW.value)
        row = self._repo.create(ctx, company_id=cid, branch_id=branch_id, lead_code=code, **fields)
        if self._apply_sales_doc_requirements(ctx, row):
            self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="crm_lead",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        self._sync_lead_doc_requests(ctx, row.id)
        self._notify_admins_lead_created(ctx, row)
        return self.get(ctx, row.id)

    def update(self, ctx: TenantContext, lead_id: UUID, **fields):
        self.get(ctx, lead_id)
        row = self._repo.update(ctx, lead_id, **fields)
        if row is None:
            raise NotFoundException("Lead not found")
        return row

    def update_sales_lead(self, ctx: TenantContext, lead_id: UUID, **fields):
        version = fields.pop("version", None)
        owner_candidate = fields.pop("owner_employee_id", None)
        lead = self.get(ctx, lead_id)
        if lead.company_account_id is None:
            raise ConflictException("Only sales-process leads can be updated with this endpoint")
        if lead.blueprint_state == "lost":
            raise ConflictException("Lost leads cannot be edited")
        if lead.blueprint_state not in ("open", "converted"):
            raise ConflictException("Only open or converted sales leads can be edited")
        # Edits stay allowed while waiting on PreSales call / lead BOQ/SOW.
        if not self._should_lock_for_docs(lead):
            sales_blueprint_engine.assert_not_locked(lead)
        if version is not None and int(lead.version or 1) != int(version):
            raise ConflictException("Lead was modified by another user; refresh and try again")
        if owner_candidate is not None:
            if self._crm_admin.is_admin(ctx):
                fields["owner_employee_id"] = self._resolve_owner_employee_id(ctx, owner_candidate)
            elif owner_candidate != lead.owner_employee_id:
                raise ForbiddenException("Only CRM admins can change lead owner")
        # DR number is assigned at create and is the lead's unique ID - do not overwrite.
        fields.pop("dr_number", None)
        fields.pop("lead_code", None)
        if "custom_fields" in fields:
            from modules.crm.service.crm_settings_service import CrmSettingsService

            effective = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
            fields["custom_fields"] = CrmSettingsService.sanitize_custom_fields(
                effective, "lead", fields.get("custom_fields")
            )
        # BOQ/SOW flags are derived from product mix after save — ignore client overrides.
        if self._boq_sow_mandatory(lead) or "product_type" in fields:
            fields.pop("requires_boq", None)
            fields.pop("requires_sow", None)
        if "presales_call_by_product" in fields:
            raw_map = fields.get("presales_call_by_product")
            by_product = _parse_presales_by_product(
                str(raw_map) if raw_map is not None else None
            )
            product_types = _lead_product_types(lead)
            for product in product_types:
                entry = by_product.get(product) or {}
                aligned = entry.get("aligned")
                contact = str(entry.get("contact_name") or "").strip()
                if aligned is not True and aligned is not False:
                    raise ConflictException(
                        f"Select Yes or No for PreSales call alignment on {product}"
                    )
                if aligned is True and not contact:
                    raise ConflictException(
                        f"PreSales contact person is required for {product} when Call aligned is Yes"
                    )
            fields["presales_call_by_product"] = (
                json.dumps(by_product, separators=(",", ":")) if by_product else None
            )
            all_yes = bool(product_types) and all(
                (by_product.get(product) or {}).get("aligned") is True
                for product in product_types
            )
            any_no = any(
                (by_product.get(product) or {}).get("aligned") is False
                for product in product_types
            )
            contacts = [
                str((by_product.get(product) or {}).get("contact_name") or "").strip()
                for product in product_types
                if (by_product.get(product) or {}).get("aligned") is True
                and str((by_product.get(product) or {}).get("contact_name") or "").strip()
            ]
            fields["presales_call_aligned"] = True if all_yes else False if any_no else None
            fields["presales_call_contact_name"] = "; ".join(contacts) if contacts else None
        elif "presales_call_aligned" in fields or "presales_call_contact_name" in fields:
            aligned = fields.get("presales_call_aligned", lead.presales_call_aligned)
            contact = fields.get(
                "presales_call_contact_name",
                lead.presales_call_contact_name,
            )
            if aligned is True and not str(contact or "").strip():
                raise ConflictException(
                    "PreSales call contact person name is required when Call aligned is Yes"
                )
            if aligned is not True:
                fields["presales_call_contact_name"] = (
                    str(contact).strip() if contact else None
                )
            else:
                fields["presales_call_contact_name"] = str(contact).strip()
        # Clearing a requirement also clears the attached flag for that doc type.
        if fields.get("requires_boq") is False:
            fields["boq_attached"] = False
        if fields.get("requires_sow") is False:
            fields["sow_attached"] = False
        row = self._repo.update(ctx, lead_id, **fields)
        if row is None:
            raise NotFoundException("Lead not found")
        if self._apply_sales_doc_requirements(ctx, row):
            self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="crm_lead",
            entity_id=row.id,
            operation="update",
            performed_by=ctx.user_id,
        )
        self._sync_lead_doc_requests(ctx, lead_id)
        return self.get(ctx, lead_id)

    def _notify_admins_lead_created(self, ctx: TenantContext, lead: CrmLead) -> None:
        try:
            from modules.crm.models.lead_source import CrmLeadSource
            from modules.crm.service.crm_email_notification_service import CrmEmailNotificationService
            from modules.crm.service.crm_notification_service import resolve_employee_user_id
            from modules.foundation.models.security import SecUser

            source_name = "—"
            if lead.lead_source_id is not None:
                src = self._db.get(CrmLeadSource, lead.lead_source_id)
                if src is not None:
                    source_name = src.source_name or src.source_code or "—"

            owner_name = "—"
            owner_uid = resolve_employee_user_id(self._db, ctx.tenant_id, lead.owner_employee_id)
            if owner_uid is not None:
                owner = self._db.get(SecUser, owner_uid)
                if owner is not None:
                    owner_name = owner.display_name or owner.email or "—"

            company_name = (lead.company_name or "").strip()
            if lead.company_account_id is not None:
                from modules.crm.models.company import CrmCompany

                account = self._db.get(CrmCompany, lead.company_account_id)
                if account is not None and account.customer_name:
                    company_name = account.customer_name

            lead_name = (
                (lead.project_title or "").strip()
                or f"{lead.first_name} {(lead.last_name or '').strip()}".strip()
                or lead.lead_code
            )
            CrmEmailNotificationService(self._db).notify_admins_lead_created(
                tenant_id=ctx.tenant_id,
                lead_id=lead.id,
                lead_code=lead.lead_code,
                lead_name=lead_name,
                company_name=company_name or "—",
                owner_name=owner_name,
                expected_value=lead.expected_amount,
                lead_source=source_name,
                created_by=ctx.user_id,
            )
        except Exception:  # noqa: BLE001
            pass

    @staticmethod
    def _boq_sow_mandatory(lead: CrmLead | None) -> bool:
        """Sales-process leads need technical docs, except the cloud consumption flow."""
        if lead is None or lead.company_account_id is None:
            return False
        return cloud_variant_from_lead(lead) is None

    def _apply_sales_doc_requirements(self, ctx: TenantContext, lead: CrmLead | None) -> bool:
        """Derive BOQ/SOW requirements from product mix + tenant CRM Settings.

        - Non-cloud sales leads always require BOQ.
        - SOW is required when Services is in product_type and
          policies.sow_required_when_services (default True).
        Returns True when flags changed.
        """
        from modules.crm.domain.product_types import product_type_includes_services
        from modules.crm.service.crm_settings_service import CrmSettingsService

        if lead is None:
            return False
        if not LeadService._boq_sow_mandatory(lead):
            changed = bool(lead.requires_boq) or bool(lead.requires_sow)
            if lead.requires_boq:
                lead.requires_boq = False
            if lead.requires_sow:
                lead.requires_sow = False
                lead.sow_attached = False
            return changed

        effective = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
        want_boq = True
        services = product_type_includes_services(lead.product_type)
        policy_sow = CrmSettingsService.policy_flag(effective, "sow_required_when_services", True)
        want_sow = bool(
            services
            and policy_sow
            and CrmSettingsService.attachment_required(
                effective,
                "sow",
                product_type=lead.product_type,
                default=True,
            )
        )
        changed = False
        if bool(lead.requires_boq) != want_boq:
            lead.requires_boq = want_boq
            changed = True
        if bool(lead.requires_sow) != want_sow:
            lead.requires_sow = want_sow
            if not want_sow:
                lead.sow_attached = False
            changed = True
        return changed

    @staticmethod
    def _presales_call_ready(lead: CrmLead) -> bool:
        """BOQ/SOW My Jobs unlock only after Yes + contact for every product type."""
        if not LeadService._boq_sow_mandatory(lead):
            return True
        product_types = _lead_product_types(lead)
        by_product = _parse_presales_by_product(getattr(lead, "presales_call_by_product", None))
        if product_types and by_product:
            return _presales_ready_from_map(product_types, by_product)
        # Legacy single-field fallback for older leads.
        return bool(lead.presales_call_aligned) and bool(
            (lead.presales_call_contact_name or "").strip()
        )

    @staticmethod
    def _lead_docs_pending(lead: CrmLead) -> bool:
        """True while required BOQ/SOW files are still missing (ignores PreSales gate)."""
        return (bool(lead.requires_boq) and not bool(lead.boq_attached)) or (
            bool(lead.requires_sow) and not bool(lead.sow_attached)
        )

    @staticmethod
    def _should_lock_for_docs(lead: CrmLead) -> bool:
        """Lock convert only after PreSales call unlocks document routing."""
        return LeadService._presales_call_ready(lead) and LeadService._lead_docs_pending(lead)

    def _pending_doc_labels(self, lead: CrmLead) -> list[str]:
        labels: list[str] = []
        if lead.requires_boq and not lead.boq_attached:
            labels.append("BOQ")
        if lead.requires_sow and not lead.sow_attached:
            labels.append("SOW")
        return labels

    def _find_existing_convert_opportunity(self, lead: CrmLead):
        """Return an opportunity already created for this lead or its DR code."""
        from modules.crm.models.opportunity import CrmOpportunity

        by_lead = (
            self._db.query(CrmOpportunity)
            .filter(
                CrmOpportunity.company_id == lead.company_id,
                CrmOpportunity.lead_id == lead.id,
                CrmOpportunity.is_deleted.is_(False),
            )
            .first()
        )
        if by_lead is not None:
            return by_lead
        from modules.crm.service.document_number_service import is_deal_reg_number

        dr_number = (lead.dr_number or lead.lead_code or "").strip()
        if not is_deal_reg_number(dr_number):
            return None
        return (
            self._db.query(CrmOpportunity)
            .filter(
                CrmOpportunity.company_id == lead.company_id,
                CrmOpportunity.opportunity_code == dr_number,
                CrmOpportunity.is_deleted.is_(False),
            )
            .first()
        )

    def _sync_lead_doc_requests(self, ctx: TenantContext, lead_id: UUID) -> CrmLead:
        """Route My Jobs attachment tasks for required BOQ/SOW and lock convert until done."""
        from modules.crm.domain.approval_step_owners import APPROVAL_STEP_CATALOG
        from modules.crm.service.approval_step_owner_service import ApprovalStepOwnerService
        from modules.crm.service.approval_task_service import ApprovalTaskService

        lead = self.get(ctx, lead_id)
        tasks = ApprovalTaskService(self._db)
        owners = ApprovalStepOwnerService(self._db)
        pending = tasks.list(
            ctx,
            company_id=lead.company_id,
            entity_type="lead",
            entity_id=lead_id,
            status="pending",
        )
        pending_actions = {t.action for t in pending}

        lead_label = (
            (lead.project_title or "").strip()
            or f"{lead.first_name} {lead.last_name or ''}".strip()
            or lead.lead_code
        )

        def cancel_pending(action: str) -> None:
            for task in pending:
                if task.action == action and task.status == "pending":
                    tasks._repo.update(
                        ctx,
                        task.id,
                        status="cancelled",
                        decision_remark="Requirement cleared on lead",
                        decided_at=datetime.now(timezone.utc),
                        decided_by=ctx.user_id,
                    )

        def ensure_request(*, required: bool, attached: bool, action: str, step_key: str, title: str) -> None:
            if not required or attached:
                if action in pending_actions:
                    cancel_pending(action)
                return
            if action in pending_actions:
                return
            # Services leads: SOW attach/approve My Jobs go only to the lead owner
            # when policies.sow_route_to_owner_when_services is enabled (default).
            from modules.crm.domain.product_types import product_type_includes_services
            from modules.crm.service.crm_notification_service import resolve_employee_user_id
            from modules.crm.service.crm_settings_service import CrmSettingsService

            settings = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
            route_sow_to_owner = CrmSettingsService.policy_flag(
                settings, "sow_route_to_owner_when_services", True
            )
            if (
                action == "provide_sow_attachment"
                and product_type_includes_services(lead.product_type)
                and route_sow_to_owner
            ):
                owner_uid = resolve_employee_user_id(
                    self._db, ctx.tenant_id, lead.owner_employee_id
                )
                if owner_uid is None:
                    raise ConflictException(
                        "Lead owner must have a user login to receive SOW attachment "
                        "when Services is selected."
                    )
                user_ids = [owner_uid]
                remarks = (
                    "Required — Services lead: SOW attachment assigned to lead owner only"
                )
            else:
                user_ids = owners.list_user_ids(ctx, step_key) or tasks._admin_recipient_ids(ctx)
                if not user_ids:
                    raise ConflictException(
                        f"No default owners configured for {step_key.replace('_', ' ')}. "
                        "Assign owners under CRM → Users → Default task owners before requiring this document."
                    )
                remarks = (
                    "Required — lead converts to an opportunity when documents are attached"
                )
            from modules.crm.service.crm_settings_service import CrmSettingsService

            effective = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
            _, team_role = CrmSettingsService.approval_step_meta(effective, step_key)
            tasks.route_approval(
                ctx,
                assigned_user_ids=user_ids,
                title=f"{title} - {lead_label}",
                entity_type="lead",
                entity_id=lead_id,
                team_role=team_role,
                action=action,
                company_id=lead.company_id,
                branch_id=lead.branch_id,
                remarks=remarks,
            )

        call_ready = self._presales_call_ready(lead)
        ensure_request(
            required=bool(lead.requires_boq) and call_ready,
            attached=bool(lead.boq_attached),
            action="provide_boq_attachment",
            step_key="boq_attachment",
            title="Attach BOQ",
        )
        ensure_request(
            required=bool(lead.requires_sow) and call_ready,
            attached=bool(lead.sow_attached),
            action="provide_sow_attachment",
            step_key="sow_attachment",
            title="Attach SOW",
        )

        pending_docs = self._should_lock_for_docs(lead)
        if lead.locked != pending_docs and lead.blueprint_state == "open":
            updated = self._repo.update(ctx, lead_id, locked=pending_docs)
            if updated is not None:
                lead = updated
        return lead

    def maybe_auto_convert_after_docs(self, ctx: TenantContext, lead_id: UUID) -> CrmLead:
        """Convert open sales leads once PreSales call + required BOQ/SOW are done."""
        lead = self.get(ctx, lead_id)
        if (
            lead.company_account_id is not None
            and lead.blueprint_state == "open"
            and self._presales_call_ready(lead)
            and (bool(lead.requires_boq) or bool(lead.requires_sow))
            and not self._lead_docs_pending(lead)
        ):
            self.convert(ctx, lead_id)
            return self.get(ctx, lead_id)
        return lead

    def apply_attachment_action(
        self,
        ctx: TenantContext,
        lead_id: UUID,
        action: str,
        payload: dict | None = None,
    ) -> CrmLead:
        """Resume lead BOQ/SOW attachment after a My Jobs decision."""
        from modules.crm.service.attachment_service import AttachmentService

        payload = payload or {}
        lead = self.get(ctx, lead_id)
        updates: dict = {}
        if action == "provide_boq_attachment":
            if not payload.get("file_name") or not (
                payload.get("content_base64") or payload.get("file_path")
            ):
                raise ConflictException("A BOQ file is required")
            AttachmentService(self._db).create(
                ctx,
                entity_type="lead",
                entity_id=lead.id,
                file_name=payload["file_name"],
                category="boq",
                branch_id=lead.branch_id,
                company_id=lead.company_id,
                file_path=payload.get("file_path"),
                content_base64=payload.get("content_base64"),
                content_type=payload.get("content_type"),
            )
            updates["boq_attached"] = True
        elif action == "provide_sow_attachment":
            if not payload.get("file_name") or not (
                payload.get("content_base64") or payload.get("file_path")
            ):
                raise ConflictException("A SOW file is required")
            AttachmentService(self._db).create(
                ctx,
                entity_type="lead",
                entity_id=lead.id,
                file_name=payload["file_name"],
                category="sow",
                branch_id=lead.branch_id,
                company_id=lead.company_id,
                file_path=payload.get("file_path"),
                content_base64=payload.get("content_base64"),
                content_type=payload.get("content_type"),
            )
            updates["sow_attached"] = True
        elif action in {"reject_boq_attachment", "reject_sow_attachment"}:
            pass
        else:
            raise ConflictException(f"Unsupported lead attachment action '{action}'")

        if updates:
            self._repo.update(ctx, lead_id, **updates)
            self._db.flush()
            self._db.expire_all()
        self._sync_lead_doc_requests(ctx, lead_id)
        if action in {"provide_boq_attachment", "provide_sow_attachment"}:
            return self.maybe_auto_convert_after_docs(ctx, lead_id)
        return self.get(ctx, lead_id)

    def _copy_lead_attachments_to_opportunity(
        self, ctx: TenantContext, lead: CrmLead, opportunity_id: UUID
    ) -> None:
        from modules.crm.repository.opportunity_repository import OpportunityRepository
        from modules.crm.service.attachment_service import AttachmentService

        attachments = AttachmentService(self._db)
        rows = attachments.list_for_entity(ctx, "lead", lead.id)
        for row in rows:
            if row.category not in {"boq", "sow"}:
                continue
            attachments.create(
                ctx,
                entity_type="opportunity",
                entity_id=opportunity_id,
                file_name=row.file_name,
                category=row.category,
                branch_id=lead.branch_id,
                company_id=lead.company_id,
                file_path=row.file_path,
                content_type=row.content_type,
            )
        flags: dict = {}
        if lead.boq_attached:
            flags["boq_attached"] = True
            flags["boq_approved"] = False
        if lead.sow_attached:
            flags["sow_attached"] = True
            flags["sow_approved"] = False
        if flags:
            # After lead attach, opportunity must go through BOQ/SOW approval My Jobs
            # (same path as opportunity provide_* → _auto_raise_doc_approval).
            if lead.boq_attached:
                flags["blueprint_state"] = "boq_approval"
            else:
                flags["blueprint_state"] = "sow_approval"
            flags["locked"] = True
            OpportunityRepository(self._db).update(ctx, opportunity_id, **flags)
            from modules.crm.models.opportunity import CrmOpportunity
            from modules.crm.service.blueprint_service import OpportunityBlueprintService

            opp = self._db.get(CrmOpportunity, opportunity_id)
            if opp is not None:
                blueprint = OpportunityBlueprintService(self._db)
                if lead.boq_attached:
                    blueprint._auto_raise_doc_approval(ctx, opp, doc="boq")
                if lead.sow_attached:
                    blueprint._auto_raise_doc_approval(ctx, opp, doc="sow")

    def delete(self, ctx: TenantContext, lead_id: UUID) -> None:
        self._crm_admin.ensure_admin(ctx)
        lead = self.get(ctx, lead_id)
        if lead.locked:
            raise ConflictException("Lead is locked pending approval")
        if not self._repo.soft_delete(ctx, lead_id):
            raise NotFoundException("Lead not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="crm_lead",
            entity_id=lead_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

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
        # Idempotent convert first: if an opportunity already exists for this lead/DR,
        # finish linking even when PreSales/docs gates would block a fresh convert
        # (heals UniqueViolation orphans from earlier partial converts).
        existing_opp = self._find_existing_convert_opportunity(lead)
        if existing_opp is not None and lead.blueprint_state == "open":
            now = datetime.now(timezone.utc)
            self._repo.update(
                ctx,
                lead_id,
                status=LeadStatus.CONVERTED.value,
                blueprint_state="converted",
                converted_opportunity_id=existing_opp.id,
                converted_at=now,
                convert_remark=remark,
                locked=False,
            )
            return existing_opp

        if pipeline_id is None:
            from modules.crm.repository.pipeline_repository import PipelineRepository

            pipelines = PipelineRepository(self._db).list_pipelines(ctx, lead.company_id)
            if not pipelines:
                raise ConflictException("No sales pipeline is configured for this company")
            pipeline_id = pipelines[0].id
        resolved_name = (opportunity_name or "").strip() or (
            lead.project_title
            or (f"{lead.first_name} {lead.last_name or ''}".strip() + " - Opportunity")
            or f"{lead.company_name or 'Lead'} - Opportunity"
        )
        resolved_revenue = (
            expected_revenue
            if expected_revenue is not None
            else float(lead.expected_amount or 0)
        )
        if lead.company_account_id is not None:
            # Sales-blueprint lead (rule #1/#2): lifecycle is governed by
            # ``blueprint_state``, not the legacy ``status`` qualification
            # gate - only require it to still be in the initial "open" state
            # and unlocked.
            if lead.blueprint_state != "open":
                raise ConflictException(
                    f"Lead is in blueprint state '{lead.blueprint_state}'; only an 'open' "
                    "sales lead can be converted"
                )
            if not self._presales_call_ready(lead):
                raise ConflictException(
                    "Confirm PreSales call alignment (Yes + contact person) before converting "
                    "this lead to an opportunity"
                )
            pending = self._pending_doc_labels(lead)
            if pending:
                raise ConflictException(
                    f"Attach required {' and '.join(pending)} before converting this lead "
                    "to an opportunity"
                )
            sales_blueprint_engine.assert_not_locked(lead)
        else:
            self._engine.validate_convertible(lead)
        customer_id = existing_customer_id or lead.customer_id
        # ``crm_company`` is an optional, non-duplicate link to
        # ``master_customer`` (per the sales-account spec) - sales-blueprint
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
        # (i.e. blueprint-enabled) via this lead-convert path - direct
        # POST /crm/opportunities calls leave blueprint_state unset.
        if lead.company_account_id is not None:
            opp_fields["company_account_id"] = lead.company_account_id
            opp_fields["blueprint_state"] = "open"
            opp_fields["project_title"] = lead.project_title
            opp_fields["marketing_event_id"] = lead.marketing_event_id
            purchase_model = (lead.purchase_model or "").strip().lower()
            if purchase_model in {"capex", "opex"}:
                opp_fields["purchase_model"] = purchase_model
            # One number from lead create to closure: reuse the lead's DR as the
            # opportunity number; quotes / OVF / tracking hang off that same code.
            from modules.crm.service.document_number_service import is_deal_reg_number

            dr_number = (lead.dr_number or lead.lead_code or "").strip()
            if not is_deal_reg_number(dr_number):
                dr_number = self._numbers.next_deal_reg_number(
                    lead.company_id, entity_name=lead.entity_name
                )
                self._repo.update(ctx, lead_id, dr_number=dr_number)
            opp_fields["opportunity_code"] = dr_number
            opp_fields["deal_reg_number"] = dr_number
            opp_fields["product_type"] = lead.product_type
            product_tokens = {
                part.strip().lower()
                for part in (lead.product_type or "").replace("&", ",").split(",")
                if part.strip()
            }
            opp_fields["has_services"] = "services" in product_tokens
            opp_fields["has_software"] = "software" in product_tokens
            opp_fields["has_hardware"] = bool(
                product_tokens
                & {"hardware", "networking", "cybersecurity", "ai", "cloud", "others"}
            ) or (
                bool(product_tokens)
                and not opp_fields["has_services"]
                and not opp_fields["has_software"]
            )
            if opp_fields["has_services"]:
                from modules.crm.domain.lead_sourcing_channels import (
                    parse_service_sourcing_channel,
                )

                channel = parse_service_sourcing_channel(lead.deal_type)
                if channel:
                    opp_fields["service_sourcing_channel"] = channel
            cloud_variant = cloud_variant_from_lead(lead)
            if cloud_variant:
                opp_fields["cloud_blueprint_variant"] = cloud_variant
                opp_fields["cloud_sub_product"] = cloud_sub_product_label(lead)
                opp_fields["distributor_discount_percent"] = DEFAULT_DISTRIBUTOR_DISCOUNT_PERCENT
                opp_fields["distributor_discount_locked"] = True

        try:
            opportunity = opp_svc.create(ctx, **opp_fields)
        except Exception:
            # UniqueViolation on opportunity_code leaves the session aborted;
            # heal by linking any opportunity that already owns this lead/DR.
            self._db.rollback()
            existing_opp = self._find_existing_convert_opportunity(lead)
            if existing_opp is None:
                raise
            opportunity = existing_opp
        if lead.company_account_id is not None:
            self._copy_lead_attachments_to_opportunity(ctx, lead, opportunity.id)
            # Ensure post-doc Transitions are ready (skip Deal Reg when DR already exists).
            from modules.crm.service.blueprint_service import OpportunityBlueprintService

            opportunity = OpportunityBlueprintService(self._db)._reconcile_post_lead_docs(
                ctx, opportunity
            )
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
            locked=False,
        )
        return opportunity

    def mark_lost(self, ctx: TenantContext, lead_id: UUID, *, reason: str | None = None) -> CrmLead:
        lead = self.get(ctx, lead_id)
        if lead.status in {LeadStatus.CONVERTED.value, LeadStatus.LOST.value}:
            raise ConflictException("Lead is already converted or lost")
        if not self._should_lock_for_docs(lead):
            sales_blueprint_engine.assert_not_locked(lead)
        row = self._repo.update(
            ctx,
            lead_id,
            status=LeadStatus.LOST.value,
            blueprint_state="lost",
            lost_reason=reason,
            locked=False,
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
        cid = self._scope.resolve_list_company_id(ctx, company_id)
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
        cid = self._scope.resolve_list_company_id(ctx, company_id)
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
