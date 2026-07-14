"""Quality report service."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.repository.capa_repository import CapaRepository
from modules.quality.repository.defect_repository import DefectRepository
from modules.quality.repository.final_inspection_repository import FinalInspectionRepository
from modules.quality.repository.incoming_inspection_repository import IncomingInspectionRepository
from modules.quality.repository.ncr_repository import NcrRepository
from modules.quality.service.qm_scope_validator import QmScopeValidator


class QualityReportService:
    def __init__(self, db: Session) -> None:
        self._incoming = IncomingInspectionRepository(db)
        self._final = FinalInspectionRepository(db)
        self._defects = DefectRepository(db)
        self._ncrs = NcrRepository(db)
        self._capas = CapaRepository(db)
        self._scope = QmScopeValidator(db)

    def inspection_summary(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        incoming = self._incoming.list_inspections(ctx, cid)
        final = self._final.list_inspections(ctx, cid)
        data = [
            {
                "type": "incoming",
                "id": str(r.id),
                "document_number": r.document_number,
                "status": r.status,
                "result": r.result,
            }
            for r in incoming
        ] + [
            {
                "type": "final",
                "id": str(r.id),
                "document_number": r.document_number,
                "status": r.status,
                "result": r.result,
            }
            for r in final
        ]
        return {"name": "inspection-summary", "row_count": len(data), "rows": data}

    def defect_summary(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._defects.list_defects(ctx, cid)
        data = [
            {
                "defect_id": str(r.id),
                "document_number": r.document_number,
                "severity": r.severity,
                "status": r.status,
                "quantity": float(r.quantity),
            }
            for r in rows
        ]
        return {"name": "defect-summary", "row_count": len(data), "rows": data}

    def ncr_summary(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._ncrs.list_ncrs(ctx, cid)
        data = [
            {
                "ncr_id": str(r.id),
                "document_number": r.document_number,
                "severity": r.severity,
                "status": r.status,
            }
            for r in rows
        ]
        return {"name": "ncr-summary", "row_count": len(data), "rows": data}

    def capa_summary(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._capas.list_capas(ctx, cid)
        data = [
            {
                "capa_id": str(r.id),
                "document_number": r.document_number,
                "capa_type": r.capa_type,
                "status": r.status,
            }
            for r in rows
        ]
        return {"name": "capa-summary", "row_count": len(data), "rows": data}

    def kpi_dashboard(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        incoming = self._incoming.list_inspections(ctx, cid)
        defects = self._defects.list_defects(ctx, cid)
        ncrs = self._ncrs.list_ncrs(ctx, cid)
        return {
            "name": "kpi-dashboard",
            "row_count": 1,
            "rows": [
                {
                    "incoming_count": len(incoming),
                    "defect_count": len(defects),
                    "ncr_count": len(ncrs),
                    "open_ncrs": len([n for n in ncrs if n.status not in {"closed", "cancelled"}]),
                }
            ],
        }
