"""Document port — UUID-only stubs; no doc_* FK / ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session


class PortalDocumentAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_document_uuid(self, document_id: UUID | None) -> UUID | None:
        _ = (self._db,)
        return document_id
