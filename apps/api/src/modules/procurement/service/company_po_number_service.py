"""Entity-based company PO number sequences (PO/CDT/001, PO/CT/001, PO/CMT/001)."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.procurement.models.order import ProcOrderHeader

VALID_ENTITY_CODES = frozenset({"CDT", "CT", "CMT"})
_PAD = 3


def normalize_entity_code(entity_code: str | None) -> str:
    code = (entity_code or "").strip().upper()
    if code not in VALID_ENTITY_CODES:
        raise ConflictException(
            f"entity_code must be one of: {', '.join(sorted(VALID_ENTITY_CODES))}"
        )
    return code


def peek_next_company_po_number(
    db: Session,
    *,
    company_id: UUID,
    entity_code: str,
) -> str:
    code = normalize_entity_code(entity_code)
    prefix = f"PO/{code}/"
    stmt = select(func.max(ProcOrderHeader.company_po_number)).where(
        ProcOrderHeader.company_id == company_id,
        ProcOrderHeader.is_deleted.is_(False),
        ProcOrderHeader.company_po_number.like(f"{prefix}%"),
    )
    last = db.scalar(stmt)
    if last is None:
        next_num = 1
    else:
        numeric = str(last).removeprefix(prefix)
        try:
            next_num = int(numeric) + 1
        except ValueError:
            next_num = 1
    return f"{prefix}{str(next_num).zfill(_PAD)}"
