"""Unified deal timeline — lead → opportunity → quote → OVF → SCM → PO →
delivery → project handoff → project completion.

Composes the CRM opportunity timeline with the procurement OVF timeline and
the project handoff/completion milestones so sales can watch a deal end to end
from a single CRM tab. Procurement and project legs are best-effort: a failure
there never breaks the CRM portion of the timeline.
"""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.repository.ovf_repository import OvfRepository
from modules.crm.service.crm_record_visibility import CrmRecordVisibility
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.opportunity_timeline_service import OpportunityTimelineService
from modules.foundation.domain.value_objects import TenantContext


def _as_datetime(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)
    return None


def _sort_key(event: dict) -> float:
    occurred = event.get("occurred_at")
    dt = _as_datetime(occurred)
    if dt is None:
        return 0.0
    try:
        return dt.timestamp()
    except (OverflowError, ValueError):
        return 0.0


class DealTimelineService:
    """Aggregate the full deal lifecycle for CRM's Timeline tab."""

    def __init__(self, db: Session) -> None:
        self._db = db
        self._opportunities = OpportunityRepository(db)
        self._ovfs = OvfRepository(db)
        self._scope = CrmScopeValidator(db)
        self._visibility = CrmRecordVisibility(db)
        self._crm_timeline = OpportunityTimelineService(db)

    # ------------------------------------------------------------------ list
    def list_deals(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        cid = self._scope.resolve_list_company_id(ctx, company_id)
        allowed_ids = self._visibility.filter_opportunity_ids_for_user(ctx, cid)
        opps = self._opportunities.list_opportunities(ctx, cid, opportunity_ids=allowed_ids)
        opp_ids = [opp.id for opp in opps]
        ovfs = self._ovfs.list_ovfs(ctx, cid, opportunity_ids=opp_ids) if opp_ids else []

        ovf_by_opp: dict[UUID, list] = {}
        for ovf in ovfs:
            ovf_by_opp.setdefault(ovf.opportunity_id, []).append(ovf)

        rows: list[dict] = []
        for opp in opps:
            opp_ovfs = ovf_by_opp.get(opp.id, [])
            phase, timeline_status = self._derive_phase(opp, opp_ovfs)
            rows.append(
                {
                    "opportunity_id": opp.id,
                    "opportunity_code": opp.opportunity_code,
                    "opportunity_name": opp.opportunity_name,
                    "customer_name": getattr(opp, "customer_name", None)
                    or getattr(opp, "account_name", None),
                    "account_name": getattr(opp, "account_name", None),
                    "stage": getattr(opp, "current_stage", None)
                    or getattr(opp, "blueprint_state", None),
                    "status": getattr(opp, "status", None),
                    "phase": phase,
                    "timeline_status": timeline_status,
                    "deal_won": any(bool(getattr(o, "deal_won", False)) for o in opp_ovfs)
                    or (getattr(opp, "status", "") or "").lower() == "won",
                    "updated_at": getattr(opp, "updated_at", None)
                    or getattr(opp, "created_at", None),
                }
            )

        rows.sort(key=lambda r: (_as_datetime(r["updated_at"]) or datetime.min.replace(tzinfo=timezone.utc)), reverse=True)
        return rows

    @staticmethod
    def _derive_phase(opp, opp_ovfs: list) -> tuple[str, str]:
        state = (getattr(opp, "blueprint_state", "") or "").lower()
        status = (getattr(opp, "status", "") or "").lower()
        if status == "lost" or state == "lost":
            return "lost", "closed"
        won = status == "won" or state == "won" or any(
            bool(getattr(o, "deal_won", False)) for o in opp_ovfs
        )
        if won:
            return "completed", "completed"
        if any(bool(getattr(o, "shared_to_scm", False)) for o in opp_ovfs):
            return "scm", "ongoing"
        if opp_ovfs:
            return "ovf", "ongoing"
        return "crm", "ongoing"

    # --------------------------------------------------------------- timeline
    def timeline(self, ctx: TenantContext, opportunity_id: UUID) -> dict:
        opp = self._opportunities.get(ctx, opportunity_id)
        if opp is None:
            raise NotFoundException("Opportunity not found")
        self._visibility.ensure_opportunity_access(ctx, opp)

        crm = self._crm_timeline.timeline(ctx, opportunity_id)
        events: list[dict] = list(crm.get("events", []))

        ovfs = self._ovfs.list_ovfs(ctx, opp.company_id, opportunity_id=opportunity_id)
        for ovf in ovfs:
            events.extend(self._procurement_events(ctx, ovf.id))
            events.extend(self._project_events(ctx, ovf.id))

        # Dedupe by id (procurement + CRM both describe the SCM handoff).
        seen: set[str] = set()
        deduped: list[dict] = []
        for event in events:
            eid = str(event.get("id"))
            if eid in seen:
                continue
            seen.add(eid)
            deduped.append(event)

        deduped.sort(key=_sort_key)

        completed = any(
            (e.get("action") in {"deal_won", "project_completed", "delivery_completed"})
            for e in deduped
        )

        return {
            "opportunity_id": opportunity_id,
            "opportunity_code": opp.opportunity_code,
            "opportunity_name": opp.opportunity_name,
            "customer_name": getattr(opp, "customer_name", None)
            or getattr(opp, "account_name", None),
            "timeline_status": "completed" if completed else "ongoing",
            "events": deduped,
        }

    # ---------------------------------------------------------- procurement
    def _procurement_events(self, ctx: TenantContext, ovf_id: UUID) -> list[dict]:
        try:
            from modules.procurement.service.ovf_timeline_service import OvfTimelineService

            data = OvfTimelineService(self._db).timeline(ctx, ovf_id)
        except Exception:
            return []
        out: list[dict] = []
        for event in data.get("events", []):
            # CRM leg already emits the "OVF Shared to SCM" milestone.
            if (event.get("action") or "") == "share_to_scm":
                continue
            out.append(event)
        return out

    # --------------------------------------------------------------- project
    def _project_events(self, ctx: TenantContext, ovf_id: UUID) -> list[dict]:
        try:
            from modules.procurement.repository.order_repository import OrderRepository
            from modules.project.repository.po_queue_handoff_repository import (
                PoQueueHandoffRepository,
            )
            from modules.project.repository.project_repository import ProjectRepository

            orders = OrderRepository(self._db).list_by_source(
                ctx,
                source_module="crm",
                source_document_type="ovf",
                source_document_id=ovf_id,
            )
            if not orders:
                return []

            handoffs = PoQueueHandoffRepository(self._db)
            projects = ProjectRepository(self._db)
        except Exception:
            return []

        out: list[dict] = []
        for order in orders:
            po_label = (
                getattr(order, "company_po_number", None)
                or getattr(order, "document_number", None)
                or "Vendor PO"
            )
            project = None
            try:
                project = projects.get_by_proc_order_id(ctx, order.id)
            except Exception:
                project = None
            handoff = None
            try:
                handoff = handoffs.get_by_order_id(ctx, order.id)
            except Exception:
                handoff = None

            shared_at = _as_datetime(getattr(handoff, "shared_at", None)) or (
                _as_datetime(getattr(project, "created_at", None)) if project else None
            )
            if shared_at is not None:
                out.append(
                    self._event(
                        event_id=f"project-shared-{order.id}",
                        occurred_at=shared_at,
                        event_type="state_transition",
                        entity_type="project",
                        entity_id=order.id,
                        entity_label=po_label,
                        title="Shared to Project Management",
                        summary=f"{po_label} handed off to Projects",
                        action="shared_to_project",
                        to_state="project_queue",
                    )
                )

            if project is not None:
                created = _as_datetime(getattr(project, "created_at", None))
                project_label = (
                    getattr(project, "project_code", None)
                    or getattr(project, "project_name", None)
                    or "Project"
                )
                if created is not None:
                    out.append(
                        self._event(
                            event_id=f"project-created-{project.id}",
                            occurred_at=created,
                            event_type="created",
                            entity_type="project",
                            entity_id=project.id,
                            entity_label=project_label,
                            title="Project Created",
                            summary=getattr(project, "project_name", None),
                            action="project_created",
                            to_state=getattr(project, "status", None),
                        )
                    )
                status = (getattr(project, "status", "") or "").lower()
                if status == "completed":
                    done = _as_datetime(getattr(project, "actual_end_date", None)) or _as_datetime(
                        getattr(project, "updated_at", None)
                    )
                    if done is not None:
                        out.append(
                            self._event(
                                event_id=f"project-completed-{project.id}",
                                occurred_at=done,
                                event_type="state_transition",
                                entity_type="project",
                                entity_id=project.id,
                                entity_label=project_label,
                                title="Project Completed",
                                summary=getattr(project, "project_name", None),
                                action="project_completed",
                                to_state="completed",
                            )
                        )
        return out

    @staticmethod
    def _event(
        *,
        event_id: str,
        occurred_at: datetime,
        event_type: str,
        entity_type: str,
        entity_id: UUID | None,
        entity_label: str | None,
        title: str,
        summary: str | None = None,
        action: str | None = None,
        from_state: str | None = None,
        to_state: str | None = None,
        actor_id: UUID | None = None,
        actor_name: str | None = None,
    ) -> dict:
        return {
            "id": event_id,
            "occurred_at": occurred_at,
            "event_type": event_type,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_label": entity_label,
            "title": title,
            "summary": summary,
            "action": action,
            "from_state": from_state,
            "to_state": to_state,
            "actor_id": actor_id,
            "actor_name": actor_name,
            "requested_by_id": None,
            "requested_by_name": None,
            "decided_by_id": None,
            "decided_by_name": None,
            "assignee_names": [],
            "decision": None,
            "team_role": None,
            "remark": None,
            "version": None,
        }
