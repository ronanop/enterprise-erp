"""Incoming QC → Asset Registration Queue (Sub-phase 3).

Does not create assets on QC accept. Links accepted units to ast_asset via
registered_asset_id after AssetService.create. Bulk Excel validate/confirm
reuses Asset create → submit → approve → initialize_ready_to_move.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.asset.domain.enums import (
    IncomingAssetUnitQcStatus,
    IncomingRegistrationStatus,
)
from modules.asset.models.incoming_asset import AstIncomingAssetLine, AstIncomingAssetUnit
from modules.asset.repository.incoming_asset_repository import (
    IncomingAssetQcListFilters,
    IncomingAssetRepository,
    IncomingRegistrationQueueFilters,
    compute_line_registration_status,
)
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.asset_service import AssetService
from modules.asset.service.registration_validator import RegistrationValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY_UNIT = "ast_incoming_asset_unit"

TEMPLATE_HEADERS = [
    "incoming_unit_id",
    "asset_name",
    "serial_number",
    "branch_id",
    "asset_category_id",
    "asset_type",
    "purchase_date",
    "purchase_cost",
    "currency_code",
    "make",
    "model",
    "configuration",
    "location",
]

VALID_ASSET_TYPES = frozenset({"fixed", "consumable", "digital", "leased"})


@dataclass
class RegistrationQueueRow:
    unit: AstIncomingAssetUnit
    line: AstIncomingAssetLine
    registration_status: str
    line_registration_status: str


class IncomingRegistrationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = IncomingAssetRepository(db)
        self._scope = AssetScopeValidator(db)
        self._assets = AssetService(db)
        self._validator = RegistrationValidator(db)
        self._audit = AuditService(db)

    def _materialize_company_accepted(self, ctx: TenantContext, company_id: UUID) -> None:
        lines, _ = self._repo.search_qc(
            ctx,
            IncomingAssetQcListFilters(
                company_id=company_id,
                require_arrived=True,
            ),
            offset=0,
            limit=500,
        )
        for line in lines:
            if Decimal(str(line.accepted_quantity or 0)) > 0:
                self._repo.ensure_accepted_registration_units(ctx, line)

    def summary(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> dict[str, int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)
        self._materialize_company_accepted(ctx, cid)
        return self._repo.registration_summary(ctx, company_id=cid, branch_id=branch_id)

    def search_queue(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        grn_id: UUID | None = None,
        purchase_order_id: UUID | None = None,
        search: str | None = None,
        registration_status: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[RegistrationQueueRow], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)
        self._materialize_company_accepted(ctx, cid)

        pending_only = registration_status == IncomingRegistrationStatus.PENDING_REGISTRATION.value
        registered_only = registration_status == IncomingRegistrationStatus.REGISTERED.value
        # PARTIALLY_REGISTERED is line-level; for unit queue show all accepted for that filter
        filters = IncomingRegistrationQueueFilters(
            company_id=cid,
            branch_id=branch_id,
            grn_id=grn_id,
            purchase_order_id=purchase_order_id,
            search=search,
            registration_status=(
                None
                if registration_status == IncomingRegistrationStatus.PARTIALLY_REGISTERED.value
                else registration_status
            ),
            pending_only=pending_only,
            registered_only=registered_only,
        )
        units, total = self._repo.search_registration_queue(
            ctx, filters, offset=offset, limit=limit
        )
        rows: list[RegistrationQueueRow] = []
        for unit in units:
            line = unit.incoming_line
            if line is None:
                continue
            accepted_units = [
                u
                for u in (line.units or [])
                if not u.is_deleted
                and u.qc_status == IncomingAssetUnitQcStatus.ACCEPTED.value
            ]
            registered_n = sum(1 for u in accepted_units if u.registered_asset_id is not None)
            line_status = compute_line_registration_status(
                accepted=len(accepted_units), registered=registered_n
            )
            if (
                registration_status == IncomingRegistrationStatus.PARTIALLY_REGISTERED.value
                and line_status != IncomingRegistrationStatus.PARTIALLY_REGISTERED.value
            ):
                continue
            unit_status = (
                IncomingRegistrationStatus.REGISTERED.value
                if unit.registered_asset_id is not None
                else IncomingRegistrationStatus.PENDING_REGISTRATION.value
            )
            rows.append(
                RegistrationQueueRow(
                    unit=unit,
                    line=line,
                    registration_status=unit_status,
                    line_registration_status=line_status,
                )
            )
        return rows, total

    def assert_unit_registrable(
        self,
        ctx: TenantContext,
        unit: AstIncomingAssetUnit,
        *,
        expected_line_id: UUID | None = None,
    ) -> AstIncomingAssetLine:
        line = unit.incoming_line
        if line is None or line.is_deleted:
            raise NotFoundException("Incoming line not found for unit")
        if expected_line_id is not None and line.id != expected_line_id:
            raise ConflictException("incoming_unit_id does not belong to incoming_line_id")
        self._scope.validate_branch_access(ctx, line.branch_id)
        if unit.qc_status != IncomingAssetUnitQcStatus.ACCEPTED.value:
            raise ConflictException("Only QC ACCEPTED units can be registered")
        if unit.registered_asset_id is not None:
            raise ConflictException("Asset is already registered")
        return line

    def prefill_from_incoming(
        self,
        ctx: TenantContext,
        *,
        incoming_unit_id: UUID,
        incoming_line_id: UUID | None = None,
    ) -> dict:
        unit = self._repo.get_unit(ctx, incoming_unit_id)
        if unit is None:
            raise NotFoundException("Incoming unit not found")
        line = self.assert_unit_registrable(ctx, unit, expected_line_id=incoming_line_id)

        purchase_cost: Decimal | None = None
        currency_code = "INR"
        try:
            grn = self._assets._procurement.get_grn(ctx, line.grn_id)
            currency_code = getattr(grn, "currency_code", None) or currency_code
            for gl in grn.lines or []:
                if gl.id == line.grn_line_id and getattr(gl, "unit_price", None) is not None:
                    purchase_cost = Decimal(str(gl.unit_price))
                    break
        except Exception:
            pass

        return {
            "incoming_line_id": line.id,
            "incoming_unit_id": unit.id,
            "unit_index": unit.unit_index,
            "grn_id": line.grn_id,
            "grn_document_number": line.grn_document_number,
            "purchase_order_id": line.purchase_order_id,
            "po_document_number": line.po_document_number,
            "branch_id": line.branch_id,
            "product_id": line.product_id,
            "supplier_vendor_id": line.vendor_id,
            "quality_inspection_id": unit.quality_inspection_id or line.quality_inspection_id,
            "asset_name": line.product_name or line.product_code or "Incoming Asset",
            "serial_number": unit.serial_number,
            "purchase_date": line.document_date,
            "purchase_cost": purchase_cost,
            "currency_code": currency_code,
            "asset_category_id": None,
            "asset_type": "fixed",
            "qc_status": unit.qc_status,
            "registration_status": (
                IncomingRegistrationStatus.REGISTERED.value
                if unit.registered_asset_id
                else IncomingRegistrationStatus.PENDING_REGISTRATION.value
            ),
            "registered_asset_id": unit.registered_asset_id,
        }

    def link_unit_after_create(
        self,
        ctx: TenantContext,
        *,
        incoming_unit_id: UUID,
        asset_id: UUID,
    ) -> AstIncomingAssetUnit:
        unit = self._repo.get_unit_for_update(ctx, incoming_unit_id)
        if unit is None:
            raise NotFoundException("Incoming unit not found")
        self.assert_unit_registrable(ctx, unit)
        linked = self._repo.link_registered_asset(ctx, unit, asset_id)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_UNIT,
            entity_id=unit.id,
            operation="register",
            performed_by=ctx.user_id,
            new_value={
                "registered_asset_id": str(asset_id),
                "ast_asset_created": True,
            },
        )
        return linked

    def build_excel_template_csv(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> str:
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._materialize_company_accepted(ctx, cid)
        units, _ = self._repo.search_registration_queue(
            ctx,
            IncomingRegistrationQueueFilters(company_id=cid, branch_id=branch_id, pending_only=True),
            offset=0,
            limit=5000,
        )
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=TEMPLATE_HEADERS)
        writer.writeheader()
        for unit in units:
            line = unit.incoming_line
            if line is None:
                continue
            writer.writerow(
                {
                    "incoming_unit_id": str(unit.id),
                    "asset_name": line.product_name or "",
                    "serial_number": unit.serial_number or "",
                    "branch_id": str(line.branch_id),
                    "asset_category_id": "",
                    "asset_type": "fixed",
                    "purchase_date": line.document_date.isoformat() if line.document_date else "",
                    "purchase_cost": "",
                    "currency_code": "INR",
                    "make": "",
                    "model": "",
                    "configuration": "",
                    "location": "",
                }
            )
        return buf.getvalue()

    def validate_excel_rows(
        self,
        ctx: TenantContext,
        rows: list[dict],
        *,
        company_id: UUID | None = None,
    ) -> list[dict]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._materialize_company_accepted(ctx, cid)
        results: list[dict] = []
        seen_unit_ids: set[str] = set()
        seen_serials: set[str] = set()

        for idx, raw in enumerate(rows, start=1):
            row_errors: list[str] = []
            normalized = {str(k).strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in raw.items()}
            unit_id_raw = str(normalized.get("incoming_unit_id") or "").strip()
            asset_name = str(normalized.get("asset_name") or "").strip()
            serial = str(normalized.get("serial_number") or "").strip() or None
            branch_raw = str(normalized.get("branch_id") or "").strip()
            category_raw = str(normalized.get("asset_category_id") or "").strip()
            asset_type = str(normalized.get("asset_type") or "").strip().lower()
            purchase_date_raw = str(normalized.get("purchase_date") or "").strip()
            purchase_cost_raw = str(normalized.get("purchase_cost") or "").strip()
            currency_code = str(normalized.get("currency_code") or "INR").strip() or "INR"
            make = str(normalized.get("make") or "").strip() or None
            model = str(normalized.get("model") or "").strip() or None
            configuration = str(normalized.get("configuration") or "").strip() or None
            location = str(normalized.get("location") or "").strip() or None

            if not unit_id_raw:
                row_errors.append("incoming_unit_id is required")
            elif unit_id_raw in seen_unit_ids:
                row_errors.append("Duplicate Incoming Unit ID")
            else:
                seen_unit_ids.add(unit_id_raw)

            if serial:
                key = serial.lower()
                if key in seen_serials:
                    row_errors.append("Duplicate serial number in file")
                else:
                    seen_serials.add(key)

            if not asset_name:
                row_errors.append("asset_name is required")
            if not branch_raw:
                row_errors.append("branch_id is required")
            if not category_raw:
                row_errors.append("asset_category_id is required")
            if asset_type not in VALID_ASSET_TYPES:
                row_errors.append("asset_type must be fixed, consumable, digital, or leased")

            purchase_date: date | None = None
            if not purchase_date_raw:
                row_errors.append("purchase_date is required")
            else:
                try:
                    purchase_date = date.fromisoformat(purchase_date_raw[:10])
                except ValueError:
                    row_errors.append("purchase_date must be YYYY-MM-DD")

            purchase_cost: Decimal | None = None
            if purchase_cost_raw == "":
                row_errors.append("purchase_cost is required")
            else:
                try:
                    purchase_cost = Decimal(purchase_cost_raw)
                    if purchase_cost < 0:
                        row_errors.append("purchase_cost must be non-negative")
                except (InvalidOperation, ValueError):
                    row_errors.append("purchase_cost is invalid")

            unit: AstIncomingAssetUnit | None = None
            line: AstIncomingAssetLine | None = None
            try:
                unit_uuid = UUID(unit_id_raw) if unit_id_raw else None
            except ValueError:
                unit_uuid = None
                row_errors.append("incoming_unit_id is not a valid UUID")

            if unit_uuid is not None:
                unit = self._repo.get_unit(ctx, unit_uuid)
                if unit is None:
                    row_errors.append("Incoming Unit does not exist")
                else:
                    try:
                        line = self.assert_unit_registrable(ctx, unit)
                        if serial and unit.serial_number and serial != unit.serial_number:
                            row_errors.append("Serial mismatch")
                        if (
                            serial
                            and not unit.serial_number
                        ):
                            pass  # allow setting serial at registration
                        if branch_raw:
                            try:
                                if UUID(branch_raw) != line.branch_id:
                                    row_errors.append("branch_id does not match incoming unit branch")
                            except ValueError:
                                row_errors.append("branch_id is not a valid UUID")
                    except ConflictException as exc:
                        row_errors.append(str(exc.message) if hasattr(exc, "message") else str(exc))
                    except NotFoundException as exc:
                        row_errors.append(str(exc.message) if hasattr(exc, "message") else str(exc))

            if not row_errors and line is not None:
                try:
                    branch_id = UUID(branch_raw)
                    category_id = UUID(category_raw)
                    self._validator.validate_create_fields(
                        ctx,
                        company_id=cid,
                        branch_id=branch_id,
                        fields={
                            "branch_id": branch_id,
                            "asset_name": asset_name,
                            "asset_category_id": category_id,
                            "asset_type": asset_type,
                            "purchase_date": purchase_date,
                            "purchase_cost": purchase_cost,
                            "currency_code": currency_code,
                            "serial_number": serial,
                            "grn_id": line.grn_id,
                            "purchase_order_id": line.purchase_order_id,
                            "product_id": line.product_id,
                            "supplier_vendor_id": line.vendor_id,
                            "quality_inspection_id": unit.quality_inspection_id
                            or line.quality_inspection_id
                            if unit
                            else None,
                        },
                    )
                except Exception as exc:
                    row_errors.append(str(getattr(exc, "message", None) or exc))

            status = "valid" if not row_errors else "error"
            results.append(
                {
                    "row_number": idx,
                    "status": status,
                    "errors": row_errors,
                    "incoming_unit_id": unit_id_raw or None,
                    "asset_name": asset_name or None,
                    "serial_number": serial,
                    "branch_id": branch_raw or None,
                    "asset_category_id": category_raw or None,
                    "asset_type": asset_type or None,
                    "purchase_date": purchase_date.isoformat() if purchase_date else purchase_date_raw or None,
                    "purchase_cost": str(purchase_cost) if purchase_cost is not None else purchase_cost_raw or None,
                    "currency_code": currency_code,
                    "make": make,
                    "model": model,
                    "configuration": configuration,
                    "location": location,
                    "grn_document_number": line.grn_document_number if line else None,
                    "po_document_number": line.po_document_number if line else None,
                    "qc_status": unit.qc_status if unit else None,
                }
            )
        return results

    def confirm_excel_rows(
        self,
        ctx: TenantContext,
        rows: list[dict],
        *,
        company_id: UUID | None = None,
        activate: bool = True,
    ) -> dict:
        """Revalidate and create+link all valid rows in one flush; then activate per asset."""
        validated = self.validate_excel_rows(ctx, rows, company_id=company_id)
        valid_rows = [r for r in validated if r["status"] == "valid"]
        if not valid_rows:
            raise ConflictException("No valid assets can be registered from this file")

        created: list[dict] = []
        # Create + link all first (same request UoW / commit)
        for row in valid_rows:
            unit_id = UUID(row["incoming_unit_id"])
            unit = self._repo.get_unit_for_update(ctx, unit_id)
            if unit is None:
                raise ConflictException(f"Incoming unit disappeared: {unit_id}")
            line = self.assert_unit_registrable(ctx, unit)
            if (
                row.get("serial_number")
                and unit.serial_number
                and row["serial_number"] != unit.serial_number
            ):
                raise ConflictException("Serial mismatch")

            asset = self._assets.create(
                ctx,
                branch_id=UUID(row["branch_id"]),
                company_id=company_id,
                asset_name=row["asset_name"],
                asset_category_id=UUID(row["asset_category_id"]),
                asset_type=row["asset_type"],
                purchase_date=date.fromisoformat(str(row["purchase_date"])[:10]),
                purchase_cost=Decimal(str(row["purchase_cost"])),
                currency_code=row.get("currency_code") or "INR",
                serial_number=row.get("serial_number") or None,
                make=row.get("make") or None,
                model=row.get("model") or None,
                configuration=row.get("configuration") or None,
                location_label=row.get("location") or None,
                grn_id=line.grn_id,
                purchase_order_id=line.purchase_order_id,
                product_id=line.product_id,
                supplier_vendor_id=line.vendor_id,
                quality_inspection_id=unit.quality_inspection_id or line.quality_inspection_id,
                incoming_unit_id=unit.id,
            )
            created.append(
                {
                    "row_number": row["row_number"],
                    "incoming_unit_id": str(unit.id),
                    "asset_id": str(asset.id),
                    "asset_code": asset.asset_code,
                    "created": True,
                    "activation": "pending",
                    "activation_error": None,
                    "operational_status": asset.operational_status,
                }
            )

        if activate:
            for item in created:
                asset_id = UUID(item["asset_id"])
                try:
                    self._assets.submit(ctx, asset_id)
                    approved = self._assets.approve(ctx, asset_id)
                    item["activation"] = "complete"
                    item["operational_status"] = getattr(approved, "operational_status", None)
                except Exception as exc:
                    item["activation"] = "incomplete"
                    item["activation_error"] = str(getattr(exc, "message", None) or exc)

        complete = sum(1 for i in created if i["activation"] == "complete")
        incomplete = sum(1 for i in created if i["activation"] == "incomplete")
        return {
            "registered_count": len(created),
            "activation_complete": complete,
            "activation_incomplete": incomplete,
            "items": created,
            "validation": validated,
        }
