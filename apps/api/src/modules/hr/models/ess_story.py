"""ESS Instagram-style Stories ORM (24h ephemeral vertical media)."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrEssStory(Base, *HrTransactionMixin):
    __tablename__ = "hr_ess_story"
    __table_args__ = (
        CheckConstraint(
            "media_type IN ('image','video')",
            name="ck_hr_ess_story_media_type",
        ),
        CheckConstraint(
            "status IN ('active','expired','hidden')",
            name="ck_hr_ess_story_status",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    author_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    media_type: Mapped[str] = mapped_column(String(20), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_uri: Mapped[str] = mapped_column(String(500), nullable=False)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    overlays_json: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    like_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active", index=True
    )
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )


class HrEssStoryView(Base, *HrTransactionMixin):
    __tablename__ = "hr_ess_story_view"
    __table_args__ = (
        UniqueConstraint(
            "story_id",
            "viewer_employee_id",
            name="uk_hr_ess_story_view_story_viewer",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    story_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_ess_story.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    viewer_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    viewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class HrEssStoryLike(Base, *HrTransactionMixin):
    __tablename__ = "hr_ess_story_like"
    __table_args__ = (
        UniqueConstraint(
            "story_id",
            "employee_id",
            name="uk_hr_ess_story_like_story_emp",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    story_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_ess_story.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )


class HrEssStoryMention(Base, *HrTransactionMixin):
    __tablename__ = "hr_ess_story_mention"
    __table_args__ = (
        UniqueConstraint(
            "story_id",
            "mentioned_employee_id",
            name="uk_hr_ess_story_mention_story_emp",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    story_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_ess_story.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    mentioned_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
