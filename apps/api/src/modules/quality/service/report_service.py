"""Quality report service."""

from collections import defaultdict
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.repository.capa_repository import CapaRepository
from modules.quality.repository.characteristic_repository import CharacteristicRepository
from modules.quality.repository.defect_repository import DefectRepository
from modules.quality.repository.final_inspection_repository import FinalInspectionRepository
from modules.quality.repository.incoming_inspection_repository import IncomingInspectionRepository
from modules.quality.repository.inprocess_inspection_repository import InprocessInspectionRepository
from modules.quality.repository.ncr_repository import NcrRepository
from modules.quality.repository.ppap_repository import PpapRepository
from modules.quality.repository.scar_repository import ScarRepository
from modules.quality.repository.spc_reading_repository import SpcReadingRepository
from modules.quality.repository.warranty_claim_repository import WarrantyClaimRepository
from modules.quality.service.engines.spc_engine import SpcEngine
from modules.quality.service.qm_scope_validator import QmScopeValidator

PPAP_STATUSES = ("draft", "submitted", "approved", "rejected", "interim")


def _num(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def warranty_trend_rows(claims) -> list[dict]:
    grouped: dict[tuple[str, str, str], dict] = defaultdict(
        lambda: {"claim_count": 0, "quantity": Decimal("0")}
    )
    for row in claims:
        period = row.document_date.strftime("%Y-%m") if row.document_date else ""
        product_id = str(row.product_id) if row.product_id else ""
        component_id = str(row.component_product_id) if row.component_product_id else ""
        bucket = grouped[(product_id, component_id, period)]
        bucket["claim_count"] += 1
        bucket["quantity"] += Decimal(str(row.quantity or 0))
    data = [
        {
            "product_id": product_id or None,
            "component_product_id": component_id or None,
            "period": period,
            "claim_count": values["claim_count"],
            "quantity": float(values["quantity"]),
        }
        for (product_id, component_id, period), values in grouped.items()
    ]
    data.sort(key=lambda r: (r["period"] or "", r["product_id"] or "", r["component_product_id"] or ""))
    return data


class QualityReportService:
    def __init__(self, db: Session) -> None:
        self._incoming = IncomingInspectionRepository(db)
        self._inprocess = InprocessInspectionRepository(db)
        self._final = FinalInspectionRepository(db)
        self._defects = DefectRepository(db)
        self._ncrs = NcrRepository(db)
        self._capas = CapaRepository(db)
        self._ppaps = PpapRepository(db)
        self._scars = ScarRepository(db)
        self._spc = SpcReadingRepository(db)
        self._chars = CharacteristicRepository(db)
        self._warranty = WarrantyClaimRepository(db)
        self._spc_engine = SpcEngine()
        self._scope = QmScopeValidator(db)

    def inspection_summary(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        incoming = self._incoming.list_inspections(ctx, cid)
        inprocess = self._inprocess.list_inspections(ctx, cid)
        final = self._final.list_inspections(ctx, cid)
        data = (
            [
                {
                    "type": "incoming",
                    "id": str(r.id),
                    "document_number": r.document_number,
                    "status": r.status,
                    "result": r.result,
                }
                for r in incoming
            ]
            + [
                {
                    "type": "inprocess",
                    "id": str(r.id),
                    "document_number": r.document_number,
                    "status": r.status,
                    "result": r.result,
                }
                for r in inprocess
            ]
            + [
                {
                    "type": "final",
                    "id": str(r.id),
                    "document_number": r.document_number,
                    "status": r.status,
                    "result": r.result,
                }
                for r in final
            ]
        )
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

    def ppap_status_summary(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._ppaps.list_ppaps(ctx, cid)
        counts = {status: 0 for status in PPAP_STATUSES}
        for row in rows:
            if row.status in counts:
                counts[row.status] += 1
            else:
                counts[row.status] = counts.get(row.status, 0) + 1
        data = [{"status": status, "count": counts[status]} for status in counts]
        return {"name": "ppap-status-summary", "row_count": len(data), "rows": data}

    def scar_summary(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._scars.list_scars(ctx, cid)
        data = [
            {
                "scar_id": str(r.id),
                "document_number": r.document_number,
                "severity": r.severity,
                "status": r.status,
                "vendor_id": str(r.vendor_id) if r.vendor_id else None,
                "due_date": r.due_date.isoformat() if r.due_date else None,
            }
            for r in rows
        ]
        return {"name": "scar-summary", "row_count": len(data), "rows": data}

    def spc_capability_summary(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        readings = self._spc.list_readings(ctx, cid)
        char_ids = list(dict.fromkeys(r.characteristic_id for r in readings))
        data = []
        for characteristic_id in char_ids:
            char = self._chars.get(ctx, characteristic_id)
            window = self._spc.list_window(ctx, cid, characteristic_id)
            cap = self._spc_engine.compute_capability(
                characteristic_id,
                [r.measured_value for r in window],
                min_value=char.min_value if char else None,
                max_value=char.max_value if char else None,
                target_value=char.target_value if char else None,
            )
            data.append(
                {
                    "characteristic_id": str(characteristic_id),
                    "characteristic_code": char.characteristic_code if char else None,
                    "characteristic_name": char.characteristic_name if char else None,
                    "sample_count": cap.sample_count,
                    "mean": _num(cap.mean),
                    "stdev": _num(cap.stdev),
                    "lsl": _num(cap.lsl),
                    "usl": _num(cap.usl),
                    "cp": _num(cap.cp),
                    "cpk": _num(cap.cpk),
                }
            )
        return {"name": "spc-capability-summary", "row_count": len(data), "rows": data}

    def warranty_trend(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._warranty.list_claims(ctx, cid)
        data = warranty_trend_rows(rows)
        return {"name": "warranty-trend", "row_count": len(data), "rows": data}
