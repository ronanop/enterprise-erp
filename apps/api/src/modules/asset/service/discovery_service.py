"""Asset Discovery application service (CR-003).

Flow: parse (preview, no persist) → apply (AssetService.apply_discovery_profile only).
Parser never touches repositories.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.domain.exceptions import DiscoveryValidationError
from modules.asset.schemas import (
    DiscoveryApplyResult,
    DiscoveryChangeItem,
    DiscoveryParseResult,
)
from modules.asset.service.asset_service import AssetService
from modules.asset.service.discovery_parser import HardwareInventoryParser
from modules.asset.service.discovery_validator import DiscoveryValidator
from modules.foundation.domain.value_objects import TenantContext


class AssetDiscoveryService:
    def __init__(self, db: Session) -> None:
        self._assets = AssetService(db)
        self._parser = HardwareInventoryParser()
        self._validator = DiscoveryValidator(db)

    def get_command(self, platform: str) -> dict[str, str]:
        key = self._validator.validate_platform(platform)
        return {"platform": key, "command": self._parser.command_for(key)}

    def parse(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        platform: str,
        raw_output: str,
    ) -> DiscoveryParseResult:
        key = self._validator.validate_platform(platform)
        raw = self._validator.validate_raw_output(raw_output)
        try:
            profile = self._parser.parse(key, raw)
        except ValueError as exc:
            raise DiscoveryValidationError(str(exc)) from exc
        profile = self._validator.validate_profile(profile)
        asset = self._assets.get(ctx, asset_id)
        changes = self._diff(asset.discovery_profile_json, asset.serial_number, profile)
        return DiscoveryParseResult(
            asset_id=asset.id,
            platform=key,
            profile=profile,
            changes=changes,
            current_serial_number=asset.serial_number,
            proposed_serial_number=(profile.get("device") or {}).get("serial_number"),
            persisted=False,
        )

    def apply(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        platform: str,
        raw_output: str,
        version: int,
        preview_confirmed: bool,
    ) -> DiscoveryApplyResult:
        if not preview_confirmed:
            raise DiscoveryValidationError(
                "preview_confirmed must be true — parse/preview before apply"
            )
        preview = self.parse(ctx, asset_id, platform=platform, raw_output=raw_output)
        profile = dict(preview.profile)
        profile["metadata"] = {
            "scanned_by": str(ctx.user_id) if ctx.user_id else None,
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "platform": preview.platform,
            "parser_version": profile.get("parser_version"),
        }
        profile = self._validator.validate_profile(profile)
        serial = (profile.get("device") or {}).get("serial_number")
        updated = self._assets.apply_discovery_profile(
            ctx,
            asset_id,
            profile=profile,
            serial_number=serial,
            version=version,
        )
        return DiscoveryApplyResult(
            asset_id=updated.id,
            version=int(updated.version or 1),
            serial_number=updated.serial_number,
            discovery_profile_json=updated.discovery_profile_json,
            changes=preview.changes,
            applied=True,
        )

    def _diff(
        self,
        current_profile: dict | None,
        current_serial: str | None,
        proposed: dict[str, Any],
    ) -> list[DiscoveryChangeItem]:
        current = current_profile if isinstance(current_profile, dict) else {}
        changes: list[DiscoveryChangeItem] = []

        def walk(prefix: str, before: Any, after: Any) -> None:
            if isinstance(after, dict):
                before_dict = before if isinstance(before, dict) else {}
                keys = set(before_dict) | set(after)
                for key in sorted(keys):
                    path = f"{prefix}.{key}" if prefix else key
                    walk(path, before_dict.get(key), after.get(key))
                return
            before_norm = None if before in ("", None) else before
            after_norm = None if after in ("", None) else after
            if before_norm != after_norm:
                changes.append(
                    DiscoveryChangeItem(
                        path=prefix,
                        before=before_norm,
                        after=after_norm,
                    )
                )

        walk("profile", current, proposed)
        proposed_serial = (proposed.get("device") or {}).get("serial_number")
        if (current_serial or None) != (proposed_serial or None):
            # Ensure serial change is visible even if nested path already captured
            if not any(c.path == "profile.device.serial_number" for c in changes):
                changes.append(
                    DiscoveryChangeItem(
                        path="asset.serial_number",
                        before=current_serial,
                        after=proposed_serial,
                    )
                )
        return changes
