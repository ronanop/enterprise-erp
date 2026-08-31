"""ESS Phase 5 — meeting rooms, assets (QR), helpdesk tickets."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import or_, select

from core.exceptions import ConflictException, ForbiddenException, NotFoundException
from modules.ess.schemas import (
    EssAssetDetail,
    EssAssetItem,
    EssMeetingBookingCreate,
    EssMeetingBookingResponse,
    EssMeetingRoomAvailability,
    EssMeetingRoomItem,
    EssSupportTicketCommentCreate,
    EssSupportTicketCommentItem,
    EssSupportTicketCreate,
    EssSupportTicketDetail,
    EssSupportTicketItem,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.base import utcnow
from modules.hr.models.training_request import HrTrainingRequest
from modules.hr.models.training_room import HrTrainingRoom
from modules.hr.service.training_service import TrainingRequestService, TrainingRoomService
from modules.master_data.models.employee import MasterEmployee

if TYPE_CHECKING:
    from modules.ess.service import EssService


def _time_overlap(
    a_start: time | None,
    a_end: time | None,
    b_start: time | None,
    b_end: time | None,
) -> bool:
    if a_start is None or a_end is None or b_start is None or b_end is None:
        return True
    return a_start < b_end and b_start < a_end


class EssWorkplaceService:
    def __init__(self, db, ess: EssService) -> None:
        self._db = db
        self._ess = ess

    def list_meeting_rooms(self, ctx: TenantContext) -> list[EssMeetingRoomItem]:
        emp = self._ess.resolve_employee(ctx)
        rooms = TrainingRoomService(self._db).list(ctx, emp.company_id)
        out: list[EssMeetingRoomItem] = []
        for row in rooms:
            if row.status != "active":
                continue
            if row.branch_id is not None and emp.branch_id is not None and row.branch_id != emp.branch_id:
                continue
            out.append(
                EssMeetingRoomItem(
                    id=row.id,
                    room_code=row.room_code,
                    room_name=row.room_name,
                    capacity=row.capacity,
                    equipment_json=row.equipment_json if isinstance(row.equipment_json, list) else None,
                    notes=row.notes,
                    status=row.status,
                )
            )
        return out

    def meeting_room_availability(
        self, ctx: TenantContext, *, on_date: date
    ) -> list[EssMeetingRoomAvailability]:
        emp = self._ess.resolve_employee(ctx)
        rooms = self.list_meeting_rooms(ctx)
        bookings = self._bookings_for_date(ctx, emp.company_id, on_date)
        by_room: dict[UUID, list[HrTrainingRequest]] = {}
        for b in bookings:
            if b.room_id:
                by_room.setdefault(b.room_id, []).append(b)
        emp_ids = {b.requested_by_employee_id for b in bookings}
        names = self._employee_display_names(ctx, emp_ids)

        result: list[EssMeetingRoomAvailability] = []
        for room in rooms:
            room_bookings = by_room.get(room.id, [])
            slots = [
                self._booking_response(b, room.room_name, names)
                for b in room_bookings
            ]
            result.append(
                EssMeetingRoomAvailability(
                    room=room,
                    is_busy=len(slots) > 0,
                    bookings=slots,
                )
            )
        return result

    def list_meeting_bookings(
        self, ctx: TenantContext, *, on_date: date | None = None
    ) -> list[EssMeetingBookingResponse]:
        emp = self._ess.resolve_employee(ctx)
        q = select(HrTrainingRequest).where(
            HrTrainingRequest.tenant_id == ctx.tenant_id,
            HrTrainingRequest.company_id == emp.company_id,
            HrTrainingRequest.is_deleted.is_(False),
            HrTrainingRequest.room_id.isnot(None),
            HrTrainingRequest.status.in_(("submitted", "approved")),
        )
        if on_date is not None:
            q = q.where(HrTrainingRequest.request_date == on_date)
        rows = list(self._db.scalars(q.order_by(HrTrainingRequest.request_date, HrTrainingRequest.start_time)).all())
        room_names = {r.id: r.room_name for r in TrainingRoomService(self._db).list(ctx, emp.company_id)}
        emp_ids = {row.requested_by_employee_id for row in rows}
        names = self._employee_display_names(ctx, emp_ids)
        return [
            self._booking_response(
                row,
                room_names.get(row.room_id) if row.room_id else None,
                names,
            )
            for row in rows
        ]

    def create_meeting_booking(
        self, ctx: TenantContext, body: EssMeetingBookingCreate
    ) -> EssMeetingBookingResponse:
        emp = self._ess.resolve_employee(ctx)
        if emp.branch_id is None:
            raise ConflictException("Employee branch is required to book a room")
        room = TrainingRoomService(self._db).get(ctx, body.room_id)
        if room.status != "active":
            raise ConflictException("Room is not available for booking")
        self._assert_room_free(
            ctx,
            company_id=emp.company_id,
            room_id=body.room_id,
            on_date=body.request_date,
            start_time=body.start_time,
            end_time=body.end_time,
        )
        svc = TrainingRequestService(self._db)
        row = svc.create(
            ctx,
            branch_id=emp.branch_id,
            company_id=emp.company_id,
            title=body.title,
            request_type="meeting",
            requested_by_employee_id=emp.id,
            host_employee_id=emp.id,
            room_id=body.room_id,
            request_date=body.request_date,
            start_time=body.start_time,
            end_time=body.end_time,
            agenda=body.agenda,
            attendees_json=[],
            status="approved",
        )
        host_name = self._employee_display_names(ctx, {emp.id})
        return self._booking_response(row, room.room_name, host_name)

    def get_asset(self, ctx: TenantContext, asset_id: UUID) -> EssAssetDetail:
        item = self._get_asset_for_employee(ctx, asset_id)
        return self._to_asset_detail(item)

    def lookup_asset(self, ctx: TenantContext, *, code: str) -> EssAssetDetail:
        from modules.asset.models.asset import AstAsset

        emp = self._ess.resolve_employee(ctx)
        raw = code.strip()
        if not raw:
            raise NotFoundException("Asset not found")
        asset = self._db.scalar(
            select(AstAsset).where(
                AstAsset.tenant_id == ctx.tenant_id,
                AstAsset.company_id == emp.company_id,
                AstAsset.is_deleted.is_(False),
                or_(AstAsset.qr_code == raw, AstAsset.asset_code == raw, AstAsset.barcode == raw),
            )
        )
        if asset is None:
            raise NotFoundException("Asset not found")
        return self._to_asset_detail(
            self._asset_row_to_item(asset, self._assignment_label_optional(ctx, asset.id))
        )

    def create_asset_ticket(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        subject: str,
        description: str,
        problem_category: str | None = None,
        urgency: str | None = None,
    ) -> EssSupportTicketDetail:
        from modules.asset.models.asset import AstAsset

        emp = self._ess.resolve_employee(ctx)
        asset = self._db.get(AstAsset, asset_id)
        if asset is None or getattr(asset, "is_deleted", False) or asset.company_id != emp.company_id:
            raise NotFoundException("Asset not found")
        cat_code = "ESS_ASSET"
        subj = subject.strip() or "Asset issue"
        desc = description.strip()
        if problem_category:
            desc = f"Category: {problem_category}\n\n{desc}"
        if urgency:
            desc = f"Urgency: {urgency}\n\n{desc}"
        return self.create_support_ticket(
            ctx,
            EssSupportTicketCreate(
                kind="asset",
                subject=subj,
                description=desc,
                asset_id=asset_id,
                urgency=urgency,
            ),
        )

    def list_support_tickets(self, ctx: TenantContext) -> list[EssSupportTicketItem]:
        from modules.helpdesk.models.ticket import HdTicket

        emp = self._ess.resolve_employee(ctx)
        rows = list(
            self._db.scalars(
                select(HdTicket)
                .where(
                    HdTicket.tenant_id == ctx.tenant_id,
                    HdTicket.company_id == emp.company_id,
                    HdTicket.requester_employee_id == emp.id,
                    HdTicket.is_deleted.is_(False),
                )
                .order_by(HdTicket.created_at.desc())
                .limit(100)
            ).all()
        )
        return [self._ticket_to_item(row) for row in rows]

    def get_support_ticket(self, ctx: TenantContext, ticket_id: UUID) -> EssSupportTicketDetail:
        row = self._get_own_ticket(ctx, ticket_id)
        return self._ticket_to_detail(row)

    def create_support_ticket(
        self, ctx: TenantContext, body: EssSupportTicketCreate
    ) -> EssSupportTicketDetail:
        from modules.helpdesk.service.ticket_service import TicketService

        emp = self._ess.resolve_employee(ctx)
        if emp.branch_id is None:
            raise ConflictException("Employee branch is required to raise a ticket")
        category_id, priority_id = self._resolve_ticket_routing(ctx, emp.company_id, body.kind)
        ticket_type = "incident" if body.kind in {"asset", "it"} else "service_request"
        row = TicketService(self._db).create(
            ctx,
            branch_id=emp.branch_id,
            company_id=emp.company_id,
            category_id=category_id,
            priority_id=priority_id,
            ticket_type=ticket_type,
            requester_employee_id=emp.id,
            subject=body.subject.strip(),
            description=body.description.strip() if body.description else None,
            channel="ess",
            urgency=(body.urgency or "medium").lower()[:20],
            asset_id=body.asset_id,
            status="draft",
            opened_at=utcnow(),
        )
        TicketService(self._db).submit(ctx, row.id)
        refreshed = TicketService(self._db).get(ctx, row.id)
        return self._ticket_to_detail(refreshed)

    def list_support_ticket_comments(
        self, ctx: TenantContext, ticket_id: UUID
    ) -> list[EssSupportTicketCommentItem]:
        from modules.helpdesk.models.ticket_comment import HdTicketComment

        self._get_own_ticket(ctx, ticket_id)
        rows = list(
            self._db.scalars(
                select(HdTicketComment)
                .where(
                    HdTicketComment.ticket_id == ticket_id,
                    HdTicketComment.is_deleted.is_(False),
                    HdTicketComment.status == "active",
                )
                .order_by(HdTicketComment.commented_at.asc())
            ).all()
        )
        return [
            EssSupportTicketCommentItem(
                id=r.id,
                body=r.body,
                commented_at=r.commented_at,
                author_employee_id=r.author_employee_id,
            )
            for r in rows
        ]

    def add_support_ticket_comment(
        self, ctx: TenantContext, ticket_id: UUID, body: EssSupportTicketCommentCreate
    ) -> EssSupportTicketCommentItem:
        from modules.helpdesk.service.ticket_comment_service import TicketCommentService

        self._get_own_ticket(ctx, ticket_id)
        emp = self._ess.resolve_employee(ctx)
        row = TicketCommentService(self._db).create(
            ctx,
            company_id=emp.company_id,
            ticket_id=ticket_id,
            author_employee_id=emp.id,
            body=body.body.strip(),
            is_public=True,
            commented_at=datetime.now(timezone.utc),
            status="active",
        )
        return EssSupportTicketCommentItem(
            id=row.id,
            body=row.body,
            commented_at=row.commented_at,
            author_employee_id=row.author_employee_id,
        )

    def _bookings_for_date(self, ctx: TenantContext, company_id: UUID, on_date: date):
        return list(
            self._db.scalars(
                select(HrTrainingRequest).where(
                    HrTrainingRequest.tenant_id == ctx.tenant_id,
                    HrTrainingRequest.company_id == company_id,
                    HrTrainingRequest.is_deleted.is_(False),
                    HrTrainingRequest.request_date == on_date,
                    HrTrainingRequest.room_id.isnot(None),
                    HrTrainingRequest.status.in_(("submitted", "approved")),
                )
            ).all()
        )

    def _employee_display_names(
        self, ctx: TenantContext, employee_ids: set[UUID]
    ) -> dict[UUID, str]:
        if not employee_ids:
            return {}
        rows = list(
            self._db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.tenant_id == ctx.tenant_id,
                    MasterEmployee.id.in_(employee_ids),
                    MasterEmployee.is_deleted.is_(False),
                )
            ).all()
        )
        out: dict[UUID, str] = {}
        for emp in rows:
            label = f"{emp.first_name or ''} {emp.last_name or ''}".strip()
            if not label:
                label = str(getattr(emp, "employee_code", "") or "Employee")
            out[emp.id] = label
        return out

    def _booking_response(
        self,
        row: HrTrainingRequest,
        room_name: str | None,
        names: dict[UUID, str],
    ) -> EssMeetingBookingResponse:
        return EssMeetingBookingResponse(
            id=row.id,
            room_id=row.room_id,
            room_name=room_name,
            title=row.title,
            request_date=row.request_date,
            start_time=row.start_time,
            end_time=row.end_time,
            status=row.status,
            requested_by_employee_id=row.requested_by_employee_id,
            requested_by_name=names.get(row.requested_by_employee_id),
        )

    def _assert_room_free(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        room_id: UUID,
        on_date: date,
        start_time: time | None,
        end_time: time | None,
    ) -> None:
        for b in self._bookings_for_date(ctx, company_id, on_date):
            if b.room_id != room_id:
                continue
            if _time_overlap(start_time, end_time, b.start_time, b.end_time):
                raise ConflictException("Room is already booked for this time slot")

    def _get_asset_for_employee(self, ctx: TenantContext, asset_id: UUID) -> EssAssetItem:
        self._assert_asset_access(ctx, asset_id)
        from modules.asset.models.asset import AstAsset

        asset = self._db.get(AstAsset, asset_id)
        if asset is None or getattr(asset, "is_deleted", False):
            raise NotFoundException("Asset not found")
        return self._asset_row_to_item(asset, self._assignment_label(ctx, asset_id))

    def _assert_asset_access(self, ctx: TenantContext, asset_id: UUID) -> None:
        allowed = {a.id for a in self._ess.list_assets(ctx)}
        if asset_id not in allowed:
            raise ForbiddenException("You do not have access to this asset")

    def _assignment_label(self, ctx: TenantContext, asset_id: UUID) -> str:
        for a in self._ess.list_assets(ctx):
            if a.id == asset_id:
                return a.assignment_status or "assigned"
        return "assigned"

    def _assignment_label_optional(self, ctx: TenantContext, asset_id: UUID) -> str:
        for a in self._ess.list_assets(ctx):
            if a.id == asset_id:
                return a.assignment_status or "assigned"
        return "scanned"

    def _asset_row_to_item(self, asset, assignment_status: str) -> EssAssetItem:
        return EssAssetItem(
            id=asset.id,
            asset_code=asset.asset_code,
            asset_name=asset.asset_name,
            asset_type=asset.asset_type,
            serial_number=asset.serial_number,
            status=asset.status,
            assignment_status=assignment_status,
        )

    def _to_asset_detail(self, item: EssAssetItem) -> EssAssetDetail:
        from modules.asset.models.asset import AstAsset

        asset = self._db.get(AstAsset, item.id)
        return EssAssetDetail(
            **item.model_dump(),
            qr_code=getattr(asset, "qr_code", None) if asset else None,
            barcode=getattr(asset, "barcode", None) if asset else None,
        )

    def _get_own_ticket(self, ctx: TenantContext, ticket_id: UUID):
        from modules.helpdesk.models.ticket import HdTicket

        emp = self._ess.resolve_employee(ctx)
        row = self._db.get(HdTicket, ticket_id)
        if row is None or row.is_deleted or row.requester_employee_id != emp.id:
            raise NotFoundException("Ticket not found")
        return row

    def _ticket_to_item(self, row) -> EssSupportTicketItem:
        kind = "it"
        if row.channel == "ess" and row.ticket_type == "service_request":
            kind = "grievance"
        if row.asset_id:
            kind = "asset"
        return EssSupportTicketItem(
            id=row.id,
            document_number=row.document_number,
            subject=row.subject,
            status=row.status,
            kind=kind,
            urgency=row.urgency,
            created_at=row.created_at,
            asset_id=row.asset_id,
        )

    def _ticket_to_detail(self, row) -> EssSupportTicketDetail:
        base = self._ticket_to_item(row)
        return EssSupportTicketDetail(
            **base.model_dump(),
            description=row.description,
            opened_at=row.opened_at,
            resolved_at=row.resolved_at,
        )

    def _resolve_ticket_routing(self, ctx: TenantContext, company_id: UUID, kind: str) -> tuple[UUID, UUID]:
        from modules.helpdesk.models.ticket_category import HdTicketCategory
        from modules.helpdesk.models.ticket_priority import HdTicketPriority

        cat_code = {
            "grievance": "ESS_GRIEVANCE",
            "asset": "ESS_ASSET",
            "it": "ESS_IT",
        }.get(kind, "ESS_IT")
        cat_name = {
            "grievance": "Employee grievance",
            "asset": "Asset support",
            "it": "IT support",
        }.get(kind, "IT support")

        cat = self._db.scalar(
            select(HdTicketCategory).where(
                HdTicketCategory.tenant_id == ctx.tenant_id,
                HdTicketCategory.company_id == company_id,
                HdTicketCategory.category_code == cat_code,
                HdTicketCategory.is_deleted.is_(False),
            )
        )
        if cat is None:
            cat = HdTicketCategory(
                id=uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=company_id,
                category_code=cat_code,
                category_name=cat_name,
                status="active",
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
            self._db.add(cat)
            self._db.flush()

        pri = self._db.scalar(
            select(HdTicketPriority).where(
                HdTicketPriority.tenant_id == ctx.tenant_id,
                HdTicketPriority.company_id == company_id,
                HdTicketPriority.priority_code == "ESS_MEDIUM",
                HdTicketPriority.is_deleted.is_(False),
            )
        )
        if pri is None:
            pri = HdTicketPriority(
                id=uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=company_id,
                priority_code="ESS_MEDIUM",
                priority_name="Medium",
                rank_order=2,
                status="active",
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
            self._db.add(pri)
            self._db.flush()

        return cat.id, pri.id
