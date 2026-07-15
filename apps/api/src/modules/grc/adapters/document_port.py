"""Document port — UUID-only stubs; no doc_* FK / ORM writes."""

from uuid import UUID


class GrcDocumentAdapter:
    def resolve_document_uuid(self, document_id: UUID | None) -> UUID | None:
        return document_id
