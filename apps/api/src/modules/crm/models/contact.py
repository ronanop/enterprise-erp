"""CRM contact ORM (people under a Company / sales account).

Note: the FK to the sales account is named ``company_account_id`` (not
``company_id``) to avoid colliding with ``CrmTransactionMixin.company_id``,
which is the tenant/org company used for multi-tenant scoping. This mirrors
the same convention used on ``crm_lead`` / ``crm_opportunity``.
"""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmTransactionMixin


class CrmContact(Base, *CrmTransactionMixin):
    __tablename__ = "crm_contact"
    __table_args__ = ({"schema": "crm"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    company_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_company.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    mobile: Mapped[str | None] = mapped_column(String(30), nullable=True)
    title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    owner_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
