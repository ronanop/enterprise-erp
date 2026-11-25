"""ESS workplace social feed ORM (Instagram-style posts / media / likes / comments)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrEssFeedPost(Base, *HrTransactionMixin):
    __tablename__ = "hr_ess_feed_post"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','processing','published','failed','hidden')",
            name="ck_hr_ess_feed_post_status",
        ),
        CheckConstraint(
            "aspect_ratio IN ('1:1','3:4','4:3')",
            name="ck_hr_ess_feed_post_aspect",
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
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    aspect_ratio: Mapped[str] = mapped_column(String(10), nullable=False, default="1:1")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="published", index=True)
    like_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    comment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, server_default=func.now()
    )


class HrEssFeedMedia(Base, *HrTransactionMixin):
    __tablename__ = "hr_ess_feed_media"
    __table_args__ = (
        CheckConstraint(
            "media_type IN ('image','video')",
            name="ck_hr_ess_feed_media_type",
        ),
        CheckConstraint(
            "processing_status IN ('ready','pending','processing','failed')",
            name="ck_hr_ess_feed_media_proc",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    post_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_ess_feed_post.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    media_type: Mapped[str] = mapped_column(String(20), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_uri: Mapped[str] = mapped_column(String(500), nullable=False)
    # Compressed / processed object (videos). Falls back to storage_uri when null.
    processed_storage_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ready", server_default="ready"
    )


class HrEssFeedLike(Base, *HrTransactionMixin):
    __tablename__ = "hr_ess_feed_like"
    __table_args__ = (
        UniqueConstraint(
            "post_id",
            "employee_id",
            name="uk_hr_ess_feed_like_post_emp",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    post_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_ess_feed_post.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )


class HrEssFeedComment(Base, *HrTransactionMixin):
    __tablename__ = "hr_ess_feed_comment"
    __table_args__ = ({"schema": "hr"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    post_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_ess_feed_post.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    author_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
