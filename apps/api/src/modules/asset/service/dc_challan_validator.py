"""DC challan validation (employee-only paperwork this phase)."""

from __future__ import annotations

from urllib.parse import urlparse
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetOperationalStatus, DcChallanStatus
from modules.asset.domain.exceptions import DcChallanValidationError, InvalidDcChallanState
from modules.asset.models.dc_challan import AstDcChallan
from modules.asset.repository.asset_assignment_repository import AssetAssignmentRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext

CREATE_ELIGIBLE_OPS = frozenset(
    {
        AssetOperationalStatus.READY_TO_MOVE.value,
        AssetOperationalStatus.ASSIGNED.value,
    }
)

EMPLOYEE_ALLOCATION = "employee"
MANUAL_ENTRY = "MANUAL_ENTRY"


def _text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def is_manual_entry_challan(row) -> bool:
    """Manual-entry sourced challans snapshot deployed_to and leave employee_id null."""
    if _text(getattr(row, "deployed_to", None)):
        return True
    source = _text(getattr(row, "employee_source", None))
    return source == MANUAL_ENTRY


def employee_snapshots_ready(row) -> bool:
    """Send-to-SCM gate. MASTER_DATA: code + name + email. MANUAL_ENTRY: name + phone."""
    name = _text(getattr(row, "employee_name", None))
    if is_manual_entry_challan(row):
        return bool(name and _text(getattr(row, "employee_phone", None)))
    return bool(
        _text(getattr(row, "employee_code", None))
        and name
        and _text(getattr(row, "employee_email", None))
    )


def employee_phone_missing(row) -> bool:
    return not _text(getattr(row, "employee_phone", None))


def employee_email_missing(row) -> bool:
    return not _text(getattr(row, "employee_email", None))


def send_to_scm_snapshot_error(row) -> str:
    if is_manual_entry_challan(row):
        return "Employee name and phone are required before sending to SCM"
    return "Employee code, name, and email are required before sending to SCM"


def validate_dc_document_url(url: str | None) -> str:
    if url is None or not str(url).strip():
        raise DcChallanValidationError("Document URL is required")
    value = str(url).strip()
    if any(ch.isspace() for ch in value):
        raise DcChallanValidationError("Document URL must not contain whitespace")
    if len(value) > 500:
        raise DcChallanValidationError("Document URL exceeds maximum length")
    parsed = urlparse(value)
    scheme = (parsed.scheme or "").lower()
    if scheme not in {"http", "https"} or not parsed.netloc:
        raise DcChallanValidationError("Document URL must be an http(s) URL with a host")
    return value


def format_employee_name(employee) -> str:
    first = str(getattr(employee, "first_name", None) or "").strip()
    last = str(getattr(employee, "last_name", None) or "").strip()
    return f"{first} {last}".strip()


class DcChallanValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._assignments = AssetAssignmentRepository(db)

    def require_asset(self, ctx: TenantContext, asset_id: UUID):
        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        return asset

    def require_assignment(self, ctx: TenantContext, assignment_id: UUID):
        assignment = self._assignments.get(ctx, assignment_id)
        if assignment is None:
            raise NotFoundException("Assignment not found")
        return assignment

    def validate_create_eligibility(self, asset) -> None:
        ops = getattr(asset, "operational_status", None)
        if ops not in CREATE_ELIGIBLE_OPS:
            raise DcChallanValidationError(
                "DC challan can only be created for assets that are Ready to Move or Assigned"
            )

    def validate_employee_assignment(self, assignment) -> None:
        if getattr(assignment, "allocation_type", None) != EMPLOYEE_ALLOCATION:
            raise DcChallanValidationError(
                "DC challan can only be linked to employee allocations in this phase"
            )
        source = _text(getattr(assignment, "employee_source", None)) or "MASTER_DATA"
        if source == MANUAL_ENTRY:
            if not (
                _text(getattr(assignment, "manual_employee_name", None))
                and _text(getattr(assignment, "manual_employee_phone", None))
                and _text(getattr(assignment, "manual_employee_deployed_to", None))
            ):
                raise DcChallanValidationError(
                    "Manual employee name, phone, and deployed-to are required for this assignment"
                )
            return
        if getattr(assignment, "employee_id", None) is None:
            raise DcChallanValidationError("Employee assignment is missing employee_id")

    def validate_pending(self, row: AstDcChallan) -> None:
        if row.status != DcChallanStatus.PENDING.value:
            raise InvalidDcChallanState("Only PENDING DC challans can be updated")

    def validate_transition(self, row: AstDcChallan, target: str) -> None:
        current = row.status
        allowed: dict[str, frozenset[str]] = {
            DcChallanStatus.PENDING.value: frozenset(
                {DcChallanStatus.SENT_TO_SCM.value, DcChallanStatus.CANCELLED.value}
            ),
            DcChallanStatus.SENT_TO_SCM.value: frozenset(
                {DcChallanStatus.DOCUMENT_RECEIVED.value, DcChallanStatus.CANCELLED.value}
            ),
            DcChallanStatus.DOCUMENT_RECEIVED.value: frozenset(
                {DcChallanStatus.SIGNED.value, DcChallanStatus.CANCELLED.value}
            ),
            DcChallanStatus.SIGNED.value: frozenset(
                {DcChallanStatus.RECEIVED.value, DcChallanStatus.CANCELLED.value}
            ),
            DcChallanStatus.RECEIVED.value: frozenset(),
            DcChallanStatus.CANCELLED.value: frozenset(),
        }
        if target not in allowed.get(current, frozenset()):
            raise InvalidDcChallanState(
                f"Cannot change DC challan from {current} to {target}"
            )
