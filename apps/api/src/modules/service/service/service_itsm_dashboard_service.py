"""ITSM dashboard aggregations for service request tickets."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.models.party import MasterCustomer
from modules.service.models import SvcServiceRequest, SvcTicketReopenRequest
from modules.service.service.service_request_ticket_service import ServiceRequestTicketService
from modules.service.service.service_scope_validator import ServiceScopeValidator
from modules.service.service_itsm_schemas import (
    DashboardCountItem,
    DashboardCustomerItem,
    DashboardEngineerWorkload,
    DashboardRepeatedCircuit,
    DashboardTrendPoint,
    ServiceDashboardSummary,
)

ACTIVE_STATUSES = (
    "ticket_registered",
    "new",
    "submitted",
    "approved",
    "awaiting_assignment",
    "assigned",
    "engineer_working",
    "in_progress",
    "pending_customer",
    "pending_oem",
)


class ServiceItsmDashboardService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._scope = ServiceScopeValidator(db)
        self._tickets = ServiceRequestTicketService(db)

    def summary(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        mine: bool = False,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> ServiceDashboardSummary:
        cid = self._scope.resolve_company_id(ctx, company_id)
        now = datetime.now(timezone.utc)
        if date_to is None:
            date_to = now
        if date_from is None:
            date_from = date_to - timedelta(days=30)

        base = select(SvcServiceRequest).where(
            SvcServiceRequest.company_id == cid,
            SvcServiceRequest.is_deleted.is_(False),
            SvcServiceRequest.created_at >= date_from,
            SvcServiceRequest.created_at <= date_to,
        )
        base = self._scope.apply_svc_filter(base, SvcServiceRequest, ctx, branch_scoped=True)
        if mine:
            base = self._tickets._apply_mine_filter(base, ctx)

        rows = list(self._db.scalars(base).all())
        total = len(rows)
        open_tickets = sum(1 for r in rows if r.status in ACTIVE_STATUSES)
        unassigned = sum(
            1
            for r in rows
            if r.status in ACTIVE_STATUSES and r.owner_employee_id is None
        )

        status_counts: dict[str, int] = defaultdict(int)
        priority_counts: dict[str, int] = defaultdict(int)
        customer_buckets: dict[UUID, dict[str, int]] = defaultdict(lambda: {"total": 0, "open": 0})
        circuit_buckets: dict[str, dict] = {}
        engineer_open: dict[UUID, dict[str, int]] = defaultdict(lambda: {"open": 0, "breached": 0})

        for r in rows:
            status_counts[r.status] += 1
            priority_counts[(r.priority or "medium").lower()] += 1
            customer_buckets[r.customer_id]["total"] += 1
            if r.status in ACTIVE_STATUSES:
                customer_buckets[r.customer_id]["open"] += 1

            ckt = ServiceRequestTicketService._normalize_circuit(r.ckt_id) or ServiceRequestTicketService._normalize_circuit(
                r.lsi
            )
            if ckt:
                bucket = circuit_buckets.setdefault(
                    ckt,
                    {"ckt_id": ckt, "customer_id": r.customer_id, "count": 0, "last_at": None},
                )
                bucket["count"] += 1
                if bucket["last_at"] is None or r.created_at > bucket["last_at"]:
                    bucket["last_at"] = r.created_at

            if r.owner_employee_id and r.status in ACTIVE_STATUSES:
                engineer_open[r.owner_employee_id]["open"] += 1
                if self._tickets._is_active_breached(r, now=now):
                    engineer_open[r.owner_employee_id]["breached"] += 1

        customer_names = self._customer_names(list(customer_buckets.keys()))
        owner_names = self._owner_names(list(engineer_open.keys()))

        by_status = [
            DashboardCountItem(key=k, label=k.replace("_", " ").title(), count=v)
            for k, v in sorted(status_counts.items(), key=lambda x: (-x[1], x[0]))
        ]
        by_priority = [
            DashboardCountItem(key=k, label=k.upper(), count=v)
            for k, v in sorted(priority_counts.items(), key=lambda x: (-x[1], x[0]))
        ]
        by_customer = [
            DashboardCustomerItem(
                customer_id=cid_,
                customer_name=customer_names.get(cid_),
                total=b["total"],
                open=b["open"],
            )
            for cid_, b in sorted(customer_buckets.items(), key=lambda x: (-x[1]["total"], str(x[0])))
        ][:25]

        engineer_workload = [
            DashboardEngineerWorkload(
                owner_employee_id=eid,
                owner_name=owner_names.get(eid),
                open_tickets=counts["open"],
                breached_tickets=counts["breached"],
            )
            for eid, counts in sorted(engineer_open.items(), key=lambda x: (-x[1]["open"], str(x[0])))
        ]

        repeated_circuits = [
            DashboardRepeatedCircuit(
                ckt_id=b["ckt_id"],
                customer_id=b["customer_id"],
                customer_name=customer_names.get(b["customer_id"]),
                ticket_count=b["count"],
                last_ticket_at=b["last_at"],
            )
            for b in circuit_buckets.values()
            if b["count"] > 1
        ]
        repeated_circuits.sort(key=lambda x: (-x.ticket_count, x.ckt_id))

        trend = self._daily_trend(ctx, cid=cid, date_from=date_from, date_to=date_to, mine=mine)
        sla = self._tickets.sla_compliance_summary(ctx, company_id=company_id, mine=mine)

        pending_reopen = self._pending_reopen_count(ctx, cid)

        return ServiceDashboardSummary(
            total_tickets=total,
            open_tickets=open_tickets,
            unassigned_tickets=unassigned,
            pending_reopen_requests=pending_reopen,
            by_status=by_status,
            by_priority=by_priority,
            by_customer=by_customer,
            engineer_workload=engineer_workload,
            repeated_circuits=repeated_circuits,
            trend=trend,
            trend_granularity="day",
            sla=sla,
            date_from=date_from,
            date_to=date_to,
        )

    def _pending_reopen_count(self, ctx: TenantContext, company_id: UUID) -> int:
        stmt = select(func.count()).select_from(SvcTicketReopenRequest).where(
            SvcTicketReopenRequest.tenant_id == ctx.tenant_id,
            SvcTicketReopenRequest.company_id == company_id,
            SvcTicketReopenRequest.status == "pending",
        )
        return int(self._db.scalar(stmt) or 0)

    def _customer_names(self, ids: list[UUID]) -> dict[UUID, str]:
        if not ids:
            return {}
        rows = self._db.execute(
            select(MasterCustomer.id, MasterCustomer.customer_name).where(MasterCustomer.id.in_(set(ids)))
        ).all()
        return {cid: name for cid, name in rows}

    def _owner_names(self, ids: list[UUID]) -> dict[UUID, str]:
        return self._tickets._owner_display_names(ids)

    def _daily_trend(
        self,
        ctx: TenantContext,
        *,
        cid: UUID,
        date_from: datetime,
        date_to: datetime,
        mine: bool,
    ) -> list[DashboardTrendPoint]:
        stmt = select(SvcServiceRequest).where(
            SvcServiceRequest.company_id == cid,
            SvcServiceRequest.is_deleted.is_(False),
            or_(
                SvcServiceRequest.created_at.between(date_from, date_to),
                SvcServiceRequest.resolved_at.between(date_from, date_to),
                SvcServiceRequest.closed_at.between(date_from, date_to),
            ),
        )
        stmt = self._scope.apply_svc_filter(stmt, SvcServiceRequest, ctx, branch_scoped=True)
        if mine:
            stmt = self._tickets._apply_mine_filter(stmt, ctx)
        rows = list(self._db.scalars(stmt).all())

        buckets: dict[date, dict[str, int]] = defaultdict(lambda: {"created": 0, "resolved": 0, "closed": 0})
        for r in rows:
            if r.created_at and date_from <= r.created_at <= date_to:
                buckets[r.created_at.date()]["created"] += 1
            if r.resolved_at and date_from <= r.resolved_at <= date_to:
                buckets[r.resolved_at.date()]["resolved"] += 1
            if r.closed_at and date_from <= r.closed_at <= date_to:
                buckets[r.closed_at.date()]["closed"] += 1

        points: list[DashboardTrendPoint] = []
        cursor = date_from.date()
        end = date_to.date()
        while cursor <= end:
            b = buckets.get(cursor, {"created": 0, "resolved": 0, "closed": 0})
            points.append(
                DashboardTrendPoint(
                    period_start=cursor,
                    created=b["created"],
                    resolved=b["resolved"],
                    closed=b["closed"],
                )
            )
            cursor += timedelta(days=1)
        return points