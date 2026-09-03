"""Aggregate OVF lifecycle activity into a chronological procurement timeline."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.crm.repository.ovf_repository import OvfRepository
from modules.crm.repository.state_history_repository import StateHistoryRepository
from modules.crm.service.ovf_service import serialize_scm_hold_history
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.audit_repository import AuditRepository
from modules.foundation.repository.user_repository import UserRepository
from modules.procurement.models.receipt_batch import ProcOrderReceiptBatch
from modules.procurement.repository.order_repository import OrderRepository
from modules.procurement.service.procurement_scope_validator import ProcurementScopeValidator

_CLIENT_TIMELINE_ENTITY = "proc_ovf_timeline"
_SKIP_AUDIT_OPERATIONS = frozenset({"notify_approved", "notify_rejected"})

_PROC_AUDIT_TITLES: dict[str, str] = {
    "create_from_ovf": "Vendor PO created from OVF",
    "create_from_ovf_hold": "Vendor PO saved on hold",
    "update_draft_from_ovf": "Vendor PO draft updated",
    "fulfill_from_stock": "Stock allocated to OVF",
    "create_from_inventory": "Inventory PO created",
    "scm_finalize": "Vendor PO finalized",
    "finalize": "Vendor PO finalized",
    "create": "Vendor PO created",
    "submit": "Vendor PO submitted",
    "approve": "Vendor PO approved",
    "reject": "Vendor PO rejected",
    "send": "Vendor PO sent to vendor",
    "scm_hold": "OVF placed on SCM hold",
    "scm_release": "SCM hold released",
    "grn_update": "GRN receipt recorded",
    "grn_reverse": "GRN reversed",
    "confirm": "GRN confirmed",
    "delivery_challan_created": "Delivery challan created",
    "billing_document_created": "Billing document created",
    "delivery_challan_updated": "Delivery challan updated",
    "delivery_dispatch": "Dispatch recorded",
    "delivery_completed": "Delivery completed",
    "delivery_failed": "Delivery failed",
    "bill_taken": "Bill taken",
}


def _humanize(value: str | None) -> str | None:
    if not value:
        return None
    return value.replace("_", " ").strip().title()


def _timeline_status(ovf, events: list[dict] | None = None) -> str:
    if bool(getattr(ovf, "deal_won", False)) or getattr(ovf, "blueprint_state", "") == "deal_won":
        return "completed"
    if events and any(
        event.get("action") in {"delivery_completed", "deal_won"} for event in events
    ):
        return "completed"
    return "ongoing"


class OvfTimelineService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._ovfs = OvfRepository(db)
        self._history = StateHistoryRepository(db)
        self._users = UserRepository(db)
        self._audit = AuditRepository(db)
        self._orders = OrderRepository(db)
        self._scope = ProcurementScopeValidator(db)

    def list_ovfs(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._ovfs.list_for_procurement_timeline(ctx, cid)
        return [
            {
                "ovf_id": row.id,
                "ovf_no": row.ovf_no,
                "customer_name": row.customer_name,
                "quote_name": row.quote_name,
                "account_name": row.account_name,
                "blueprint_state": row.blueprint_state,
                "shared_to_scm": bool(row.shared_to_scm),
                "deal_won": bool(getattr(row, "deal_won", False)),
                "timeline_status": _timeline_status(row),
                "updated_at": row.updated_at,
                "shared_to_scm_at": getattr(row, "shared_to_scm_at", None),
                "company_po_numbers": self._linked_company_po_numbers(ctx, row.id),
            }
            for row in rows
        ]

    def record_event(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        action: str,
        title: str,
        summary: str | None = None,
        entity_label: str | None = None,
        occurred_at: datetime | None = None,
        metadata: dict | None = None,
    ) -> None:
        ovf = self._ovfs.get(ctx, ovf_id)
        if ovf is None:
            raise NotFoundException("OVF not found")
        payload: dict = {
            "title": title,
            "summary": summary,
            "entity_label": entity_label,
            "occurred_at": occurred_at.isoformat() if occurred_at else None,
        }
        if metadata:
            payload.update(metadata)
        self._audit.create_log(
            tenant_id=ctx.tenant_id,
            entity_name=_CLIENT_TIMELINE_ENTITY,
            entity_id=ovf_id,
            operation=action,
            performed_by=ctx.user_id,
            new_value=payload,
        )

    def timeline(self, ctx: TenantContext, ovf_id: UUID) -> dict:
        ovf = self._ovfs.get(ctx, ovf_id)
        if ovf is None:
            raise NotFoundException("OVF not found")

        entity_label = f"OVF {ovf.ovf_no}"
        history_rows = self._history.list_for_entity(ctx, "ovf", ovf_id)
        share_history = next((row for row in history_rows if row.action == "share_to_scm"), None)

        linked_orders = self._orders.list_by_source(
            ctx,
            source_module="crm",
            source_document_type="ovf",
            source_document_id=ovf_id,
        )
        order_ids = [order.id for order in linked_orders]
        order_labels = {
            order.id: (order.company_po_number or order.document_number or "Vendor PO")
            for order in linked_orders
        }

        line_ids: list[UUID] = []
        for order in linked_orders:
            full = self._orders.get_order(ctx, order.id)
            if full and full.lines:
                line_ids.extend(line.id for line in full.lines)

        batch_rows = self._list_receipt_batches(order_ids)
        batch_ids = [batch.id for batch in batch_rows]

        audit_entity_ids = [ovf_id, *order_ids, *line_ids, *batch_ids]
        audit_rows = self._audit.list_logs_for_entity_ids(ctx.tenant_id, audit_entity_ids)

        user_ids: set[UUID] = set()
        if share_history and share_history.performed_by:
            user_ids.add(share_history.performed_by)
        for row in audit_rows:
            if row.performed_by:
                user_ids.add(row.performed_by)
        for batch in batch_rows:
            if batch.created_by:
                user_ids.add(batch.created_by)
            if batch.reversed_by:
                user_ids.add(batch.reversed_by)

        user_names = self._resolve_users(ctx.tenant_id, user_ids)
        events: list[dict] = []

        shared_at = getattr(ovf, "shared_to_scm_at", None) or (
            share_history.performed_at if share_history else None
        )
        if ovf.shared_to_scm and shared_at:
            events.append(
                self._event(
                    event_id=f"ovf-shared-scm-{ovf.id}",
                    occurred_at=shared_at,
                    event_type="state_transition",
                    entity_type="ovf",
                    entity_id=ovf.id,
                    entity_label=entity_label,
                    title="Shared to SCM",
                    summary="OVF entered procurement SCM queue",
                    action="share_to_scm",
                    from_state="approved",
                    to_state="shared_scm",
                    actor_id=share_history.performed_by if share_history else None,
                    actor_name=(
                        user_names.get(share_history.performed_by)
                        if share_history and share_history.performed_by
                        else None
                    ),
                )
            )

        for cycle in serialize_scm_hold_history(ovf):
            started = cycle.get("started_at")
            released = cycle.get("released_at")
            remark = cycle.get("remark")
            if started:
                events.append(
                    self._event(
                        event_id=f"ovf-hold-start-{ovf.id}-{started}",
                        occurred_at=started,
                        event_type="state_transition",
                        entity_type="ovf",
                        entity_id=ovf.id,
                        entity_label=entity_label,
                        title="SCM hold started",
                        summary=remark,
                        action="scm_hold",
                        from_state="shared_scm",
                        to_state="hold",
                        remark=remark,
                    )
                )
            if released:
                events.append(
                    self._event(
                        event_id=f"ovf-hold-release-{ovf.id}-{released}",
                        occurred_at=released,
                        event_type="state_transition",
                        entity_type="ovf",
                        entity_id=ovf.id,
                        entity_label=entity_label,
                        title="SCM hold released",
                        summary=remark,
                        action="scm_release",
                        from_state="hold",
                        to_state="shared_scm",
                        remark=remark,
                    )
                )

        for batch in batch_rows:
            po_label = order_labels.get(batch.order_header_id, "Vendor PO")
            events.append(
                self._event(
                    event_id=f"grn-batch-{batch.id}",
                    occurred_at=batch.receipt_at,
                    event_type="grn",
                    entity_type="procurement",
                    entity_id=batch.id,
                    entity_label=po_label,
                    title="GRN recorded",
                    summary=batch.grn_number,
                    action="grn_recorded",
                    actor_id=batch.created_by,
                    actor_name=user_names.get(batch.created_by) if batch.created_by else None,
                )
            )
            if batch.reversal_status == "reversed" and batch.reversed_at:
                events.append(
                    self._event(
                        event_id=f"grn-reverse-{batch.id}",
                        occurred_at=batch.reversed_at,
                        event_type="grn",
                        entity_type="procurement",
                        entity_id=batch.id,
                        entity_label=po_label,
                        title="GRN reversed",
                        summary=batch.reversal_reason or batch.grn_number,
                        action="grn_reverse",
                        actor_id=batch.reversed_by,
                        actor_name=user_names.get(batch.reversed_by) if batch.reversed_by else None,
                        remark=batch.reversal_reason,
                    )
                )

        for row in audit_rows:
            if row.operation in _SKIP_AUDIT_OPERATIONS:
                continue
            if row.entity_name == "proc_order_receipt_batch" and row.operation == "grn_reverse":
                continue
            if row.entity_name == _CLIENT_TIMELINE_ENTITY and row.entity_id == ovf_id:
                payload = row.new_value or {}
                occurred_at = row.performed_at
                if isinstance(payload, dict) and payload.get("occurred_at"):
                    try:
                        occurred_at = datetime.fromisoformat(str(payload["occurred_at"]))
                    except ValueError:
                        occurred_at = row.performed_at
                title = (
                    payload.get("title")
                    if isinstance(payload, dict) and payload.get("title")
                    else _PROC_AUDIT_TITLES.get(row.operation, _humanize(row.operation) or "Procurement step")
                )
                summary = payload.get("summary") if isinstance(payload, dict) else None
                entity_label_value = (
                    payload.get("entity_label")
                    if isinstance(payload, dict) and payload.get("entity_label")
                    else entity_label
                )
                events.append(
                    self._event(
                        event_id=f"audit-{row.id}",
                        occurred_at=occurred_at,
                        event_type="delivery",
                        entity_type="procurement",
                        entity_id=row.entity_id,
                        entity_label=entity_label_value,
                        title=str(title),
                        summary=summary if isinstance(summary, str) else None,
                        action=row.operation,
                        actor_id=row.performed_by,
                        actor_name=user_names.get(row.performed_by) if row.performed_by else None,
                    )
                )
                continue

            if row.entity_id == ovf_id and row.entity_name == "proc_ovf_stock_allocation":
                title = _PROC_AUDIT_TITLES.get(
                    row.operation, _humanize(row.operation) or "Procurement action"
                )
                entity_label_value = entity_label
            elif row.entity_id in order_labels:
                base = _PROC_AUDIT_TITLES.get(
                    row.operation, _humanize(row.operation) or "Procurement action"
                )
                title = f"{base} · {order_labels[row.entity_id]}"
                entity_label_value = order_labels[row.entity_id]
            elif row.entity_name == "proc_order_line":
                title = _PROC_AUDIT_TITLES.get(
                    row.operation, _humanize(row.operation) or "Procurement action"
                )
                entity_label_value = entity_label
            elif row.entity_name == "proc_order_receipt_batch":
                title = _PROC_AUDIT_TITLES.get(
                    row.operation, _humanize(row.operation) or "Procurement action"
                )
                entity_label_value = order_labels.get(
                    next((batch.order_header_id for batch in batch_rows if batch.id == row.entity_id), ovf_id),
                    entity_label,
                )
            else:
                title = _PROC_AUDIT_TITLES.get(
                    row.operation, _humanize(row.operation) or "Procurement action"
                )
                entity_label_value = order_labels.get(row.entity_id, entity_label)

            summary_parts: list[str] = []
            payload = row.new_value or {}
            if isinstance(payload, dict):
                if payload.get("company_po_number"):
                    summary_parts.append(str(payload["company_po_number"]))
                if payload.get("grn_number"):
                    summary_parts.append(str(payload["grn_number"]))
                if payload.get("quantity_received") is not None:
                    summary_parts.append(f"Received: {payload['quantity_received']}")
                if payload.get("stock_fulfillment_status"):
                    summary_parts.append(f"Stock: {payload['stock_fulfillment_status']}")
                if payload.get("finalize"):
                    summary_parts.append("Finalized")
                if payload.get("reason"):
                    summary_parts.append(str(payload["reason"]))

            events.append(
                self._event(
                    event_id=f"audit-{row.id}",
                    occurred_at=row.performed_at,
                    event_type="procurement_action",
                    entity_type="procurement",
                    entity_id=row.entity_id,
                    entity_label=entity_label_value,
                    title=title,
                    summary=" · ".join(summary_parts) if summary_parts else row.entity_name,
                    action=row.operation,
                    actor_id=row.performed_by,
                    actor_name=user_names.get(row.performed_by) if row.performed_by else None,
                )
            )

        events.sort(key=lambda item: item["occurred_at"])

        return {
            "ovf_id": ovf.id,
            "ovf_no": ovf.ovf_no,
            "customer_name": ovf.customer_name,
            "quote_name": ovf.quote_name,
            "timeline_status": _timeline_status(ovf, events),
            "blueprint_state": ovf.blueprint_state,
            "linked_order_ids": order_ids,
            "events": events,
        }

    def _list_receipt_batches(self, order_ids: list[UUID]) -> list[ProcOrderReceiptBatch]:
        if not order_ids:
            return []
        stmt = (
            select(ProcOrderReceiptBatch)
            .where(
                ProcOrderReceiptBatch.order_header_id.in_(order_ids),
                ProcOrderReceiptBatch.is_deleted.is_(False),
            )
            .order_by(ProcOrderReceiptBatch.receipt_at)
        )
        return list(self._db.scalars(stmt).all())

    @staticmethod
    def _event(
        *,
        event_id: str,
        occurred_at: datetime,
        event_type: str,
        entity_type: str,
        entity_id: UUID,
        entity_label: str | None,
        title: str,
        summary: str | None = None,
        action: str | None = None,
        from_state: str | None = None,
        to_state: str | None = None,
        actor_id: UUID | None = None,
        actor_name: str | None = None,
        remark: str | None = None,
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
            "decision": None,
            "team_role": None,
            "remark": remark,
            "version": None,
        }

    def _linked_company_po_numbers(self, ctx: TenantContext, ovf_id: UUID) -> list[str]:
        orders = self._orders.list_by_source(
            ctx,
            source_module="crm",
            source_document_type="ovf",
            source_document_id=ovf_id,
        )
        labels: list[str] = []
        seen: set[str] = set()
        for order in orders:
            label = (order.company_po_number or order.document_number or "").strip()
            if not label or label in seen:
                continue
            seen.add(label)
            labels.append(label)
        return labels

    def _resolve_users(self, tenant_id: UUID, user_ids: set[UUID]) -> dict[UUID, str]:
        names: dict[UUID, str] = {}
        for user_id in user_ids:
            user = self._users.get_by_id(tenant_id, user_id)
            if user and user.display_name:
                names[user_id] = user.display_name
        return names
