"""Simple document/code number helper for marketing entities."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session


class MarketingNumberService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def next_code(self, model, company_id: UUID, field: str, prefix: str) -> str:
        count = self.db.scalar(
            select(func.count()).select_from(model).where(
                model.company_id == company_id,
                model.is_deleted.is_(False),
            )
        )
        seq = int(count or 0) + 1
        return f"{prefix}-{seq:05d}"
