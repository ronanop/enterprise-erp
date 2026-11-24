"""HR workplace social feed ORM (company-wide ESS timeline)."""

from uuid import UUID, uuid4

from sqlalchemy import (
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrWorkplaceFeedPost(Base, *HrTransactionMixin):
    __tablename__ = "hr_workplace_feed_post"
    __table_args__ = ({"schema": "hr"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    author_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    caption: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Cover / first image (kept for compatibility; full set in media rows)
    storage_uri: Mapped[str] = mapped_column(String(500), nullable=False)
    image_content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    image_file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    like_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class HrWorkplaceFeedMedia(Base, *HrTransactionMixin):
    """Up to 5 photos per feed post (sort_order 0..4)."""

    __tablename__ = "hr_workplace_feed_media"
    __table_args__ = (
        UniqueConstraint(
            "post_id",
            "sort_order",
            name="uk_hr_workplace_feed_media_post_sort",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    post_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_workplace_feed_post.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    storage_uri: Mapped[str] = mapped_column(String(500), nullable=False)
    image_content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    image_file_name: Mapped[str] = mapped_column(String(255), nullable=False)


class HrWorkplaceFeedLike(Base, *HrTransactionMixin):
    __tablename__ = "hr_workplace_feed_like"
    __table_args__ = (
        UniqueConstraint(
            "post_id",
            "employee_id",
            name="uk_hr_workplace_feed_like_post_employee",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    post_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_workplace_feed_post.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )


class HrWorkplaceFeedComment(Base, *HrTransactionMixin):
    __tablename__ = "hr_workplace_feed_comment"
    __table_args__ = ({"schema": "hr"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    post_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_workplace_feed_post.id", ondelete="CASCADE"),
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
