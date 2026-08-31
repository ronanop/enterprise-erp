"""Discovery validation (CR-003)."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.domain.enums import AssetStatus
from modules.asset.domain.exceptions import DiscoveryValidationError
from modules.asset.models import AstAsset
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.service.discovery_parser import SUPPORTED_PLATFORMS
from modules.foundation.domain.value_objects import TenantContext

MAX_RAW_BYTES = 256 * 1024
ALLOWED_APPLY_STATUSES = frozenset(
    {
        AssetStatus.DRAFT.value,
        AssetStatus.APPROVED.value,
        AssetStatus.ACTIVE.value,
        AssetStatus.IN_MAINTENANCE.value,
        AssetStatus.TRANSFERRED.value,
    }
)
# Scalar ORM fields discovery may update (everything else stays in JSON only).
ALLOWLISTED_ASSET_FIELDS = frozenset({"serial_number", "discovery_profile_json", "version"})
FORBIDDEN_ASSET_FIELDS = frozenset(
    {
        "purchase_cost",
        "current_book_value",
        "salvage_value",
        "asset_category_id",
        "department_id",
        "custodian_employee_id",
        "status",
        "workflow_status",
        "workflow_instance_id",
        "purchase_order_id",
        "grn_id",
        "branch_id",
        "company_id",
        "asset_code",
        "document_number",
    }
)


class DiscoveryValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)

    def validate_platform(self, platform: str) -> str:
        key = (platform or "").strip().lower()
        if key not in SUPPORTED_PLATFORMS:
            raise DiscoveryValidationError(
                "platform must be one of: windows, linux, macos"
            )
        return key

    def validate_raw_output(self, raw_output: str) -> str:
        text = raw_output or ""
        if not text.strip():
            raise DiscoveryValidationError("raw_output is required")
        if len(text.encode("utf-8")) > MAX_RAW_BYTES:
            raise DiscoveryValidationError("raw_output exceeds maximum size of 256KB")
        return text

    def validate_profile(self, profile: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(profile, dict):
            raise DiscoveryValidationError("discovery profile must be an object")
        try:
            encoded = json.dumps(profile, default=str)
        except (TypeError, ValueError) as exc:
            raise DiscoveryValidationError("discovery profile is not JSON-serializable") from exc
        if len(encoded.encode("utf-8")) > MAX_RAW_BYTES:
            raise DiscoveryValidationError("discovery profile exceeds maximum size")
        device = profile.get("device") or {}
        if not isinstance(device, dict):
            raise DiscoveryValidationError("device section must be an object")
        serial = device.get("serial_number")
        if serial is not None:
            serial_text = str(serial).strip()
            if not serial_text:
                device["serial_number"] = None
            elif len(serial_text) > 100:
                raise DiscoveryValidationError("serial_number exceeds maximum length")
            else:
                device["serial_number"] = serial_text
        profile["device"] = device
        return profile

    def validate_apply_readiness(self, row: AstAsset) -> None:
        if row.status not in ALLOWED_APPLY_STATUSES:
            raise DiscoveryValidationError(
                f"Discovery cannot be applied when asset status is '{row.status}'"
            )

    def validate_apply_fields(self, fields: dict[str, Any]) -> None:
        for key in fields:
            if key in FORBIDDEN_ASSET_FIELDS:
                raise DiscoveryValidationError(f"Field '{key}' cannot be updated by discovery")
            if key not in ALLOWLISTED_ASSET_FIELDS:
                raise DiscoveryValidationError(f"Field '{key}' is not allowlisted for discovery")

    def validate_serial_unique(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        serial_number: str | None,
        exclude_id: UUID,
    ) -> None:
        if not serial_number:
            return
        existing = self._assets.find_by_serial(
            ctx, company_id, serial_number, exclude_id=exclude_id
        )
        if existing is not None:
            raise DiscoveryValidationError(
                f"Serial number '{serial_number}' is already registered"
            )
