"""Immutable audit trail of sales-blueprint state transitions."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmDetailMixin


class CrmStateHistory(Base, *CrmDetailMixin):
    __tablename__ = "crm_state_history"
    __table_args__ = ({"schema": "crm"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    from_state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_state: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    performed_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
