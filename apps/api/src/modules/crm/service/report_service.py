"""CRM report service — summary + custom saved reports."""

from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException, ForbiddenException, NotFoundException, ValidationException
from modules.crm.models.saved_report import CrmSavedReport
from modules.crm.repository.base import utcnow
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.service.activity_service import FollowupService, MeetingService
from modules.crm.service.attachment_service import AttachmentService
from modules.crm.service.company_service import CompanyService
from modules.crm.service.contact_service import ContactService
from modules.crm.service.crm_module_admin import CrmModuleAdminService
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.kyc_record_service import KycRecordService
from modules.crm.service.lead_service import LeadService
from modules.crm.service.oem_service import OemService
from modules.crm.service.opportunity_service import OpportunityService
from modules.crm.service.ovf_service import OvfService
from modules.crm.service.product_service import ProductService
from modules.crm.service.quote_service import QuoteService
from modules.crm.service import report_catalog
from modules.crm.service.selling_entity_service import SellingEntityService
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.repository.employee_repository import EmployeeRepository


class _ReportRow:
    """Attribute lookup across primary row + enrichment sources.

    First source with a non-None value wins, so opportunity fields override
    lead fields when both exist (e.g. product_type / project_title).
    """

    __slots__ = ("_sources",)

    def __init__(self, *sources) -> None:
        self._sources = sources

    def __getattr__(self, key: str):
        found = False
        last = None
        for source in self._sources:
            if source is None:
                continue
            if hasattr(source, key):
                found = True
                value = getattr(source, key)
                if value is not None:
                    return value
                last = value
        if found:
            return last
        return None


class CRMReportService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._leads = LeadService(db)
        self._opps = OpportunityRepository(db)
        self._scope = CrmScopeValidator(db)
        self._crm_admin = CrmModuleAdminService(db)
        self._employees = EmployeeRepository(db)

    def summary(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        leads = self._leads.list(ctx, cid)
        opps = self._opps.list_opportunities(ctx, cid)
        return {
            "lead_count": len(leads),
            "converted_leads": sum(1 for lead in leads if lead.status == "converted"),
            "open_opportunities": sum(1 for opp in opps if opp.status == "open"),
            "won_opportunities": sum(1 for opp in opps if opp.status == "won"),
            "pipeline_value": float(sum((opp.forecast_amount or 0) for opp in opps if opp.status == "open")),
        }

    def list_modules(self) -> list[dict]:
        return report_catalog.list_modules()

    def list_columns(self, module_key: str) -> list[dict]:
        return report_catalog.list_columns(module_key)

    def list_saved(self, ctx: TenantContext, company_id: UUID | None = None) -> list[CrmSavedReport]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        stmt = select(CrmSavedReport).where(
            CrmSavedReport.tenant_id == ctx.tenant_id,
            CrmSavedReport.company_id == cid,
            CrmSavedReport.is_deleted.is_(False),
        )
        if not self._crm_admin.is_admin(ctx):
            stmt = stmt.where(CrmSavedReport.owner_user_id == ctx.user_id)
        stmt = stmt.order_by(CrmSavedReport.updated_at.desc())
        return list(self._db.scalars(stmt).all())

    def get_saved(self, ctx: TenantContext, report_id: UUID) -> CrmSavedReport:
        row = self._db.scalar(
            select(CrmSavedReport).where(
                CrmSavedReport.id == report_id,
                CrmSavedReport.is_deleted.is_(False),
            )
        )
        if row is None or row.tenant_id != ctx.tenant_id:
            raise NotFoundException("Saved report not found")
        self._scope.resolve_company_id(ctx, row.company_id)
        if not self._crm_admin.is_admin(ctx) and row.owner_user_id != ctx.user_id:
            raise ForbiddenException("You can only access your own saved reports")
        return row

    def create_saved(
        self,
        ctx: TenantContext,
        *,
        report_name: str,
        primary_module: str,
        columns: list[str],
        folder_name: str | None = None,
        description: str | None = None,
        company_id: UUID | None = None,
    ) -> CrmSavedReport:
        cid = self._scope.resolve_company_id(ctx, company_id)
        valid_cols = report_catalog.validate_columns(primary_module, columns)
        labels = {c["key"]: c["label"] for c in report_catalog.list_columns(primary_module)}
        definition = {
            "columns": valid_cols,
            "column_labels": {k: labels[k] for k in valid_cols},
        }
        code = self._next_report_code(cid)
        if ctx.user_id is None:
            raise ValidationException("User context required to save a report")
        row = CrmSavedReport(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=cid,
            report_code=code,
            report_name=report_name.strip(),
            primary_module=primary_module,
            folder_name=(folder_name or "").strip() or None,
            description=(description or "").strip() or None,
            definition_json=definition,
            owner_user_id=ctx.user_id,
            status="active",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(row)
        self._db.flush()
        return row

    def update_saved(self, ctx: TenantContext, report_id: UUID, **fields) -> CrmSavedReport:
        row = self.get_saved(ctx, report_id)
        if not self._crm_admin.is_admin(ctx) and row.owner_user_id != ctx.user_id:
            raise ForbiddenException("You can only update your own saved reports")

        version = fields.pop("version", None)
        if version is not None and int(row.version or 1) != int(version):
            raise ConflictException("Report was modified by another user")

        columns = fields.pop("columns", None)
        if columns is not None:
            valid_cols = report_catalog.validate_columns(row.primary_module, columns)
            labels = {c["key"]: c["label"] for c in report_catalog.list_columns(row.primary_module)}
            row.definition_json = {
                "columns": valid_cols,
                "column_labels": {k: labels[k] for k in valid_cols},
            }

        if "report_name" in fields and fields["report_name"] is not None:
            row.report_name = str(fields["report_name"]).strip()
        if "folder_name" in fields:
            folder = fields["folder_name"]
            row.folder_name = (str(folder).strip() if folder else None) or None
        if "description" in fields:
            desc = fields["description"]
            row.description = (str(desc).strip() if desc else None) or None

        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self._db.flush()
        return row

    def delete_saved(self, ctx: TenantContext, report_id: UUID) -> None:
        row = self.get_saved(ctx, report_id)
        if not self._crm_admin.is_admin(ctx) and row.owner_user_id != ctx.user_id:
            raise ForbiddenException("You can only delete your own saved reports")
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self._db.flush()

    def clone_saved(
        self,
        ctx: TenantContext,
        report_id: UUID,
        *,
        report_name: str | None = None,
    ) -> CrmSavedReport:
        src = self.get_saved(ctx, report_id)
        cols = list((src.definition_json or {}).get("columns") or [])
        name = (report_name or "").strip() or f"{src.report_name} (Copy)"
        return self.create_saved(
            ctx,
            report_name=name,
            primary_module=src.primary_module,
            columns=cols,
            folder_name=src.folder_name,
            description=src.description,
            company_id=src.company_id,
        )

    def run(
        self,
        ctx: TenantContext,
        *,
        primary_module: str,
        columns: list[str],
        company_id: UUID | None = None,
        preview_limit: int | None = None,
    ) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        valid_cols = report_catalog.validate_columns(primary_module, columns)
        module_label = report_catalog.get_module_label(primary_module)
        col_meta = [
            c for c in report_catalog.list_columns(primary_module) if c["key"] in valid_cols
        ]
        # Preserve requested column order
        order = {k: i for i, k in enumerate(valid_cols)}
        col_meta.sort(key=lambda c: order.get(c["key"], 999))

        rows = self._load_module_rows(ctx, primary_module, cid)
        rows = self._apply_non_admin_scope(ctx, rows)
        projected = [self._row_to_dict(row, valid_cols) for row in rows]
        record_count = len(projected)
        if preview_limit is not None and preview_limit >= 0:
            projected = projected[:preview_limit]

        return {
            "columns": col_meta,
            "rows": projected,
            "record_count": record_count,
            "primary_module": primary_module,
            "module_label": module_label,
        }

    def run_saved(
        self,
        ctx: TenantContext,
        report_id: UUID,
        *,
        preview_limit: int | None = None,
    ) -> dict:
        row = self.get_saved(ctx, report_id)
        cols = list((row.definition_json or {}).get("columns") or [])
        return self.run(
            ctx,
            primary_module=row.primary_module,
            columns=cols,
            company_id=row.company_id,
            preview_limit=preview_limit,
        )

    def _next_report_code(self, company_id: UUID) -> str:
        count = self._db.scalar(
            select(func.count()).select_from(CrmSavedReport).where(
                CrmSavedReport.company_id == company_id,
            )
        )
        return f"RPT-{int(count or 0) + 1:04d}"

    def _current_employee_id(self, ctx: TenantContext) -> UUID | None:
        if ctx.user_id is None:
            return None
        emp = self._employees.get_by_user_id(ctx, ctx.user_id)
        return emp.id if emp is not None else None

    def _apply_non_admin_scope(self, ctx: TenantContext, rows: list) -> list:
        if self._crm_admin.is_admin(ctx):
            return rows
        employee_id = self._current_employee_id(ctx)
        filtered: list = []
        for row in rows:
            created_by = getattr(row, "created_by", None)
            if created_by is not None and created_by == ctx.user_id:
                filtered.append(row)
                continue
            owner_emp = getattr(row, "owner_employee_id", None)
            if employee_id is not None and owner_emp is not None and owner_emp == employee_id:
                filtered.append(row)
                continue
            owner_id = getattr(row, "owner_id", None)
            if owner_id is not None and (
                owner_id == ctx.user_id or (employee_id is not None and owner_id == employee_id)
            ):
                filtered.append(row)
                continue
            uploaded_by = getattr(row, "uploaded_by", None)
            if uploaded_by is not None and uploaded_by == ctx.user_id:
                filtered.append(row)
                continue
        return filtered

    def _load_module_rows(self, ctx: TenantContext, module_key: str, company_id: UUID) -> list:
        if module_key == "companies":
            return CompanyService(self._db).list(ctx, company_id)
        if module_key == "leads":
            return self._enrich_leads_with_company(ctx, company_id)
        if module_key == "opportunities":
            return self._enrich_opportunities_with_lead(ctx, company_id)
        if module_key == "quotes":
            return QuoteService(self._db).list(ctx, company_id)
        if module_key == "ovf":
            return OvfService(self._db).list(ctx, company_id)
        if module_key == "contacts":
            return ContactService(self._db).list(ctx, company_id)
        if module_key == "products":
            return ProductService(self._db).list(ctx, company_id)
        if module_key == "meetings":
            return MeetingService(self._db).list(ctx, company_id)
        if module_key == "customer_followups":
            return FollowupService(self._db).list(ctx, company_id)
        if module_key == "oem":
            return OemService(self._db).list(ctx, company_id)
        if module_key == "kyc":
            return KycRecordService(self._db).list(ctx, company_id)
        if module_key == "entities":
            return SellingEntityService(self._db).list(ctx, company_id)
        if module_key in ("oem_quotes", "boq", "sow", "purchase_orders"):
            category_map = {
                "oem_quotes": "oem_quote",
                "boq": "boq",
                "sow": "sow",
                "purchase_orders": "customer_po",
            }
            return AttachmentService(self._db).list_by_category(
                ctx, category=category_map[module_key], company_id=company_id
            )
        if module_key == "distributors":
            return self._derive_from_leads(ctx, company_id, kind="distributors")
        if module_key == "end_customers":
            return self._derive_from_leads(ctx, company_id, kind="end_customers")
        return []

    def _companies_by_id(self, ctx: TenantContext, company_id: UUID) -> dict:
        return {c.id: c for c in CompanyService(self._db).list(ctx, company_id)}

    def _enrich_leads_with_company(self, ctx: TenantContext, company_id: UUID) -> list:
        leads = self._leads.list(ctx, company_id)
        companies = self._companies_by_id(ctx, company_id)
        rows: list = []
        for lead in leads:
            account = companies.get(getattr(lead, "company_account_id", None))
            rows.append(
                _ReportRow(
                    lead,
                    SimpleNamespace(
                        company_account_name=getattr(account, "customer_name", None) if account else None,
                    ),
                )
            )
        return rows

    def _enrich_opportunities_with_lead(self, ctx: TenantContext, company_id: UUID) -> list:
        """Merge opportunity + linked lead (and company name) so report columns
        include lead-creation fields shown on the opportunity detail page."""
        opps = OpportunityService(self._db).list(ctx, company_id)
        leads_by_id = {lead.id: lead for lead in self._leads.list(ctx, company_id)}
        companies = self._companies_by_id(ctx, company_id)
        rows: list = []
        for opp in opps:
            lead = leads_by_id.get(opp.lead_id) if getattr(opp, "lead_id", None) else None
            account = companies.get(getattr(opp, "company_account_id", None))
            extras = SimpleNamespace(
                company_account_name=getattr(account, "customer_name", None) if account else None,
            )
            if lead is not None:
                # Prefer opportunity values when both exist (e.g. product_type);
                # lead-only fields fill via fallback on _ReportRow.
                rows.append(_ReportRow(opp, extras, lead))
            else:
                rows.append(_ReportRow(opp, extras))
        return rows

    def _derive_from_leads(self, ctx: TenantContext, company_id: UUID, *, kind: str) -> list:
        leads = self._leads.list(ctx, company_id)
        seen: set[str] = set()
        rows: list = []
        for lead in leads:
            if kind == "distributors":
                name = (getattr(lead, "distributor_name", None) or "").strip()
                if not name or name.lower() in seen:
                    continue
                seen.add(name.lower())
                rows.append(
                    SimpleNamespace(
                        distributor_name=name,
                        distributor_contact=getattr(lead, "distributor_contact", None),
                        distributor_contact_person=getattr(lead, "distributor_contact_person", None),
                        distributor_contact_email=getattr(lead, "distributor_contact_email", None),
                        distributor_department=getattr(lead, "distributor_department", None),
                        lead_code=getattr(lead, "lead_code", None),
                        company_name=getattr(lead, "company_name", None),
                        created_by=getattr(lead, "created_by", None),
                        owner_employee_id=getattr(lead, "owner_employee_id", None),
                    )
                )
            else:
                name = (getattr(lead, "end_customer_name", None) or "").strip()
                if not name or name.lower() in seen:
                    continue
                seen.add(name.lower())
                rows.append(
                    SimpleNamespace(
                        end_customer_name=name,
                        end_customer_location=getattr(lead, "end_customer_location", None),
                        lead_code=getattr(lead, "lead_code", None),
                        company_name=getattr(lead, "company_name", None),
                        oem_name=getattr(lead, "oem_name", None),
                        distributor_name=getattr(lead, "distributor_name", None),
                        created_by=getattr(lead, "created_by", None),
                        owner_employee_id=getattr(lead, "owner_employee_id", None),
                    )
                )
        return rows

    @staticmethod
    def _format_value(value):
        if value is None:
            return None
        if isinstance(value, UUID):
            return str(value)
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, date):
            return value.isoformat()
        if isinstance(value, time):
            return value.isoformat()
        return value

    def _row_to_dict(self, row, columns: list[str]) -> dict:
        return {key: self._format_value(getattr(row, key, None)) for key in columns}
