"""Assignment issuance / enrichment field rules (CR-004 Phase 5A-2)."""

from __future__ import annotations

import re

from modules.asset.domain.enums import (
    ASSIGNMENT_DELIVERY_REFERENCE_STATUS_VALUES,
    AssignmentDeliveryReferenceStatus,
)
from modules.asset.domain.exceptions import AssignmentValidationError

DELIVERY_REFERENCE_NUMBER_MAX_LENGTH = 100
ASSIGNMENT_REMARKS_MAX_LENGTH = 4000
RETURN_REMARKS_MAX_LENGTH = 4000

_CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

_STATUSES_REQUIRING_NUMBER = frozenset(
    {
        AssignmentDeliveryReferenceStatus.ISSUED.value,
        AssignmentDeliveryReferenceStatus.RECEIVED.value,
    }
)


def normalize_delivery_reference_status(status: str | None) -> str:
    if status is None or not str(status).strip():
        return AssignmentDeliveryReferenceStatus.NOT_APPLICABLE.value
    return str(status).strip().lower()


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def validate_delivery_reference_status(status: str | None) -> str:
    normalized = normalize_delivery_reference_status(status)
    if normalized not in ASSIGNMENT_DELIVERY_REFERENCE_STATUS_VALUES:
        allowed = ", ".join(sorted(ASSIGNMENT_DELIVERY_REFERENCE_STATUS_VALUES))
        raise AssignmentValidationError(
            f"delivery_reference_status must be one of: {allowed}"
        )
    return normalized


def validate_delivery_reference_number(number: str | None) -> str | None:
    normalized = normalize_optional_text(number)
    if normalized is None:
        return None
    if len(normalized) > DELIVERY_REFERENCE_NUMBER_MAX_LENGTH:
        raise AssignmentValidationError(
            f"delivery_reference_number must be at most {DELIVERY_REFERENCE_NUMBER_MAX_LENGTH} characters"
        )
    if _CONTROL_CHAR_PATTERN.search(normalized):
        raise AssignmentValidationError("delivery_reference_number contains invalid characters")
    return normalized


def validate_delivery_reference_pair(
    *,
    number: str | None,
    status: str | None,
) -> tuple[str | None, str]:
    ref_status = validate_delivery_reference_status(status)
    ref_number = validate_delivery_reference_number(number)

    if ref_status == AssignmentDeliveryReferenceStatus.NOT_APPLICABLE.value:
        if ref_number is not None:
            raise AssignmentValidationError(
                "delivery_reference_number must be empty when delivery_reference_status is not_applicable"
            )
        return None, ref_status

    if ref_status in _STATUSES_REQUIRING_NUMBER and ref_number is None:
        raise AssignmentValidationError(
            "delivery_reference_number is required when delivery_reference_status is "
            f"{ref_status}"
        )

    if ref_number is None and ref_status == AssignmentDeliveryReferenceStatus.PENDING.value:
        return None, ref_status

    return ref_number, ref_status


def validate_assignment_remarks(remarks: str | None) -> str | None:
    return _validate_remarks_field(remarks, field_name="assignment_remarks")


def validate_return_remarks(remarks: str | None) -> str | None:
    return _validate_remarks_field(remarks, field_name="return_remarks")


def _validate_remarks_field(remarks: str | None, *, field_name: str) -> str | None:
    normalized = normalize_optional_text(remarks)
    if normalized is None:
        return None
    max_len = (
        RETURN_REMARKS_MAX_LENGTH
        if field_name == "return_remarks"
        else ASSIGNMENT_REMARKS_MAX_LENGTH
    )
    if len(normalized) > max_len:
        raise AssignmentValidationError(f"{field_name} must be at most {max_len} characters")
    if _CONTROL_CHAR_PATTERN.search(normalized):
        raise AssignmentValidationError(f"{field_name} contains invalid characters")
    return normalized


def validate_draft_enrichment_fields(
    *,
    delivery_reference_number: str | None = None,
    delivery_reference_status: str | None = None,
    assignment_remarks: str | None = None,
    return_remarks: str | None = None,
    allow_return_remarks: bool = False,
) -> dict[str, str | None]:
    if return_remarks is not None and not allow_return_remarks:
        raise AssignmentValidationError(
            "return_remarks can only be set when returning an assignment"
        )
    ref_number, ref_status = validate_delivery_reference_pair(
        number=delivery_reference_number,
        status=delivery_reference_status,
    )
    return {
        "delivery_reference_number": ref_number,
        "delivery_reference_status": ref_status,
        "assignment_remarks": validate_assignment_remarks(assignment_remarks),
        "return_remarks": validate_return_remarks(return_remarks) if allow_return_remarks else None,
    }


def validate_employee_issue_enrichment(
    *,
    delivery_reference_status: str,
) -> None:
    """Employee issue (Excel parity): delivery reference cannot be not_applicable at submit/activate."""
    if delivery_reference_status == AssignmentDeliveryReferenceStatus.NOT_APPLICABLE.value:
        raise AssignmentValidationError(
            "delivery_reference_status is required for employee assignments (use pending, issued, or received)"
        )
