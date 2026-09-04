"""Non-IT physical location (conference room, lobby, etc.)."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstTransactionMixin


class AstNonitLocation(Base, *AstTransactionMixin):
    __tablename__ = "ast_nonit_location"
    __table_args__ = (
        CheckConstraint(
            "location_kind IN ("
            "'CONFERENCE_ROOM','MEETING_ROOM','DEPARTMENT','FLOOR','CABIN',"
            "'LOBBY','CAFETERIA','COMMON_AREA','WAREHOUSE','PARKING','OTHER'"
            ")",
            name="ck_ast_nonit_location_kind",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location_kind: Mapped[str] = mapped_column(
        String(40), nullable=False, default="OTHER", server_default="OTHER"
    )
    code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    building: Mapped[str | None] = mapped_column(String(120), nullable=True)
    floor: Mapped[str | None] = mapped_column(String(40), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
