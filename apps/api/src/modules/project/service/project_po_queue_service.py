"""PO queue for Project Management - shared installation POs without a linked project."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, ForbiddenException, NotFoundException
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

_SHEET_COL_ALIASES: dict[str, tuple[str, ...]] = {
    "project": ("project", "wave", "project name", "project_name"),
    "circle": ("circle",),
    "site": ("site", "site name", "site_name"),
    "cloud": ("cloud", "cloud name", "cloud_name"),
    "type": ("type", "line type", "line_type", "item type"),
    "qty": ("qty", "quantity", "qty.", "qnty"),
    "po": ("po", "customer po", "customer_po", "po number", "po no", "po_no"),
    "po_date": ("po date", "po_date", "document date", "document_date"),
}


def _sheet_tracker_marker(tracker_id: UUID) -> str:
    return f"[SEED:SHEET-TRACKER:{tracker_id}]"


def _norm_label(value: str) -> str:
    return " ".join((value or "").strip().casefold().split())


def _clip(value: str | None, limit: int) -> str | None:
    text = (value or "").strip()
    if not text:
        return None
    return text[:limit]


def _parse_sheet_qty(value: Any) -> int:
    """Parse tracker Qty cells (int/float/str) into a non-negative int."""
    if value is None:
        return 0
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return max(0, value)
    if isinstance(value, float):
        return max(0, int(value))
    text = str(value).strip().replace(",", "")
    if not text:
        return 0
    try:
        return max(0, int(float(text)))
    except ValueError:
        digits = "".join(ch for ch in text if ch.isdigit())
        return int(digits) if digits else 0


def _qty_bucket_for_line_type(line_type: str) -> str:
    """Map tracker Type → rack vs server quantity field."""
    kind = (line_type or "").casefold()
    if any(token in kind for token in ("rack", "pdu")):
        return "rack"
    return "server"


def _handoff_line_qty(row: Any) -> int | None:
    """Combined display qty from handoff rack/server quantity strings."""
    total = _parse_sheet_qty(getattr(row, "rack_quantity", None)) + _parse_sheet_qty(
        getattr(row, "server_quantity", None)
    )
    return total if total > 0 else None


def _parse_sheet_date(value: str | None) -> date | None:
    text = (value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%d.%m.%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text[:10] if fmt.startswith("%Y-%m-%d") else text[:10], fmt).date()
        except ValueError:
            continue
    # openpyxl may already emit ISO with time
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _map_sheet_columns(columns: list[dict[str, Any]]) -> dict[str, str]:
    """Map logical field → column id using header labels."""
    by_label: dict[str, str] = {}
    for col in columns:
        label = _norm_label(str(col.get("label") or ""))
        cid = str(col.get("id") or "").strip()
        if label and cid and label not in by_label:
            by_label[label] = cid
    mapped: dict[str, str] = {}
    for field, aliases in _SHEET_COL_ALIASES.items():
        for alias in aliases:
            cid = by_label.get(_norm_label(alias))
            if cid:
                mapped[field] = cid
                break
    return mapped


def _line_key(
    *,
    cloud: str,
    project: str,
    circle: str,
    site: str,
    po: str,
    line_type: str,
) -> tuple[str, str, str, str, str, str]:
    return (
        cloud.casefold(),
        project.casefold(),
        circle.casefold(),
        site.casefold(),
        po.casefold(),
        line_type.casefold(),
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
        cid = self._scope.resolve_list_company_id(ctx, company_id)
        linked = self._repo.list_linked_proc_order_ids(ctx, cid)
        out: list[ProjectPoQueueItem] = []

        for handoff in self._handoffs.list_active(ctx, cid):
            if handoff.is_seed or handoff.proc_order_id is None:
                out.append(self._seed_queue_item(handoff))
                continue

            if handoff.proc_order_id in linked:
                self._handoffs.soft_delete_by_order_id(ctx, handoff.proc_order_id)
                continue
            try:
                order = self._procurement.get_order_response(
                    ctx, handoff.proc_order_id, enrich_commercial=True
                )
            except (NotFoundException, ForbiddenException):
                # Skip rows the caller cannot resolve (soft-deleted PO, or
                # legacy scope errors) so one handoff cannot blank the queue.
                continue
            if order.status in {"draft", "cancelled"}:
                continue
            if not order.company_po_number:
                continue
            if order.status not in _ELIGIBLE_PO_STATUSES:
                continue
            out.append(
                self._to_queue_item(ctx, order, handoff=handoff, shared_at=handoff.shared_at)
            )

        out.sort(
            key=lambda row: (
                row.shared_at.isoformat() if row.shared_at else "",
                row.document_date.isoformat() if row.document_date else "",
                row.company_po_number or row.customer_po_number or "",
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
            is_seed=False,
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

    def get_handoff_by_id(
        self, ctx: TenantContext, handoff_id: UUID
    ) -> ProjectPoQueueHandoffResponse | None:
        row = self._handoffs.get(ctx, handoff_id)
        if row is None:
            return None
        order = None
        if row.proc_order_id is not None and not row.is_seed:
            try:
                order = self._procurement.get_order_response(
                    ctx, row.proc_order_id, enrich_commercial=True
                )
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

        order_kind = (getattr(order, "order_kind", None) or "product").strip().lower()
        is_service_po = (
            order.source_module == "crm"
            and (order.source_document_type or "").strip().lower() == "opportunity_service"
        ) or order_kind == "internal_service"
        if is_service_po and order.source_document_id is not None and opportunity_id is None:
            try:
                crm_ctx = self._crm.resolve_opportunity_project_context(
                    ctx, order.source_document_id
                )
                customer_name = crm_ctx.get("customer_name") or customer_name
                customer_id = crm_ctx.get("customer_id") or customer_id
                site_name = crm_ctx.get("site_name") or site_name
                opportunity_id = crm_ctx.get("opportunity_id")
                circle_name = crm_ctx.get("circle_name") or circle_name
                entity_state = crm_ctx.get("entity_state") or entity_state
                project_title = crm_ctx.get("project_title") or project_title
                if not customer_po_number:
                    customer_po_number = crm_ctx.get("customer_po_number")
            except Exception:
                pass

        if handoff is not None:
            # CRM identity fields win; handoff only fills gaps (skip legacy "Service" stub).
            if not project_title:
                project_title = handoff.project_name or project_title
            if not site_name:
                site_name = handoff.site_name or site_name
            if not circle_name:
                handoff_circle = (handoff.circle_name or "").strip()
                if handoff_circle and handoff_circle.lower() != "service":
                    circle_name = handoff_circle

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
        if is_service_po:
            channel_hint = ""
            if handoff is not None and (handoff.remarks or "").strip():
                channel_hint = f" · {(handoff.remarks or '').strip()[:120]}"
            description = (
                f"Internal Service PO {order.company_po_number or order.document_number}"
                + channel_hint
            )

        budget = order.customer_total or order.total_amount
        return ProjectPoPrefillResponse(
            order_id=order.id,
            handoff_id=handoff.id if handoff is not None else None,
            is_seed=False,
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
            rack_quantity=handoff.rack_quantity if handoff is not None else None,
            server_quantity=handoff.server_quantity if handoff is not None else None,
            server_type=handoff.server_type if handoff is not None else None,
        )

    def get_prefill_by_handoff(
        self, ctx: TenantContext, handoff_id: UUID
    ) -> ProjectPoPrefillResponse:
        row = self._handoffs.get(ctx, handoff_id)
        if row is None:
            raise NotFoundException("PO queue entry not found")
        if row.is_seed or row.proc_order_id is None:
            return self._seed_prefill(ctx, row)
        return self.get_prefill(ctx, row.proc_order_id)

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

    def ensure_seed_handoff_linkable(self, ctx: TenantContext, handoff_id: UUID) -> None:
        row = self._handoffs.get(ctx, handoff_id)
        if row is None:
            raise AppException("PO queue entry not found")
        if not row.is_seed and row.proc_order_id is not None:
            self.ensure_linkable(ctx, row.proc_order_id)

    def complete_handoff(self, ctx: TenantContext, order_id: UUID) -> None:
        """Remove PO from queue after project is linked."""
        self._handoffs.soft_delete_by_order_id(ctx, order_id)

    def complete_handoff_by_id(self, ctx: TenantContext, handoff_id: UUID) -> None:
        row = self._handoffs.get(ctx, handoff_id)
        if row is None:
            return
        cloud = (getattr(row, "cloud_name", None) or "").strip()
        if cloud:
            # One project per cloud — clear every queue line for that cloud.
            for sibling in self._handoffs.list_by_cloud_name(ctx, row.company_id, cloud):
                self._handoffs.soft_delete(ctx, sibling.id)
            return
        self._handoffs.soft_delete(ctx, handoff_id)

    def create_cloud_project_from_handoff(
        self,
        ctx: TenantContext,
        handoff_id: UUID,
        *,
        rfai_number: str | None = None,
    ):
        """Create one project for the handoff cloud — no intake form."""
        from modules.project.domain.enums import SiteDeliveryType
        from modules.project.service.project_service import ProjectService

        row = self._handoffs.get(ctx, handoff_id)
        if row is None:
            raise NotFoundException("PO queue entry not found")
        self.ensure_seed_handoff_linkable(ctx, handoff_id)
        rfai = (rfai_number or "").strip() or None

        cloud = (getattr(row, "cloud_name", None) or "").strip()
        if not cloud:
            raise AppException("This queue entry has no cloud — open Create Project from a cloud row")

        siblings = self._handoffs.list_by_cloud_name(ctx, row.company_id, cloud)
        if not siblings:
            siblings = [row]

        rack_qty = 0
        server_qty = 0
        circles: list[str] = []
        sites: list[str] = []
        types: list[str] = []
        pos: list[str] = []
        for sibling in siblings:
            try:
                rack_qty += int(str(sibling.rack_quantity or "0").strip() or "0")
            except ValueError:
                pass
            try:
                server_qty += int(str(sibling.server_quantity or "0").strip() or "0")
            except ValueError:
                pass
            circle = (sibling.circle_name or "").strip()
            site = (sibling.site_name or "").strip()
            line_type = (
                (getattr(sibling, "line_type", None) or sibling.server_type or "").strip()
            )
            po = (sibling.customer_po_number or "").strip()
            if circle and circle not in circles:
                circles.append(circle)
            if site and site not in sites:
                sites.append(site)
            if line_type and line_type not in types:
                types.append(line_type)
            if po and po not in pos:
                pos.append(po)
            # Heuristic from tracker Type when qty columns are empty.
            kind = line_type.casefold()
            if any(token in kind for token in ("rack", "pdu")):
                rack_qty = max(rack_qty, 1)
            if any(
                token in kind
                for token in ("server", "srs", "srt", "srk", "sfc", "sfs", "sfk", "tb")
            ):
                server_qty = max(server_qty, 1)

        if server_qty > 0 and rack_qty > 0:
            delivery = SiteDeliveryType.SERVER_OS_RACK.value
        elif rack_qty > 0 and server_qty == 0:
            delivery = SiteDeliveryType.RACK_ONLY.value
        elif server_qty > 0:
            delivery = SiteDeliveryType.SERVER_OS.value
        else:
            delivery = SiteDeliveryType.SERVER_OS_RACK.value

        site_name = sites[0] if sites else cloud
        circle_name = circles[0] if circles else None
        application = types[0] if types else None
        description = (
            f"Cloud project · {cloud}"
            + (f" · {len(pos)} PO(s): {', '.join(pos[:12])}" if pos else "")
            + (f" · +{len(pos) - 12} more" if len(pos) > 12 else "")
        )[:2000]

        cloud_po_lines = [
            {
                "project_name": (sibling.project_name or "").strip() or None,
                "circle_name": (sibling.circle_name or "").strip() or None,
                "site_name": (sibling.site_name or "").strip() or None,
                "line_type": (
                    (getattr(sibling, "line_type", None) or sibling.server_type or "")
                    .strip()
                    or None
                ),
                "quantity": _handoff_line_qty(sibling),
                "customer_po_number": (sibling.customer_po_number or "").strip() or None,
                "document_date": (
                    sibling.document_date.isoformat() if sibling.document_date else None
                ),
            }
            for sibling in siblings
        ]

        prefill = self._seed_prefill(ctx, row)
        project = ProjectService(self._db).create(
            ctx,
            branch_id=row.branch_id,
            company_id=row.company_id,
            po_queue_handoff_id=row.id,
            project_name=cloud[:255],
            customer_id=prefill.customer_id,
            description=description,
            currency_code=prefill.currency_code or "INR",
            site_installation={
                "delivery_type": delivery,
                "site_name": site_name[:255],
                "circle": circle_name,
                "cloud_name": cloud[:255],
                "cloud_po_lines": cloud_po_lines,
                "application": (application or "")[:255] or None,
                "rack_qty": rack_qty or None,
                "server_qty": server_qty or None,
                "rfai_request_done": bool(rfai),
                "rfai_number": rfai,
            },
        )
        return project

    def sync_from_sheet_tracker(
        self,
        ctx: TenantContext,
        *,
        tracker_id: UUID,
        company_id: UUID,
        branch_id: UUID,
        columns: list[dict[str, Any]],
        rows: list[dict[str, Any]],
        tracker_name: str | None = None,
        file_name: str | None = None,
    ) -> dict[str, int]:
        """Upsert unique-cloud seed queue rows from a procurement sheet tracker.

        One handoff per (cloud, project, circle, site, po, type). Cloud display
        names are case-insensitive unique — re-uploads update in place.
        """
        col_map = _map_sheet_columns(columns)
        if "project" not in col_map and "cloud" not in col_map:
            return {"created": 0, "updated": 0, "removed": 0, "skipped": len(rows)}

        marker = _sheet_tracker_marker(tracker_id)
        consumed_pos = self._consumed_customer_po_numbers(
            ctx, company_id, exclude_seed_marker=marker
        )
        cloud_canonical: dict[str, str] = {}
        lines: dict[tuple[str, str, str, str, str, str], dict[str, Any]] = {}
        filtered_old_po = 0

        for raw in rows:
            project = _clip(str(raw.get(col_map.get("project", ""), "") or ""), 255) or ""
            circle = _clip(str(raw.get(col_map.get("circle", ""), "") or ""), 255) or ""
            site = _clip(str(raw.get(col_map.get("site", ""), "") or ""), 255) or ""
            cloud_raw = _clip(str(raw.get(col_map.get("cloud", ""), "") or ""), 255) or ""
            line_type = _clip(str(raw.get(col_map.get("type", ""), "") or ""), 255) or ""
            qty = (
                _parse_sheet_qty(raw.get(col_map["qty"])) if "qty" in col_map else 0
            )
            po = _clip(str(raw.get(col_map.get("po", ""), "") or ""), 100) or ""
            po_date = _parse_sheet_date(
                str(raw.get(col_map.get("po_date", ""), "") or "") if "po_date" in col_map else ""
            )

            if not project and not site and not po:
                continue

            if po and po.casefold() in consumed_pos:
                filtered_old_po += 1
                continue

            cloud_key = cloud_raw.casefold() if cloud_raw else "unassigned"
            if cloud_key not in cloud_canonical:
                cloud_canonical[cloud_key] = cloud_raw or "Unassigned"
            cloud = cloud_canonical[cloud_key]

            if not project:
                project = site or po or "Untitled project"

            key = _line_key(
                cloud=cloud,
                project=project,
                circle=circle,
                site=site,
                po=po,
                line_type=line_type,
            )
            bucket = _qty_bucket_for_line_type(line_type)
            rack_qty = qty if bucket == "rack" else 0
            server_qty = qty if bucket != "rack" else 0
            if key in lines:
                existing_line = lines[key]
                existing_line["rack_qty"] = int(existing_line.get("rack_qty") or 0) + rack_qty
                existing_line["server_qty"] = int(existing_line.get("server_qty") or 0) + server_qty
                if po_date and (
                    existing_line.get("document_date") is None
                    or po_date > existing_line["document_date"]
                ):
                    existing_line["document_date"] = po_date
                continue
            lines[key] = {
                "cloud_name": cloud,
                "project_name": project,
                "circle_name": circle or None,
                "site_name": site or None,
                "line_type": line_type or None,
                "customer_po_number": po or None,
                "document_date": po_date,
                "rack_qty": rack_qty,
                "server_qty": server_qty,
                "server_type": (line_type or cloud)[:255] if (line_type or cloud) else None,
            }

        existing = self._handoffs.list_by_seed_marker(ctx, company_id, marker)
        existing_by_key: dict[tuple[str, str, str, str, str, str], Any] = {}
        for row in existing:
            existing_by_key[
                _line_key(
                    cloud=row.cloud_name or "Unassigned",
                    project=row.project_name or "",
                    circle=row.circle_name or "",
                    site=row.site_name or "",
                    po=row.customer_po_number or "",
                    line_type=row.line_type or "",
                )
            ] = row

        shared_at = datetime.now(timezone.utc)
        source_label = (tracker_name or file_name or "Sheet tracker").strip()[:120]
        created = 0
        updated = 0
        seen_keys: set[tuple[str, str, str, str, str, str]] = set()

        for key, item in lines.items():
            seen_keys.add(key)
            line_qty = int(item.get("rack_qty") or 0) + int(item.get("server_qty") or 0)
            remarks = (
                f"{marker}\n"
                f"Source: {source_label}\n"
                f"Cloud: {item['cloud_name']}\n"
                f"Project: {item['project_name']}\n"
                f"Circle: {item['circle_name'] or '-'}\n"
                f"Site: {item['site_name'] or '-'}\n"
                f"Type: {item['line_type'] or '-'}\n"
                f"Qty: {line_qty}\n"
                f"PO: {item['customer_po_number'] or '-'}"
            )[:8000]
            payload = {
                "proc_order_id": None,
                "company_id": company_id,
                "branch_id": branch_id,
                "is_seed": True,
                "seed_marker": marker,
                "shared_at": shared_at,
                "project_name": item["project_name"],
                "circle_name": item["circle_name"],
                "site_name": item["site_name"],
                "cloud_name": item["cloud_name"],
                "line_type": item["line_type"],
                "contact_person": "Sheet Tracker",
                "contact_number": "0000000000",
                "rack_quantity": str(int(item.get("rack_qty") or 0)),
                "server_quantity": str(int(item.get("server_qty") or 0)),
                "server_type": item["server_type"],
                "remarks": remarks,
                "customer_po_number": item["customer_po_number"],
                "company_po_number": None,
                "document_date": item.get("document_date") or shared_at.date(),
                "customer_name": "Airtel",
            }
            row = existing_by_key.get(key)
            if row is None:
                self._handoffs.upsert(ctx, **payload)
                created += 1
                continue
            for field, value in payload.items():
                if field == "proc_order_id":
                    continue
                setattr(row, field, value)
            row.updated_at = shared_at
            row.updated_by = ctx.user_id
            row.version = int(row.version or 1) + 1
            updated += 1

        removed = 0
        for key, row in existing_by_key.items():
            if key in seen_keys:
                continue
            self._handoffs.soft_delete(ctx, row.id)
            removed += 1

        self._db.flush()
        return {
            "created": created,
            "updated": updated,
            "removed": removed,
            "filtered_old_po": filtered_old_po,
            "skipped": max(0, len(rows) - len(lines) - filtered_old_po),
        }

    def _consumed_customer_po_numbers(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        exclude_seed_marker: str | None = None,
    ) -> set[str]:
        """POs already in another active queue tracker or on a created cloud project.

        Soft-deleted queue rows without a project do not block re-upload.
        """
        from modules.project.models.site_installation import PrjSiteInstallation
        from sqlalchemy import select

        consumed = self._handoffs.list_active_seed_customer_po_numbers(
            ctx,
            company_id,
            exclude_seed_marker=exclude_seed_marker,
        )
        stmt = select(PrjSiteInstallation).where(
            PrjSiteInstallation.tenant_id == ctx.tenant_id,
            PrjSiteInstallation.company_id == company_id,
            PrjSiteInstallation.is_deleted.is_(False),
            PrjSiteInstallation.cloud_po_lines.isnot(None),
        )
        for site in self._db.scalars(stmt).all():
            for line in list(site.cloud_po_lines or []):
                if not isinstance(line, dict):
                    continue
                po = str(line.get("customer_po_number") or "").strip()
                if po:
                    consumed.add(po.casefold())
        return consumed

    def filter_tracker_rows_excluding_consumed_pos(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        tracker_id: UUID | None,
        columns: list[dict[str, Any]],
        rows: list[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], int]:
        """Drop tracker rows whose PO was already queued or project-created."""
        col_map = _map_sheet_columns(columns)
        po_col = col_map.get("po")
        if not po_col:
            return rows, 0
        marker = _sheet_tracker_marker(tracker_id) if tracker_id else None
        # New tables have no marker yet — filter against every known PO.
        consumed = self._consumed_customer_po_numbers(
            ctx, company_id, exclude_seed_marker=marker
        )
        if not consumed:
            return rows, 0
        kept: list[dict[str, Any]] = []
        filtered = 0
        for row in rows:
            po = _clip(str(row.get(po_col, "") or ""), 100) or ""
            if po and po.casefold() in consumed:
                filtered += 1
                continue
            kept.append(row)
        return kept, filtered

    def _seed_queue_item(self, handoff) -> ProjectPoQueueItem:
        customer_po = (handoff.customer_po_number or "").strip() or None
        company_po = (handoff.company_po_number or "").strip() or None
        doc_no = company_po or customer_po or f"SEED-{str(handoff.id)[:8].upper()}"
        return ProjectPoQueueItem(
            handoff_id=handoff.id,
            order_id=None,
            is_seed=True,
            company_po_number=company_po,
            document_number=doc_no,
            document_date=handoff.document_date or handoff.shared_at.date(),
            customer_name=(handoff.customer_name or "").strip() or "Airtel",
            customer_po_number=customer_po,
            vendor_id=None,
            total_amount=0,
            customer_total=0,
            status="seed",
            ovf_id=None,
            branch_id=handoff.branch_id,
            company_id=handoff.company_id,
            created_at=handoff.created_at,
            shared_at=handoff.shared_at,
            project_name=handoff.project_name,
            circle_name=handoff.circle_name,
            site_name=handoff.site_name,
            cloud_name=getattr(handoff, "cloud_name", None),
            line_type=getattr(handoff, "line_type", None),
            rack_quantity=handoff.rack_quantity,
            server_quantity=handoff.server_quantity,
            server_type=handoff.server_type,
        )

    def _seed_prefill(self, ctx: TenantContext, handoff) -> ProjectPoPrefillResponse:
        customer_name = (handoff.customer_name or "").strip() or "Airtel"
        customer_id = self._match_customer_id(ctx, handoff.company_id, customer_name)
        customer_po = (handoff.customer_po_number or "").strip() or None
        company_po = (handoff.company_po_number or "").strip() or None
        cloud = (getattr(handoff, "cloud_name", None) or "").strip() or None
        # Cloud-wise create: project name is the unique cloud, not a tracker wave/PO.
        project_title = cloud or (handoff.project_name or "").strip() or None
        description = (
            f"Cloud project · {cloud or handoff.project_name or handoff.site_name or 'site'}"
            + (f" · Customer PO {customer_po}" if customer_po and not cloud else "")
        )
        return ProjectPoPrefillResponse(
            order_id=None,
            handoff_id=handoff.id,
            is_seed=True,
            branch_id=handoff.branch_id,
            company_id=handoff.company_id,
            company_po_number=company_po,
            customer_po_number=customer_po,
            customer_name=customer_name,
            customer_id=customer_id,
            budget_amount=None,
            currency_code="INR",
            site_name=handoff.site_name,
            description=description,
            ovf_id=None,
            crm_opportunity_id=None,
            circle_name=handoff.circle_name,
            entity_state=handoff.circle_name,
            project_title=project_title,
            rack_quantity=handoff.rack_quantity,
            server_quantity=handoff.server_quantity,
            server_type=handoff.server_type or (getattr(handoff, "line_type", None)),
        )

    def _to_queue_item(
        self, ctx: TenantContext, order, *, handoff, shared_at: datetime | None
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
            handoff_id=handoff.id,
            order_id=order.id,
            is_seed=False,
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
            order_kind=getattr(order, "order_kind", None) or "product",
            branch_id=order.branch_id,
            company_id=order.company_id,
            created_at=None,
            shared_at=shared_at,
            project_name=handoff.project_name,
            circle_name=handoff.circle_name,
            site_name=handoff.site_name,
            cloud_name=getattr(handoff, "cloud_name", None),
            line_type=getattr(handoff, "line_type", None),
            rack_quantity=handoff.rack_quantity,
            server_quantity=handoff.server_quantity,
            server_type=handoff.server_type,
        )

    def _to_handoff_response(self, row, order) -> ProjectPoQueueHandoffResponse:
        customer_name = (row.customer_name or "").strip() or None
        customer_po_number = (row.customer_po_number or "").strip() or None
        company_po_number = (row.company_po_number or "").strip() or None
        if order is not None:
            customer_name = (order.customer_name or "").strip() or customer_name
            customer_po_number = (order.customer_po_number or "").strip() or customer_po_number
            company_po_number = order.company_po_number or company_po_number
        return ProjectPoQueueHandoffResponse(
            handoff_id=row.id,
            order_id=row.proc_order_id,
            is_seed=bool(row.is_seed),
            challan_id=row.challan_id,
            shared_at=row.shared_at,
            project_name=row.project_name,
            circle_name=row.circle_name,
            site_name=row.site_name,
            cloud_name=getattr(row, "cloud_name", None),
            line_type=getattr(row, "line_type", None),
            contact_person=row.contact_person,
            contact_number=row.contact_number,
            rack_quantity=row.rack_quantity,
            server_quantity=row.server_quantity,
            server_type=row.server_type,
            remarks=row.remarks,
            customer_name=customer_name,
            customer_po_number=customer_po_number,
            company_po_number=company_po_number,
            document_date=row.document_date,
            branch_id=row.branch_id,
            company_id=row.company_id,
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
