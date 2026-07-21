"""Fiscal year service."""

from calendar import monthrange
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.finance.domain.enums import FiscalYearStatus
from modules.finance.models.fiscal import FinPeriod
from modules.finance.repository.base import utcnow
from modules.finance.repository.fiscal_repository import FiscalRepository
from modules.finance.schemas import (
    FiscalSummaryResponse,
    FiscalYearClosePreviewResponse,
    FiscalYearImportResult,
    FiscalYearResponse,
    PeriodResponse,
)
from modules.finance.service.finance_scope_validator import FinanceScopeValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class FiscalYearService:
    def __init__(self, db: Session) -> None:
        self._repo = FiscalRepository(db)
        self._scope = FinanceScopeValidator(db)
        self._audit = AuditService(db)

    def list_fiscal_years(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        status: str | None = None,
        search: str | None = None,
        sort_by: str = "start_date",
        sort_dir: str = "desc",
    ) -> list[FiscalYearResponse]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        years = self._repo.list_fiscal_years(
            ctx, cid, status=status, search=search, sort_by=sort_by, sort_dir=sort_dir
        )
        return [self._to_response(ctx, fy) for fy in years]

    def get_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID) -> FiscalYearResponse:
        fy = self._repo.get_fiscal_year(ctx, fiscal_year_id)
        if fy is None:
            raise NotFoundException("Fiscal year not found")
        self._scope.validate_company_access(ctx, fy.company_id)
        return self._to_response(ctx, fy)

    def create_fiscal_year(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        **fields,
    ) -> FiscalYearResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        start_date = fields["start_date"]
        end_date = fields["end_date"]
        if end_date <= start_date:
            raise AppException("End date must be after start date")
        if self._repo.overlapping_fiscal_year(ctx, cid, start_date, end_date):
            raise ConflictException("Fiscal year dates overlap an existing year")
        if fields.get("is_default"):
            self._repo.clear_default_flag(ctx, cid)
        elif self._repo.get_open_fiscal_year(ctx, cid) and fields.get("status", "open") == "open":
            pass  # allow multiple if not default; open uniqueness enforced on activate
        fy = self._repo.create_fiscal_year(
            ctx,
            company_id=cid,
            fiscal_year_code=fields["fiscal_year_code"],
            fiscal_year_name=fields["fiscal_year_name"],
            start_date=start_date,
            end_date=end_date,
            description=fields.get("description"),
            is_default=bool(fields.get("is_default", False)),
            status=FiscalYearStatus.OPEN.value,
        )
        self._generate_periods(ctx, fy, cid)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_fiscal_year",
            entity_id=fy.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return self.get_fiscal_year(ctx, fy.id)

    def update_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID, **fields):
        fy = self._repo.get_fiscal_year(ctx, fiscal_year_id)
        if fy is None:
            raise NotFoundException("Fiscal year not found")
        self._scope.validate_company_access(ctx, fy.company_id)
        if fy.status == FiscalYearStatus.CLOSED.value:
            raise AppException("Closed fiscal years cannot be edited")
        start = fields.get("start_date", fy.start_date)
        end = fields.get("end_date", fy.end_date)
        if end <= start:
            raise AppException("End date must be after start date")
        overlap = self._repo.overlapping_fiscal_year(ctx, fy.company_id, start, end, exclude_id=fy.id)
        if overlap:
            raise ConflictException("Fiscal year dates overlap an existing year")
        if fields.get("is_default"):
            self._repo.clear_default_flag(ctx, fy.company_id, exclude_id=fy.id)
        updated = self._repo.update_fiscal_year(ctx, fiscal_year_id, **fields)
        if updated is None:
            raise NotFoundException("Fiscal year not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_fiscal_year",
            entity_id=fiscal_year_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=fields,
        )
        return self.get_fiscal_year(ctx, fiscal_year_id)

    def delete_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID) -> None:
        fy = self._repo.get_fiscal_year(ctx, fiscal_year_id)
        if fy is None:
            raise NotFoundException("Fiscal year not found")
        if self._repo.count_journals_for_fiscal_year(ctx, fiscal_year_id) > 0:
            raise ConflictException("Cannot delete fiscal year with journals")
        if not self._repo.soft_delete_fiscal_year(ctx, fiscal_year_id):
            raise NotFoundException("Fiscal year not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_fiscal_year",
            entity_id=fiscal_year_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

    def archive_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID):
        fy = self._repo.get_fiscal_year(ctx, fiscal_year_id)
        if fy is None:
            raise NotFoundException("Fiscal year not found")
        self._repo.update_fiscal_year(ctx, fiscal_year_id, status=FiscalYearStatus.ARCHIVED.value, is_default=False)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_fiscal_year",
            entity_id=fiscal_year_id,
            operation="archive",
            performed_by=ctx.user_id,
        )
        return self.get_fiscal_year(ctx, fiscal_year_id)

    def activate_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID):
        fy = self._repo.get_fiscal_year(ctx, fiscal_year_id)
        if fy is None:
            raise NotFoundException("Fiscal year not found")
        if fy.status == FiscalYearStatus.CLOSED.value:
            raise AppException("Cannot activate a closed fiscal year")
        open_fy = self._repo.get_open_fiscal_year(ctx, fy.company_id)
        if open_fy and open_fy.id != fy.id:
            raise ConflictException("Another fiscal year is already open for this company")
        self._repo.update_fiscal_year(ctx, fiscal_year_id, status=FiscalYearStatus.OPEN.value)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_fiscal_year",
            entity_id=fiscal_year_id,
            operation="activate",
            performed_by=ctx.user_id,
        )
        return self.get_fiscal_year(ctx, fiscal_year_id)

    def deactivate_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID):
        fy = self._repo.get_fiscal_year(ctx, fiscal_year_id)
        if fy is None:
            raise NotFoundException("Fiscal year not found")
        self._repo.update_fiscal_year(
            ctx, fiscal_year_id, status=FiscalYearStatus.ARCHIVED.value, is_default=False
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_fiscal_year",
            entity_id=fiscal_year_id,
            operation="deactivate",
            performed_by=ctx.user_id,
        )
        return self.get_fiscal_year(ctx, fiscal_year_id)

    def close_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID):
        fy = self._repo.get_fiscal_year(ctx, fiscal_year_id)
        if fy is None:
            raise NotFoundException("Fiscal year not found")
        periods = self._repo.list_periods(ctx, company_id=fy.company_id, fiscal_year_id=fy.id)
        if any(p.status != "hard_closed" for p in periods):
            raise ConflictException("All periods must be hard closed before year close")
        fy.status = FiscalYearStatus.CLOSED.value
        fy.closed_at = utcnow()
        fy.closed_by = ctx.user_id
        fy.is_default = False
        self._repo.update_fiscal_year(
            ctx,
            fiscal_year_id,
            status=fy.status,
            closed_at=fy.closed_at,
            closed_by=fy.closed_by,
            is_default=False,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_fiscal_year",
            entity_id=fy.id,
            operation="year_close",
            performed_by=ctx.user_id,
        )
        return self.get_fiscal_year(ctx, fiscal_year_id)

    def close_preview(self, ctx: TenantContext, fiscal_year_id: UUID) -> FiscalYearClosePreviewResponse:
        fy = self._repo.get_fiscal_year(ctx, fiscal_year_id)
        if fy is None:
            raise NotFoundException("Fiscal year not found")
        periods = self._repo.list_periods(ctx, company_id=fy.company_id, fiscal_year_id=fy.id)
        unclosed = [p for p in periods if p.status != "hard_closed"]
        open_journals = self._repo.count_journals_for_fiscal_year(ctx, fiscal_year_id)
        warnings: list[str] = []
        if unclosed:
            warnings.append(f"{len(unclosed)} period(s) are not hard closed")
        if open_journals:
            warnings.append(f"{open_journals} journal(s) exist in this fiscal year")
        return FiscalYearClosePreviewResponse(
            fiscal_year_id=fy.id,
            fiscal_year_code=fy.fiscal_year_code,
            open_journals=open_journals,
            unclosed_periods=len(unclosed),
            warnings=warnings,
            can_close=len(unclosed) == 0 and fy.status == FiscalYearStatus.OPEN.value,
        )

    def summary(self, ctx: TenantContext, company_id: UUID | None = None) -> FiscalSummaryResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        years = self._repo.list_fiscal_years(ctx, cid)
        periods = self._repo.list_periods(ctx, company_id=cid)
        active = self._repo.get_open_fiscal_year(ctx, cid) or self._repo.get_default_fiscal_year(ctx, cid)
        today = date.today()
        current = self._repo.get_current_period(ctx, cid, today)
        open_count = sum(1 for p in periods if p.status == "open")
        closed_count = sum(1 for p in periods if p.status in {"soft_closed", "hard_closed"})
        locked_count = sum(1 for p in periods if p.status == "hard_closed" or p.gl_closed)
        recently_closed = sorted(
            [p for p in periods if p.closed_at],
            key=lambda p: p.closed_at or utcnow(),
            reverse=True,
        )[:6]
        progress = 0.0
        if active:
            fy_periods = [p for p in periods if p.fiscal_year_id == active.id]
            if fy_periods:
                hard = sum(1 for p in fy_periods if p.status == "hard_closed")
                progress = round((hard / len(fy_periods)) * 100, 1)

        def map_period(p: FinPeriod) -> PeriodResponse:
            fy = self._repo.get_fiscal_year(ctx, p.fiscal_year_id)
            jc = self._repo.count_journals_in_period(ctx, p.id)
            posting = p.status == "open" and not p.gl_closed
            return PeriodResponse(
                id=p.id,
                company_id=p.company_id,
                fiscal_year_id=p.fiscal_year_id,
                period_number=p.period_number,
                period_name=p.period_name,
                start_date=p.start_date,
                end_date=p.end_date,
                status=p.status,
                ar_closed=p.ar_closed,
                ap_closed=p.ap_closed,
                inventory_closed=p.inventory_closed,
                payroll_closed=p.payroll_closed,
                gl_closed=p.gl_closed,
                closed_at=p.closed_at,
                closed_by=p.closed_by,
                created_by=p.created_by,
                created_at=p.created_at,
                updated_by=p.updated_by,
                updated_at=p.updated_at,
                version=p.version,
                fiscal_year_code=fy.fiscal_year_code if fy else None,
                fiscal_year_name=fy.fiscal_year_name if fy else None,
                journal_count=jc,
                journal_posting_allowed=posting,
                quarter=((p.period_number - 1) // 3) + 1,
            )

        return FiscalSummaryResponse(
            active_fiscal_year=self._to_response(ctx, active) if active else None,
            total_fiscal_years=len(years),
            open_periods=open_count,
            closed_periods=closed_count,
            locked_periods=locked_count,
            current_period=map_period(current) if current else None,
            recently_closed_periods=[map_period(p) for p in recently_closed],
            year_close_progress_pct=progress,
        )

    def reject_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID, comments: str | None = None):
        fy = self._repo.get_fiscal_year(ctx, fiscal_year_id)
        if fy is None:
            raise NotFoundException("Fiscal year not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_fiscal_year",
            entity_id=fiscal_year_id,
            operation="reject",
            performed_by=ctx.user_id,
            new_value={"comments": comments},
        )
        return self.get_fiscal_year(ctx, fiscal_year_id)

    def submit_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID, comments: str | None = None):
        fy = self._repo.get_fiscal_year(ctx, fiscal_year_id)
        if fy is None:
            raise NotFoundException("Fiscal year not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_fiscal_year",
            entity_id=fiscal_year_id,
            operation="submit",
            performed_by=ctx.user_id,
            new_value={"comments": comments},
        )
        return self.get_fiscal_year(ctx, fiscal_year_id)

    def approve_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID, comments: str | None = None):
        fy = self._repo.get_fiscal_year(ctx, fiscal_year_id)
        if fy is None:
            raise NotFoundException("Fiscal year not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_fiscal_year",
            entity_id=fiscal_year_id,
            operation="approve",
            performed_by=ctx.user_id,
            new_value={"comments": comments},
        )
        return self.get_fiscal_year(ctx, fiscal_year_id)

    def import_fiscal_years(self, ctx: TenantContext, company_id: UUID | None, rows: list) -> FiscalYearImportResult:
        created = 0
        errors: list[str] = []
        for idx, row in enumerate(rows, start=1):
            data = row.model_dump() if hasattr(row, "model_dump") else dict(row)
            try:
                self.create_fiscal_year(ctx, company_id=company_id, **data)
                created += 1
            except Exception as exc:  # noqa: BLE001
                errors.append(f"Row {idx}: {exc}")
        return FiscalYearImportResult(created=created, failed=len(errors), errors=errors)

    def _generate_periods(self, ctx: TenantContext, fy, company_id: UUID) -> None:
        current = fy.start_date
        for period_num in range(1, 13):
            if current > fy.end_date:
                break
            last_day = monthrange(current.year, current.month)[1]
            period_end = date(current.year, current.month, last_day)
            if period_end > fy.end_date:
                period_end = fy.end_date
            self._repo.create_period(
                ctx,
                company_id=company_id,
                fiscal_year_id=fy.id,
                period_number=period_num,
                period_name=current.strftime("%b-%Y"),
                start_date=current,
                end_date=period_end,
                status="open",
            )
            current = period_end + timedelta(days=1)

    def _to_response(self, ctx: TenantContext, fy) -> FiscalYearResponse:
        periods = self._repo.list_periods(ctx, company_id=fy.company_id, fiscal_year_id=fy.id)
        closed = sum(1 for p in periods if p.status in {"soft_closed", "hard_closed"})
        locked = sum(1 for p in periods if p.status == "hard_closed" or p.gl_closed)
        return FiscalYearResponse(
            id=fy.id,
            company_id=fy.company_id,
            fiscal_year_code=fy.fiscal_year_code,
            fiscal_year_name=fy.fiscal_year_name,
            start_date=fy.start_date,
            end_date=fy.end_date,
            status=fy.status,
            description=getattr(fy, "description", None),
            is_default=bool(getattr(fy, "is_default", False)),
            closed_at=fy.closed_at,
            closed_by=fy.closed_by,
            created_by=fy.created_by,
            created_at=fy.created_at,
            updated_by=fy.updated_by,
            updated_at=fy.updated_at,
            version=fy.version,
            period_count=len(periods),
            closed_period_count=closed,
            locked_period_count=locked,
            journal_count=self._repo.count_journals_for_fiscal_year(ctx, fy.id),
        )
