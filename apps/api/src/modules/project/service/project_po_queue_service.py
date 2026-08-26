"""PO queue for Project Management — finalized SCM POs without a linked project."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.project.adapters.crm_port import ProjectCrmAdapter
from modules.project.adapters.master_data_port import ProjectMasterDataAdapter
from modules.project.adapters.procurement_port import ProjectProcurementAdapter
from modules.project.repository.project_repository import ProjectRepository
from modules.project.schemas import ProjectPoPrefillResponse, ProjectPoQueueItem
from modules.project.service.project_module_admin import ProjectModuleAdminService
from modules.project.service.project_scope_validator import ProjectScopeValidator

_ELIGIBLE_PO_STATUSES = frozenset(
    {"sent", "partially_received", "received", "closed", "approved", "submitted"}
)


class ProjectPoQueueService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ProjectRepository(db)
        self._scope = ProjectScopeValidator(db)
        self._procurement = ProjectProcurementAdapter(db)
        self._master = ProjectMasterDataAdapter(db)
        self._crm = ProjectCrmAdapter(db)
        self._module_admin = ProjectModuleAdminService(db)

    def list_queue(
        self, ctx: TenantContext, company_id: UUID | None = None
    ) -> list[ProjectPoQueueItem]:
        self._module_admin.ensure_admin(ctx)
        cid = self._scope.resolve_company_id(ctx, company_id)
        linked = self._repo.list_linked_proc_order_ids(ctx, cid)
        orders = self._procurement.list_order_responses(
            ctx, cid, enrich_commercial=True
        )
        out: list[ProjectPoQueueItem] = []
        for order in orders:
            if order.id in linked:
                continue
            if order.status in {"draft", "cancelled"}:
                continue
            if not order.company_po_number:
                continue
            if order.status not in _ELIGIBLE_PO_STATUSES:
                continue
            ovf_id = (
                order.source_document_id
                if order.source_module == "crm" and order.source_document_type == "ovf"
                else None
            )
            out.append(
                ProjectPoQueueItem(
                    order_id=order.id,
                    company_po_number=order.company_po_number,
                    document_number=order.document_number,
                    document_date=order.document_date,
                    customer_name=order.customer_name,
                    customer_po_number=order.customer_po_number,
                    vendor_id=order.vendor_id,
                    total_amount=float(order.total_amount or 0),
                    customer_total=float(order.customer_total or 0),
                    status=order.status,
                    ovf_id=ovf_id,
                    branch_id=order.branch_id,
                    company_id=order.company_id,
                )
            )
        out.sort(
            key=lambda row: (
                row.document_date.isoformat(),
                row.company_po_number or "",
            ),
            reverse=True,
        )
        return out

    def get_prefill(
        self, ctx: TenantContext, order_id: UUID
    ) -> ProjectPoPrefillResponse:
        self._module_admin.ensure_admin(ctx)
        order = self._procurement.get_order_response(
            ctx, order_id, enrich_commercial=True
        )
        self._ensure_eligible(order.status, order.company_po_number)
        existing = self._repo.get_by_proc_order_id(ctx, order.id)
        if existing is not None:
            raise AppException("A project already exists for this purchase order")

        customer_name = (order.customer_name or "").strip() or None
        customer_id: UUID | None = None
        site_name: str | None = None
        opportunity_id: UUID | None = None
        customer_po_number = order.customer_po_number
        circle_name: str | None = None
        entity_state: str | None = None

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
                if not customer_po_number:
                    customer_po_number = crm_ctx.get("customer_po_number")
            except Exception:
                pass

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
        )

    def ensure_linkable(
        self,
        ctx: TenantContext,
        order_id: UUID,
    ) -> None:
        """Validate PO can be linked when creating a project."""
        self._module_admin.ensure_admin(ctx)
        try:
            order = self._procurement.get_order_response(ctx, order_id)
        except NotFoundException as exc:
            raise AppException("Purchase order not found") from exc
        self._ensure_eligible(order.status, order.company_po_number)
        existing = self._repo.get_by_proc_order_id(ctx, order.id)
        if existing is not None:
            raise AppException("A project already exists for this purchase order")

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
