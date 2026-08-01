"""Biometric device registry ORM."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrDetailMixin


class HrBiometricDevice(Base, *HrDetailMixin):
    __tablename__ = "hr_biometric_device"
    __table_args__ = (
        UniqueConstraint("company_id", "device_code", name="uk_hr_bio_device_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_hr_bio_device_status"),
        CheckConstraint(
            "device_model IN ('fingerprint_k40_timelabs')",
            name="ck_hr_bio_device_model",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    device_code: Mapped[str] = mapped_column(String(50), nullable=False)
    device_name: Mapped[str] = mapped_column(String(255), nullable=False)
    device_model: Mapped[str] = mapped_column(
        String(80), nullable=False, default="fingerprint_k40_timelabs"
    )
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    location_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    api_key_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
