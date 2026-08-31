"""Repository for ast_dc_challan_document child rows."""

from __future__ import annotations

from collections import defaultdict
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.asset.models.dc_challan_document import AstDcChallanDocument
from modules.asset.repository.base import utcnow
from modules.foundation.domain.value_objects import TenantContext


class DcChallanDocumentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_active(self, dc_challan_id: UUID) -> list[AstDcChallanDocument]:
        stmt = select(AstDcChallanDocument).where(
            AstDcChallanDocument.dc_challan_id == dc_challan_id,
            AstDcChallanDocument.is_deleted.is_(False),
        )
        rows = self.db.scalars(stmt).all()
        if not isinstance(rows, (list, tuple)):
            return []
        return list(rows)

    def map_active(
        self, dc_challan_ids: list[UUID]
    ) -> dict[UUID, list[AstDcChallanDocument]]:
        if not dc_challan_ids:
            return {}
        stmt = select(AstDcChallanDocument).where(
            AstDcChallanDocument.dc_challan_id.in_(dc_challan_ids),
            AstDcChallanDocument.is_deleted.is_(False),
        )
        grouped: dict[UUID, list[AstDcChallanDocument]] = defaultdict(list)
        rows = self.db.scalars(stmt).all()
        if not isinstance(rows, (list, tuple)):
            return {}
        for row in rows:
            grouped[row.dc_challan_id].append(row)
        return dict(grouped)

    def get_active(
        self, dc_challan_id: UUID, doc_kind: str
    ) -> AstDcChallanDocument | None:
        stmt = select(AstDcChallanDocument).where(
            AstDcChallanDocument.dc_challan_id == dc_challan_id,
            AstDcChallanDocument.doc_kind == doc_kind,
            AstDcChallanDocument.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> AstDcChallanDocument:
        row = AstDcChallanDocument(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def soft_delete(self, ctx: TenantContext, row: AstDcChallanDocument) -> None:
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()
