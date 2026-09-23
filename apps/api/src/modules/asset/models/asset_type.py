"""IT Asset Type master — admin-manageable catalog for ast_asset.asset_type_id."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstMasterMixin


class AstAssetType(Base, *AstMasterMixin):
    __tablename__ = "ast_asset_type"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uk_ast_asset_type_name"),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    requires_hardware_config: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    eligible_as_component: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
