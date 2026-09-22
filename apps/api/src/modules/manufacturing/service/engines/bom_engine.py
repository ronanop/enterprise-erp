"""BOM engine - activation rules and explosion."""

from decimal import Decimal

from modules.manufacturing.domain.entities import BomComponentRequirement
from modules.manufacturing.domain.enums import BomStatus, LineStatus
from modules.manufacturing.domain.exceptions import ActiveBomExists, InvalidBomState
from modules.manufacturing.models.bom import MfgBom


class BomEngine:
    def validate_activatable(self, bom: MfgBom) -> None:
        if bom.status != BomStatus.DRAFT.value:
            raise InvalidBomState("Only draft BOMs can be activated")
        active = [ln for ln in bom.lines if not ln.is_deleted and ln.status == LineStatus.ACTIVE.value]
        if not active:
            raise InvalidBomState("BOM must have at least one active component line")

    def ensure_no_active_conflict(self, existing_active: MfgBom | None) -> None:
        if existing_active is not None:
            raise ActiveBomExists()

    def explode(self, bom: MfgBom, planned_qty: Decimal) -> list[BomComponentRequirement]:
        if planned_qty <= 0:
            raise InvalidBomState("Planned quantity must be positive")
        if bom.status not in {BomStatus.ACTIVE.value, BomStatus.DRAFT.value}:
            raise InvalidBomState("Cannot explode obsolete BOM")
        reqs: list[BomComponentRequirement] = []
        for ln in bom.lines:
            if ln.is_deleted or ln.status != LineStatus.ACTIVE.value:
                continue
            per_unit = Decimal(str(ln.quantity))
            scrap = Decimal(str(ln.scrap_percent or 0))
            qty = (per_unit * planned_qty).quantize(Decimal("0.0001"))
            reqs.append(
                BomComponentRequirement(
                    component_product_id=ln.component_product_id,
                    quantity=qty,
                    uom_id=ln.uom_id,
                    scrap_percent=scrap,
                    bom_line_id=ln.id,
                    alternate_product_id=ln.alternate_product_id,
                    is_optional=bool(ln.is_optional),
                )
            )
        if not reqs:
            raise InvalidBomState("BOM explosion produced no components")
        return reqs
