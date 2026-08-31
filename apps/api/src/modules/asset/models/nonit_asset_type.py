"""Non-IT asset type master (furniture, facilities, etc.). Separate from IT ast_asset."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstMasterMixin


class AstNonitAssetType(Base, *AstMasterMixin):
    __tablename__ = "ast_nonit_asset_type"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uk_ast_nonit_asset_type_name"),
        UniqueConstraint("company_id", "prefix", name="uk_ast_nonit_asset_type_prefix"),
        CheckConstraint(
            "assignment_mode IN ('EMPLOYEE','LOCATION','BOTH')",
            name="ck_ast_nonit_asset_type_assignment_mode",
        ),
        CheckConstraint(
            "category IN ("
            "'FURNITURE','APPLIANCE','ELECTRONICS','FIXTURE','EQUIPMENT','STORAGE','OTHER'"
            ")",
            name="ck_ast_nonit_asset_type_category",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    prefix: Mapped[str] = mapped_column(String(20), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    assignment_mode: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(
        String(40), nullable=False, default="OTHER", server_default="OTHER"
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Column name "metadata" — avoid clashing with SQLAlchemy Base.metadata
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
