"""Chart of accounts ORM models."""

from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.finance.models.mixins import FinanceMasterMixin


class FinAccountGroup(Base, *FinanceMasterMixin):
    __tablename__ = "fin_account_group"
    __table_args__ = (
        UniqueConstraint("company_id", "group_code", name="uk_fin_account_group_company_code"),
        CheckConstraint(
            "account_type IN ('asset','liability','equity','revenue','expense')",
            name="ck_fin_account_group_type",
        ),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_fin_account_group_status",
        ),
        {"schema": "finance"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    group_code: Mapped[str] = mapped_column(String(20), nullable=False)
    group_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[str] = mapped_column(String(30), nullable=False)
    parent_group_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("finance.fin_account_group.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    display_order: Mapped[int] = mapped_column(SmallInteger, default=1, server_default="1")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    parent_group: Mapped["FinAccountGroup | None"] = relationship(
        remote_side="FinAccountGroup.id",
        foreign_keys=[parent_group_id],
    )


class FinChartOfAccount(Base, *FinanceMasterMixin):
    __tablename__ = "fin_chart_of_account"
    __table_args__ = (
        UniqueConstraint("company_id", "account_code", name="uk_fin_coa_company_code"),
        CheckConstraint(
            "account_type IN ('asset','liability','equity','revenue','expense')",
            name="ck_fin_coa_type",
        ),
        CheckConstraint(
            "normal_balance IN ('debit','credit')",
            name="ck_fin_coa_normal_balance",
        ),
        CheckConstraint(
            "status IN ('draft','active','inactive')",
            name="ck_fin_coa_status",
        ),
        {"schema": "finance"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    account_group_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("finance.fin_account_group.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    account_code: Mapped[str] = mapped_column(String(50), nullable=False)
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    parent_account_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("finance.fin_chart_of_account.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    is_posting_account: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    is_cost_center_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    is_profit_center_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    normal_balance: Mapped[str] = mapped_column(String(10), nullable=False)
    currency_code: Mapped[str | None] = mapped_column(String(3), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_tax_applicable: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    account_group: Mapped[FinAccountGroup] = relationship(foreign_keys=[account_group_id])
    parent_account: Mapped["FinChartOfAccount | None"] = relationship(
        remote_side="FinChartOfAccount.id",
        foreign_keys=[parent_account_id],
    )
