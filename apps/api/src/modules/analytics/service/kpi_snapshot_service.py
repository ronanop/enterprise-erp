"""Daily KPI values stored in bi_data_snapshot.payload_json (no schema change)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.analytics.domain.exceptions import UnknownKpiSource
from modules.analytics.models import BiDataSnapshot, BiDataset, BiKpi
from modules.analytics.repository.data_snapshot_repository import DataSnapshotRepository
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.models.employee import MasterEmployee

KPI_DAILY_KIND = "kpi_daily"
KPI_DAILY_DATASET_CODE = "KPI-DAILY"


class KpiDailySnapshotService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = DataSnapshotRepository(db)

    def history_for_kpi(self, ctx: TenantContext, company_id: UUID, kpi_id: UUID) -> list[dict]:
        rows = self._repo.list_rows(ctx, company_id)
        kid = str(kpi_id)
        points: list[dict] = []
        for row in rows:
            payload = row.payload_json or {}
            if payload.get("kind") != KPI_DAILY_KIND:
                continue
            day = row.period_end
            if day is None and row.snapshot_at is not None:
                day = row.snapshot_at.date()
            for item in payload.get("kpis") or []:
                if str(item.get("kpi_id")) != kid:
                    continue
                raw = item.get("value")
                if raw is None or day is None:
                    continue
                points.append({"date": day, "value": Decimal(str(raw))})
        points.sort(key=lambda item: item["date"])
        return points

    def capture_company(self, ctx: TenantContext, company_id: UUID, as_of: date) -> BiDataSnapshot:
        from modules.analytics.service.kpi_service import KpiService

        kpi_svc = KpiService(self._db)
        kpis = [row for row in kpi_svc.list(ctx, company_id) if (row.source_kpi_key or "").strip()]
        values: list[dict[str, str]] = []
        for kpi in kpis:
            try:
                updated = kpi_svc.compute_current_value(ctx, kpi.id)
            except UnknownKpiSource:
                continue
            if updated.current_value is None:
                continue
            values.append({"kpi_id": str(updated.id), "value": str(updated.current_value)})

        dataset = self._ensure_dataset(ctx, company_id)
        payload = {"kind": KPI_DAILY_KIND, "kpis": values}
        existing = self._find_day(ctx, company_id, dataset.id, as_of)
        now = datetime.now(timezone.utc)
        if existing is not None:
            return self._repo.update(
                ctx,
                existing.id,
                payload_json=payload,
                row_count=len(values),
                snapshot_at=now,
                period_start=as_of,
                period_end=as_of,
                status="ready",
            )
        number = f"KPIH-{as_of.isoformat()}"
        return self._repo.create(
            ctx,
            company_id=company_id,
            dataset_id=dataset.id,
            snapshot_number=number,
            snapshot_at=now,
            period_start=as_of,
            period_end=as_of,
            row_count=len(values),
            payload_json=payload,
            status="ready",
        )

    def capture_all(self, as_of: date | None = None) -> dict:
        day = as_of or date.today()
        kpis = list(
            self._db.scalars(
                select(BiKpi).where(
                    BiKpi.is_deleted.is_(False),
                    BiKpi.source_kpi_key.is_not(None),
                )
            ).all()
        )
        companies: dict[UUID, BiKpi] = {}
        for kpi in kpis:
            companies.setdefault(kpi.company_id, kpi)
        captured = 0
        for company_id, sample in companies.items():
            ctx = TenantContext(
                tenant_id=sample.tenant_id,
                user_id=sample.created_by or sample.updated_by,
                user_type="tenant_admin",
                company_id=company_id,
            )
            if ctx.user_id is None:
                continue
            self.capture_company(ctx, company_id, day)
            captured += 1
        return {"status": "ok", "as_of": day.isoformat(), "companies": captured}

    def _find_day(
        self, ctx: TenantContext, company_id: UUID, dataset_id: UUID, as_of: date
    ) -> BiDataSnapshot | None:
        for row in self._repo.list_rows(ctx, company_id):
            payload = row.payload_json or {}
            if (
                row.dataset_id == dataset_id
                and row.period_end == as_of
                and payload.get("kind") == KPI_DAILY_KIND
            ):
                return row
        return None

    def _ensure_dataset(self, ctx: TenantContext, company_id: UUID) -> BiDataset:
        existing = self._db.scalar(
            select(BiDataset).where(
                BiDataset.company_id == company_id,
                BiDataset.dataset_code == KPI_DAILY_DATASET_CODE,
                BiDataset.is_deleted.is_(False),
            )
        )
        if existing is not None:
            return existing
        owner = self._db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.company_id == company_id,
                MasterEmployee.is_deleted.is_(False),
            )
        )
        if owner is None:
            raise RuntimeError("Cannot create KPI-DAILY dataset without an employee owner")
        row = BiDataset(
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            dataset_number="DS-KPI-DAILY",
            dataset_code=KPI_DAILY_DATASET_CODE,
            dataset_name="KPI daily history",
            dataset_type="operational",
            description="One JSON payload per company-day of computed KPI values",
            owner_employee_id=owner.id,
            grain_description="One snapshot row per company per day",
            status="active",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(row)
        self._db.flush()
        return row
