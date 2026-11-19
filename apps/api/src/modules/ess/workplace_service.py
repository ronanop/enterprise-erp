"""ESS Phase 5 - meeting rooms, assets (QR), helpdesk tickets."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import TYPE_CHECKING, Any
from uuid import UUID

from core.exceptions import ConflictException, ForbiddenException, NotFoundException
from modules.ess.adapters.asset_adapter import EssAssetAdapter
from modules.ess.adapters.helpdesk_adapter import EssHelpdeskAdapter
from modules.ess.adapters.hr_adapter import EssHrAdapter
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
from modules.hr.service.training_service import TrainingRequestService, TrainingRoomService

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
        self._assets = EssAssetAdapter(db)
        self._helpdesk = EssHelpdeskAdapter(db)
        self._hr = EssHrAdapter(db)

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
        bookings = self._hr.list_room_bookings_for_day(
            ctx, company_id=emp.company_id, on_date=on_date
        )
        by_room: dict[UUID, list[Any]] = {}
        for b in bookings:
            if b.room_id:
                by_room.setdefault(b.room_id, []).append(b)
        emp_ids = {b.requested_by_employee_id for b in bookings}
        names = self._hr.employee_display_names(ctx, emp_ids)

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
        rows = self._hr.list_room_bookings(ctx, company_id=emp.company_id, on_date=on_date)
        room_names = {r.id: r.room_name for r in TrainingRoomService(self._db).list(ctx, emp.company_id)}
        emp_ids = {row.requested_by_employee_id for row in rows}
        names = self._hr.employee_display_names(ctx, emp_ids)
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
        host_name = self._hr.employee_display_names(ctx, {emp.id})
        return self._booking_response(row, room.room_name, host_name)

    def get_asset(self, ctx: TenantContext, asset_id: UUID) -> EssAssetDetail:
        item = self._get_asset_for_employee(ctx, asset_id)
        return self._to_asset_detail(item)

    def lookup_asset(self, ctx: TenantContext, *, code: str) -> EssAssetDetail:
        emp = self._ess.resolve_employee(ctx)
        asset = self._assets.lookup_by_code(ctx, company_id=emp.company_id, code=code)
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
        emp = self._ess.resolve_employee(ctx)
        asset = self._assets.get(asset_id)
        if asset is None or asset.company_id != emp.company_id:
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
        emp = self._ess.resolve_employee(ctx)
        rows = self._helpdesk.list_requester_tickets(
            ctx, company_id=emp.company_id, employee_id=emp.id
        )
        return [self._ticket_to_item(row) for row in rows]

    def get_support_ticket(self, ctx: TenantContext, ticket_id: UUID) -> EssSupportTicketDetail:
        row = self._get_own_ticket(ctx, ticket_id)
        return self._ticket_to_detail(row)

    def create_support_ticket(
        self, ctx: TenantContext, body: EssSupportTicketCreate
    ) -> EssSupportTicketDetail:
        emp = self._ess.resolve_employee(ctx)
        if emp.branch_id is None:
            raise ConflictException("Employee branch is required to raise a ticket")
        row = self._helpdesk.create_ticket(
            ctx,
            company_id=emp.company_id,
            branch_id=emp.branch_id,
            requester_employee_id=emp.id,
            subject=body.subject.strip(),
            description=body.description.strip() if body.description else None,
            kind=body.kind,
            urgency=body.urgency,
            asset_id=body.asset_id,
        )
        return self._ticket_to_detail(row)

    def list_support_ticket_comments(
        self, ctx: TenantContext, ticket_id: UUID
    ) -> list[EssSupportTicketCommentItem]:
        self._get_own_ticket(ctx, ticket_id)
        rows = self._helpdesk.list_comments(ticket_id)
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
        self._get_own_ticket(ctx, ticket_id)
        emp = self._ess.resolve_employee(ctx)
        row = self._helpdesk.add_comment(
            ctx,
            company_id=emp.company_id,
            ticket_id=ticket_id,
            author_employee_id=emp.id,
            body=body.body.strip(),
        )
        return EssSupportTicketCommentItem(
            id=row.id,
            body=row.body,
            commented_at=row.commented_at,
            author_employee_id=row.author_employee_id,
        )

    def _booking_response(
        self,
        row: Any,
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
        for b in self._hr.list_room_bookings_for_day(ctx, company_id=company_id, on_date=on_date):
            if b.room_id != room_id:
                continue
            if _time_overlap(start_time, end_time, b.start_time, b.end_time):
                raise ConflictException("Room is already booked for this time slot")

    def _get_asset_for_employee(self, ctx: TenantContext, asset_id: UUID) -> EssAssetItem:
        self._assert_asset_access(ctx, asset_id)
        asset = self._assets.get(asset_id)
        if asset is None:
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
        asset = self._assets.get(item.id)
        return EssAssetDetail(
            **item.model_dump(),
            qr_code=getattr(asset, "qr_code", None) if asset else None,
            barcode=getattr(asset, "barcode", None) if asset else None,
        )

    def _get_own_ticket(self, ctx: TenantContext, ticket_id: UUID):
        emp = self._ess.resolve_employee(ctx)
        row = self._helpdesk.get_ticket(ticket_id)
        if row is None or row.is_deleted or row.requester_employee_id != emp.id:
            raise NotFoundException("Ticket not found")
        return row

    def _ticket_to_item(self, row) -> EssSupportTicketItem:
        kind = getattr(row, "kind", None) or "it"
        if kind not in {"it", "asset", "grievance"}:
            kind = "asset" if row.asset_id else "it"
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

