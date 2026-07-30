"""KPI definition + OKR services."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.repository.kpi_okr_repository import KpiRepository, OkrRepository
from modules.hr.service.hr_scope_validator import HrScopeValidator

_MEASURES = {"percentage", "number", "currency", "rating"}


def _weighted_progress(key_results: list) -> Decimal:
    active = [kr for kr in key_results if not getattr(kr, "is_deleted", False)]
    if not active:
        return Decimal("0")
    total_w = sum(Decimal(str(kr.weightage or 1)) for kr in active)
    if total_w <= 0:
        return Decimal("0")
    score = sum(
        Decimal(str(kr.progress_pct or 0)) * Decimal(str(kr.weightage or 1)) for kr in active
    )
    return (score / total_w).quantize(Decimal("0.01"))


class KpiService:
    def __init__(self, db: Session) -> None:
        self._repo = KpiRepository(db)
        self._scope = HrScopeValidator(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("KPI not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        name: str,
        company_id: UUID | None = None,
        department: str = "",
        designation: str | None = None,
        weightage: Decimal | float = 0,
        target: Decimal | float = 0,
        measure_type: str = "number",
        rating_scale: int = 5,
        status: str = "active",
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        if measure_type not in _MEASURES:
            raise AppException(f"Invalid measure_type '{measure_type}'")
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            name=name,
            department=department or "",
            designation=designation,
            weightage=Decimal(str(weightage)),
            target=Decimal(str(target)),
            measure_type=measure_type,
            rating_scale=int(rating_scale or 5),
            status=status or "active",
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_kpi",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        if "measure_type" in fields and fields["measure_type"] is not None:
            if fields["measure_type"] not in _MEASURES:
                raise AppException(f"Invalid measure_type '{fields['measure_type']}'")
        for key in ("weightage", "target"):
            if key in fields and fields[key] is not None:
                fields[key] = Decimal(str(fields[key]))
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("KPI not found")
        return row

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("KPI not found")


class OkrService:
    def __init__(self, db: Session) -> None:
        self._repo = OkrRepository(db)
        self._scope = HrScopeValidator(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("OKR not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        title: str,
        company_id: UUID | None = None,
        owner: str = "",
        department: str = "",
        weightage: Decimal | float = 0,
        status: str = "active",
        key_results: list[dict] | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            title=title,
            owner=owner or "",
            department=department or "",
            weightage=Decimal(str(weightage)),
            progress_pct=Decimal("0"),
            status=status or "active",
        )
        for i, kr in enumerate(key_results or []):
            self._repo.add_key_result(
                ctx,
                row,
                title=str(kr.get("title") or f"KR {i + 1}"),
                progress_pct=Decimal(str(kr.get("progress_pct") or kr.get("progressPct") or 0)),
                weightage=Decimal(str(kr.get("weightage") or 1)),
                sequence_no=int(kr.get("sequence_no") or i + 1),
                status="active",
            )
        refreshed = self.get(ctx, row.id)
        progress = _weighted_progress(list(refreshed.key_results or []))
        return self._repo.update(ctx, row.id, progress_pct=progress) or refreshed

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        key_results = fields.pop("key_results", None)
        if "weightage" in fields and fields["weightage"] is not None:
            fields["weightage"] = Decimal(str(fields["weightage"]))
        if key_results is not None:
            # Replace strategy: soft-delete existing, add new
            existing = self.get(ctx, row_id)
            for kr in list(existing.key_results or []):
                self._repo.soft_delete_key_result(ctx, kr.id)
            for i, kr in enumerate(key_results):
                self._repo.add_key_result(
                    ctx,
                    existing,
                    title=str(kr.get("title") or f"KR {i + 1}"),
                    progress_pct=Decimal(str(kr.get("progress_pct") or kr.get("progressPct") or 0)),
                    weightage=Decimal(str(kr.get("weightage") or 1)),
                    sequence_no=int(kr.get("sequence_no") or i + 1),
                    status="active",
                )
            refreshed = self.get(ctx, row_id)
            fields["progress_pct"] = _weighted_progress(list(refreshed.key_results or []))
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("OKR not found")
        return self.get(ctx, row_id)

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("OKR not found")

    def add_key_result(
        self,
        ctx: TenantContext,
        okr_id: UUID,
        *,
        title: str,
        progress_pct: Decimal | float = 0,
        weightage: Decimal | float = 1,
        sequence_no: int | None = None,
    ):
        okr = self.get(ctx, okr_id)
        seq = sequence_no or (len([k for k in (okr.key_results or []) if not k.is_deleted]) + 1)
        self._repo.add_key_result(
            ctx,
            okr,
            title=title,
            progress_pct=Decimal(str(progress_pct)),
            weightage=Decimal(str(weightage)),
            sequence_no=seq,
            status="active",
        )
        refreshed = self.get(ctx, okr_id)
        progress = _weighted_progress(list(refreshed.key_results or []))
        return self._repo.update(ctx, okr_id, progress_pct=progress) or refreshed

    def update_key_result(self, ctx: TenantContext, okr_id: UUID, kr_id: UUID, **fields):
        okr = self.get(ctx, okr_id)
        kr = self._repo.get_key_result(ctx, kr_id)
        if kr is None or kr.okr_id != okr.id:
            raise NotFoundException("Key result not found")
        for key in ("progress_pct", "weightage"):
            if key in fields and fields[key] is not None:
                fields[key] = Decimal(str(fields[key]))
        self._repo.update_key_result(ctx, kr_id, **fields)
        refreshed = self.get(ctx, okr_id)
        progress = _weighted_progress(list(refreshed.key_results or []))
        return self._repo.update(ctx, okr_id, progress_pct=progress) or refreshed

    def delete_key_result(self, ctx: TenantContext, okr_id: UUID, kr_id: UUID):
        okr = self.get(ctx, okr_id)
        kr = self._repo.get_key_result(ctx, kr_id)
        if kr is None or kr.okr_id != okr.id:
            raise NotFoundException("Key result not found")
        self._repo.soft_delete_key_result(ctx, kr_id)
        refreshed = self.get(ctx, okr_id)
        progress = _weighted_progress(list(refreshed.key_results or []))
        return self._repo.update(ctx, okr_id, progress_pct=progress) or refreshed
