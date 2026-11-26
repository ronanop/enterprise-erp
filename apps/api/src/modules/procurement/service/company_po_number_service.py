"""Entity-based company PO number sequences (PO/CDT/001, PO/CT/001, PO/CMT/001)."""

from uuid import UUID

from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session
from sqlalchemy.types import Integer

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
    tenant_id: UUID | None = None,
) -> str:
    """Return the next PO/{entity}/{NNN} for the entity series.

    Series is tenant-wide by entity code (not per company_id). Lexical MAX
    on padded strings fails past 999 and per-company scoping restarts the
    series when the same entity is used under another company row.
    ``company_id`` is retained for call-site compatibility.
    """
    _ = company_id
    code = normalize_entity_code(entity_code)
    prefix = f"PO/{code}/"
    # Numeric suffix after PO/{entity}/ (e.g. 092 from PO/CDT/092).
    suffix_num = cast(func.nullif(func.split_part(ProcOrderHeader.company_po_number, "/", 3), ""), Integer)
    filters = [
        ProcOrderHeader.is_deleted.is_(False),
        ProcOrderHeader.company_po_number.like(f"{prefix}%"),
    ]
    if tenant_id is not None:
        filters.append(ProcOrderHeader.tenant_id == tenant_id)
    stmt = select(func.max(suffix_num)).where(*filters)
    last = db.scalar(stmt)
    next_num = int(last or 0) + 1
    return f"{prefix}{str(next_num).zfill(_PAD)}"
