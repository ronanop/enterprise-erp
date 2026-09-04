"""Asset meter reading validation rules for FP-ASSET-015."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import AssetMeterReadingStatus, AssetStatus
from modules.asset.domain.exceptions import MeterReadingValidationError
from modules.asset.models import AstAssetMeterReading
from modules.asset.repository.asset_meter_reading_repository import AssetMeterReadingRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.base import utcnow
from modules.foundation.domain.value_objects import TenantContext

METER_TYPES = frozenset({"odometer", "runtime_hours", "cycle_count", "other"})
BLOCKED_ASSET_STATUSES = frozenset(
    {
        AssetStatus.DISPOSED.value,
        AssetStatus.WRITTEN_OFF.value,
    }
)
PROGRESSION_METER_TYPES = frozenset({"odometer", "runtime_hours", "cycle_count", "other"})


class MeterReadingValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._readings = AssetMeterReadingRepository(db)
        self._master = AssetMasterDataAdapter(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        if fields.get("status") and fields["status"] != AssetMeterReadingStatus.RECORDED.value:
            raise MeterReadingValidationError("Meter reading must be created in recorded status")

        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise MeterReadingValidationError("asset_id is required")

        meter_type = fields.get("meter_type")
        if not meter_type or str(meter_type).strip() not in METER_TYPES:
            raise MeterReadingValidationError(
                "meter_type must be odometer, runtime_hours, cycle_count, or other"
            )
        meter_type = str(meter_type).strip()

        reading_value = fields.get("reading_value")
        if reading_value is None:
            raise MeterReadingValidationError("reading_value is required")
        try:
            value = Decimal(str(reading_value))
        except Exception as exc:
            raise MeterReadingValidationError("reading_value must be a number") from exc
        if value < 0:
            raise MeterReadingValidationError("reading_value cannot be negative")
        fields["reading_value"] = value

        reading_at = fields.get("reading_at")
        if reading_at is None:
            raise MeterReadingValidationError("reading_at is required")
        if not isinstance(reading_at, datetime):
            raise MeterReadingValidationError("reading_at must be a datetime")
        if reading_at.tzinfo is None:
            reading_at = reading_at.replace(tzinfo=timezone.utc)
            fields["reading_at"] = reading_at
        now = utcnow()
        if reading_at > now:
            raise MeterReadingValidationError("reading_at cannot be in the future")

        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.company_id != company_id:
            raise MeterReadingValidationError("Asset does not belong to this company")
        self._validate_asset_operational(asset.status)

        employee_id = fields.get("recorded_by_employee_id")
        if employee_id is not None:
            self._validate_employee(ctx, employee_id)

        if self._readings.find_duplicate_reading(
            ctx,
            asset_id=asset_id,
            meter_type=meter_type,
            reading_at=reading_at,
            reading_value=value,
        ):
            raise MeterReadingValidationError(
                "An identical meter reading already exists for this asset, type, and timestamp"
            )

        if meter_type in PROGRESSION_METER_TYPES:
            latest = self._readings.find_latest_reading(ctx, asset_id, meter_type)
            if latest is not None and value < latest.reading_value:
                raise MeterReadingValidationError(
                    "reading_value cannot be less than the latest recorded reading for this meter type"
                )

    def validate_void_readiness(self, ctx: TenantContext, row: AstAssetMeterReading) -> None:
        if row.status != AssetMeterReadingStatus.RECORDED.value:
            raise MeterReadingValidationError("Only recorded meter readings can be voided")

    @staticmethod
    def _validate_asset_operational(status: str) -> None:
        if status in BLOCKED_ASSET_STATUSES:
            raise MeterReadingValidationError(
                "Meter readings cannot be recorded for disposed or written-off assets"
            )

    def _validate_employee(self, ctx: TenantContext, employee_id: UUID) -> None:
        employee = self._master.get_employee(ctx, employee_id)
        if employee is None:
            raise MeterReadingValidationError("recorded_by_employee_id is invalid")
