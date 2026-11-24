"""CRM document numbering."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.domain.enums import CODE_PREFIXES, CrmEntityType
from modules.crm.repository.code_sequence_repository import CodeSequenceRepository
from modules.platform.helpers.ssot_numbering import generate_with_ssot

# Legacy: DR-2026-12. New: XX-2026-12 from Cache legal entity initials.
_DEAL_REG_NUMBER_RE = re.compile(r"^[A-Z]{2}-\d{4}-\d+$")


def deal_reg_prefix_from_entity_name(entity_name: str | None) -> str:
    """Build a 2-letter DR prefix from the Cache legal entity name.

    Uses the first letter of the first two words when available
    (``Cache Digitech`` → ``CD``, ``Cache Technologies`` → ``CT``);
    otherwise the first two letters of the name. Falls back to ``DR``.
    """
    words = re.findall(r"[A-Za-z0-9]+", (entity_name or "").strip())
    if len(words) >= 2:
        return f"{words[0][0]}{words[1][0]}".upper()
    if len(words) == 1:
        letters = re.sub(r"[^A-Za-z]", "", words[0]).upper()
        if len(letters) >= 2:
            return letters[:2]
        if len(letters) == 1:
            return f"{letters}X"
    return "DR"


def is_deal_reg_number(code: str | None) -> bool:
    """True for legacy ``DR-YYYY-N`` and entity-prefix ``XX-YYYY-N`` deal numbers."""
    value = (code or "").strip().upper()
    if not value:
        return False
    return bool(_DEAL_REG_NUMBER_RE.match(value))


class DocumentNumberService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._seq = CodeSequenceRepository(db)

    def generate(
        self,
        entity: CrmEntityType,
        company_id: UUID,
        model,
        code_column: str,
        *,
        tenant_id: UUID | None = None,
    ) -> str:
        key = getattr(entity, "value", str(entity))
        prefix = f"{key.upper()[:4]}-"
        return generate_with_ssot(
            self._db,
            tenant_id=tenant_id,
            company_id=company_id,
            module="crm",
            entity_key=key,
            prefix=prefix,
            legacy=lambda: self._seq.next_code(entity, company_id, model, code_column),
        )

    def generate_for_deal(
        self,
        entity: CrmEntityType,
        company_id: UUID,
        model,
        code_column: str,
        *,
        deal_number: str | None,
        tag: str,
    ) -> str:
        """Quotes / OVFs carry the opportunity's DR number (DR-2026-12/Q1); legacy deals keep their series."""
        dr = (deal_number or "").strip()
        if not dr:
            return self.generate(entity, company_id, model, code_column)
        return self._seq.next_child_code(dr, tag, company_id, model, code_column)

    def next_deal_reg_number(
        self,
        company_id: UUID,
        *,
        entity_name: str | None = None,
    ) -> str:
        """Deal number shared by leads and opportunities: ``{ENTITY2}-{YYYY}-{N}``.

        ``ENTITY2`` is derived from the Cache legal entity name (see
        :func:`deal_reg_prefix_from_entity_name`). Legacy ``DR-YYYY-N`` numbers
        remain valid for existing records.
        """
        from modules.crm.models import CrmLead, CrmOpportunity

        _, width = CODE_PREFIXES[CrmEntityType.DEAL_REG]
        entity_prefix = deal_reg_prefix_from_entity_name(entity_name)
        year = datetime.now(timezone.utc).year
        full_prefix = f"{entity_prefix}-{year}-"

        existing: list[str] = []
        for model, column in (
            (CrmLead, CrmLead.dr_number),
            (CrmLead, CrmLead.lead_code),
            (CrmOpportunity, CrmOpportunity.deal_reg_number),
            (CrmOpportunity, CrmOpportunity.opportunity_code),
        ):
            existing.extend(
                str(code)
                for code in self._db.scalars(
                    select(column).where(
                        model.company_id == company_id,
                        column.is_not(None),
                        column.like(f"{full_prefix}%"),
                    )
                ).all()
                if code
            )
        seq = 1
        nums: list[int] = []
        for code in existing:
            try:
                nums.append(int(str(code).rsplit("-", 1)[-1]))
            except ValueError:
                continue
        if nums:
            seq = max(nums) + 1
        seq_part = f"{seq:0{width}d}" if width > 0 else str(seq)
        return f"{full_prefix}{seq_part}"
