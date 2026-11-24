"""Sync charger accessories as real AstAssetComponent rows (CHARGER type).

Charger Available / Charger Code on asset create/update are convenience inputs only.
They never persist as asset columns — the component relationship is the source of truth.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.domain.enums import AssetComponentType
from modules.asset.domain.exceptions import RegistrationValidationError
from modules.asset.models import AstAsset, AstAssetComponent
from modules.asset.repository.asset_component_repository import AssetComponentRepository
from modules.asset.service.component_service import ComponentService
from modules.foundation.domain.value_objects import TenantContext

_CHARGER = AssetComponentType.CHARGER.value


class AssetChargerService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._components = AssetComponentRepository(db)

    def find_active_charger(
        self, ctx: TenantContext, asset_id: UUID
    ) -> AstAssetComponent | None:
        return self._components.find_active_by_type(
            ctx, asset_id=asset_id, component_type=_CHARGER
        )

    def sync(
        self,
        ctx: TenantContext,
        asset: AstAsset,
        *,
        charger_available: bool | None,
        charger_code: str | None,
    ) -> AstAssetComponent | None:
        """Apply charger preference for an asset.

        - ``None``: no-op (field omitted)
        - ``False``: dispose active CHARGER accessory (lifecycle; not physical delete)
        - ``True``: require code; install or update the active CHARGER component
        """
        if charger_available is None:
            return None

        if charger_available is False:
            self._release_active_chargers(ctx, asset.id)
            return None

        code = (charger_code or "").strip()
        if not code:
            raise RegistrationValidationError(
                "Charger Code is required when Charger Available is Yes"
            )
        if len(code) > 100:
            raise RegistrationValidationError("Charger Code exceeds maximum length")

        existing = self.find_active_charger(ctx, asset.id)
        # Edit Asset always re-sends charger fields. If type lookup misses (e.g. org-scope
        # edge) but this asset already owns the serial, treat it as the active charger
        # instead of failing company-wide uniqueness on install.
        if existing is None:
            by_serial = self._components.find_active_by_serial(
                ctx, company_id=asset.company_id, serial_number=code
            )
            if by_serial is not None:
                if by_serial.asset_id == asset.id:
                    existing = by_serial
                else:
                    raise RegistrationValidationError(
                        f"Charger code '{code}' is already used on another asset in this company"
                    )

        components = ComponentService(self._db)
        if existing is not None:
            current_code = (existing.component_code or "").strip()
            current_serial = (existing.serial_number or "").strip()
            # Edit re-sends whatever the form loaded (often auto component_code
            # CHARGER-NNNN while serial_number is the real charger id). Matching
            # either field is a no-op — rewriting serial to the auto code collides
            # company-wide with other assets that share CHARGER-0001 codes.
            if code == current_code or code == current_serial:
                return existing
            return components.update_charger_identity(ctx, existing.id, charger_code=code)

        return components.install(
            ctx,
            company_id=asset.company_id,
            asset_id=asset.id,
            branch_id=asset.branch_id,
            component_type=_CHARGER,
            component_code=code,
            serial_number=code,
            component_name="Charger",
        )

    def _release_active_chargers(self, ctx: TenantContext, asset_id: UUID) -> None:
        """Dispose active CHARGER rows so they no longer appear as active accessories."""
        active = self._components.list_active_by_type(
            ctx, asset_id=asset_id, component_type=_CHARGER
        )
        if not active:
            return
        components = ComponentService(self._db)
        for row in active:
            components.dispose(ctx, row.id)
