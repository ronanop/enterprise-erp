"""Service port — UUID-only stubs; no svc_* FK / ORM writes."""

from uuid import UUID


class HelpdeskServiceAdapter:
    def resolve_service_request_uuid(self, service_request_id: UUID | None) -> UUID | None:
        return service_request_id

    def resolve_service_ticket_uuid(self, service_ticket_id: UUID | None) -> UUID | None:
        return service_ticket_id

    def resolve_work_order_uuid(self, work_order_id: UUID | None) -> UUID | None:
        return work_order_id
