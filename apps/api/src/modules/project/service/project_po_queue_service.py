"""PO queue for Project Management — shared installation POs without a linked project."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.project.adapters.crm_port import ProjectCrmAdapter
from modules.project.adapters.master_data_port import ProjectMasterDataAdapter
from modules.project.adapters.procurement_port import ProjectProcurementAdapter
from modules.project.repository.po_queue_handoff_repository import PoQueueHandoffRepository
from modules.project.repository.project_repository import ProjectRepository
from modules.project.schemas import (
    ProjectPoPrefillResponse,
    ProjectPoQueueHandoffResponse,
    ProjectPoQueueItem,
    ProjectPoQueueShareCreate,
)
from modules.project.service.project_scope_validator import ProjectScopeValidator

_ELIGIBLE_PO_STATUSES = frozenset(
    {"sent", "partially_received", "received", "closed", "approved", "submitted"}
)


class ProjectPoQueueService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ProjectRepository(db)
        self._handoffs = PoQueueHandoffRepository(db)
        self._scope = ProjectScopeValidator(db)
        self._procurement = ProjectProcurementAdapter(db)
        self._master = ProjectMasterDataAdapter(db)
        self._crm = ProjectCrmAdapter(db)

    def list_queue(
        self, ctx: TenantContext, company_id: UUID | None = None
    ) -> list[ProjectPoQueueItem]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        linked = self._repo.list_linked_proc_order_ids(ctx, cid)
        out: list[ProjectPoQueueItem] = []

        for handoff in self._handoffs.list_active(ctx, cid):
            if handoff.proc_order_id in linked:
                self._handoffs.soft_delete_by_order_id(ctx, handoff.proc_order_id)
                continue
            try:
                order = self._procurement.get_order_response(
                    ctx, handoff.proc_order_id, enrich_commercial=True
                )
            except NotFoundException:
                continue
            if order.status in {"draft", "cancelled"}:
                continue
            if not order.company_po_number:
                continue
            if order.status not in _ELIGIBLE_PO_STATUSES:
                continue
            out.append(self._to_queue_item(ctx, order, shared_at=handoff.shared_at))

        out.sort(
            key=lambda row: (
                row.shared_at.isoformat() if row.shared_at else "",
                row.document_date.isoformat() if row.document_date else "",
                row.company_po_number or "",
            ),
            reverse=True,
        )
        return out

    def share_to_queue(
        self, ctx: TenantContext, payload: ProjectPoQueueShareCreate
    ) -> ProjectPoQueueHandoffResponse:
        order = self._procurement.get_order_response(
            ctx, payload.order_id, enrich_commercial=True
        )
        self._ensure_eligible(order.status, order.company_po_number)
        existing = self._repo.get_by_proc_order_id(ctx, order.id)
        if existing is not None:
            raise AppException("A project already exists for this purchase order")

        shared_at = datetime.now(timezone.utc)
        row = self._handoffs.upsert(
            ctx,
            proc_order_id=order.id,
            company_id=order.company_id,
            branch_id=order.branch_id,
            challan_id=(payload.challan_id or "").strip() or None,
            shared_at=shared_at,
            project_name=payload.project_name.strip(),
            circle_name=payload.circle_name.strip(),
            site_name=payload.site_name.strip(),
            contact_person=payload.contact_person.strip(),
            contact_number=payload.contact_number.strip(),
            rack_quantity=payload.rack_quantity.strip(),
            server_quantity=payload.server_quantity.strip(),
            server_type=payload.server_type.strip(),
            remarks=(payload.remarks or "").strip() or None,
        )
        return self._to_handoff_response(row, order)

    def get_handoff(
        self, ctx: TenantContext, order_id: UUID
    ) -> ProjectPoQueueHandoffResponse | None:
        row = self._handoffs.get_by_order_id(ctx, order_id)
        if row is None:
            return None
        try:
            order = self._procurement.get_order_response(ctx, order_id, enrich_commercial=True)
        except NotFoundException:
            order = None
        return self._to_handoff_response(row, order)

    def remove_handoff(self, ctx: TenantContext, order_id: UUID) -> None:
        self._handoffs.soft_delete_by_order_id(ctx, order_id)

    def get_prefill(
        self, ctx: TenantContext, order_id: UUID
    ) -> ProjectPoPrefillResponse:
        order = self._procurement.get_order_response(
            ctx, order_id, enrich_commercial=True
        )
        self._ensure_eligible(order.status, order.company_po_number)
        existing = self._repo.get_by_proc_order_id(ctx, order.id)
        if existing is not None:
            raise AppException("A project already exists for this purchase order")

        handoff = self._handoffs.get_by_order_id(ctx, order.id)

        customer_name = (order.customer_name or "").strip() or None
        customer_id: UUID | None = None
        site_name: str | None = None
        opportunity_id: UUID | None = None
        customer_po_number = order.customer_po_number
        circle_name: str | None = None
        entity_state: str | None = None
        project_title: str | None = None

        ovf_id = (
            order.source_document_id
            if order.source_module == "crm" and order.source_document_type == "ovf"
            else None
        )
        if ovf_id is not None:
            try:
                crm_ctx = self._crm.resolve_ovf_project_context(ctx, ovf_id)
                customer_name = crm_ctx.get("customer_name") or customer_name
                customer_id = crm_ctx.get("customer_id")
                site_name = crm_ctx.get("site_name")
                opportunity_id = crm_ctx.get("opportunity_id")
                circle_name = crm_ctx.get("circle_name")
                entity_state = crm_ctx.get("entity_state")
                project_title = crm_ctx.get("project_title")
                if not customer_po_number:
                    customer_po_number = crm_ctx.get("customer_po_number")
            except Exception:
                pass

        if handoff is not None:
            project_title = handoff.project_name or project_title
            site_name = handoff.site_name or site_name
            circle_name = handoff.circle_name or circle_name

        if customer_id is None and customer_name:
            customer_id = self._match_customer_id(ctx, order.company_id, customer_name)

        if customer_id is not None and not customer_name:
            try:
                customer = self._master.get_customer(ctx, customer_id)
                customer_name = getattr(customer, "customer_name", None) or customer_name
            except NotFoundException:
                pass

        description = (
            f"PO {order.company_po_number or order.document_number}"
            + (f" · Customer PO {customer_po_number}" if customer_po_number else "")
        )

        budget = order.customer_total or order.total_amount
        return ProjectPoPrefillResponse(
            order_id=order.id,
            branch_id=order.branch_id,
            company_id=order.company_id,
            company_po_number=order.company_po_number,
            customer_po_number=customer_po_number,
            customer_name=customer_name,
            customer_id=customer_id,
            budget_amount=Decimal(str(budget)) if budget else None,
            currency_code=order.currency_code or "INR",
            site_name=site_name,
            description=description,
            ovf_id=ovf_id,
            crm_opportunity_id=opportunity_id,
            circle_name=circle_name,
            entity_state=entity_state,
            project_title=project_title,
        )

    def ensure_linkable(
        self,
        ctx: TenantContext,
        order_id: UUID,
    ) -> None:
        """Validate PO can be linked when creating a project."""
        try:
            order = self._procurement.get_order_response(ctx, order_id)
        except NotFoundException as exc:
            raise AppException("Purchase order not found") from exc
        self._ensure_eligible(order.status, order.company_po_number)
        existing = self._repo.get_by_proc_order_id(ctx, order.id)
        if existing is not None:
            raise AppException("A project already exists for this purchase order")

    def complete_handoff(self, ctx: TenantContext, order_id: UUID) -> None:
        """Remove PO from queue after project is linked."""
        self._handoffs.soft_delete_by_order_id(ctx, order_id)

    def _to_queue_item(
        self, ctx: TenantContext, order, *, shared_at: datetime | None
    ) -> ProjectPoQueueItem:
        ovf_id = (
            order.source_document_id
            if order.source_module == "crm" and order.source_document_type == "ovf"
            else None
        )
        customer_name = (order.customer_name or "").strip() or None
        customer_po_number = (order.customer_po_number or "").strip() or None
        if ovf_id is not None and (not customer_name or not customer_po_number):
            try:
                crm_ctx = self._crm.resolve_ovf_project_context(ctx, ovf_id)
                if not customer_name:
                    customer_name = crm_ctx.get("customer_name") or customer_name
                if not customer_po_number:
                    customer_po_number = (
                        crm_ctx.get("customer_po_number") or customer_po_number
                    )
            except Exception:
                pass
        return ProjectPoQueueItem(
            order_id=order.id,
            company_po_number=order.company_po_number,
            document_number=order.document_number,
            document_date=order.document_date,
            customer_name=customer_name,
            customer_po_number=customer_po_number,
            vendor_id=order.vendor_id,
            total_amount=float(order.total_amount or 0),
            customer_total=float(order.customer_total or 0),
            status=order.status,
            ovf_id=ovf_id,
            branch_id=order.branch_id,
            company_id=order.company_id,
            created_at=None,
            shared_at=shared_at,
        )

    def _to_handoff_response(self, row, order) -> ProjectPoQueueHandoffResponse:
        customer_name = None
        customer_po_number = None
        company_po_number = None
        if order is not None:
            customer_name = (order.customer_name or "").strip() or None
            customer_po_number = (order.customer_po_number or "").strip() or None
            company_po_number = order.company_po_number
        return ProjectPoQueueHandoffResponse(
            order_id=row.proc_order_id,
            challan_id=row.challan_id,
            shared_at=row.shared_at,
            project_name=row.project_name,
            circle_name=row.circle_name,
            site_name=row.site_name,
            contact_person=row.contact_person,
            contact_number=row.contact_number,
            rack_quantity=row.rack_quantity,
            server_quantity=row.server_quantity,
            server_type=row.server_type,
            remarks=row.remarks,
            customer_name=customer_name,
            customer_po_number=customer_po_number,
            company_po_number=company_po_number,
        )

    @staticmethod
    def _ensure_eligible(status: str, company_po_number: str | None) -> None:
        if status in {"draft", "cancelled"}:
            raise AppException("Purchase order is not finalized for project creation")
        if not company_po_number:
            raise AppException("Purchase order does not have a company PO number yet")

    def _match_customer_id(
        self,
        ctx: TenantContext,
        company_id: UUID,
        customer_name: str | None,
    ) -> UUID | None:
        if not customer_name:
            return None
        needle = customer_name.strip().lower()
        if not needle:
            return None
        try:
            customers = self._master.list_customers(ctx, company_id=company_id)
        except Exception:
            return None

        exact: UUID | None = None
        starts: list[tuple[int, UUID]] = []
        contains: list[tuple[int, UUID]] = []
        for customer in customers:
            label = (getattr(customer, "customer_name", None) or "").strip()
            key = label.lower()
            if not key:
                continue
            if key == needle:
                exact = customer.id
                break
            if key.startswith(needle) or needle.startswith(key):
                starts.append((len(label), customer.id))
            elif needle in key or key in needle:
                contains.append((len(label), customer.id))

        if exact is not None:
            return exact
        if starts:
            starts.sort(key=lambda item: item[0])
            return starts[0][1]
        if contains:
            contains.sort(key=lambda item: item[0])
            return contains[0][1]
        return None
