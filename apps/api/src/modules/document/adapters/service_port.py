"""Service port — UUID-only stubs; no svc_* FK / ORM writes."""

from uuid import UUID


class DocumentServiceAdapter:
    def resolve_service_request_uuid(self, service_request_id: UUID | None) -> UUID | None:
        return service_request_id
