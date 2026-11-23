"""IFinancePosting stub — standalone HRMS has no GL."""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.platform.dto import PostingResult, SystemJournalDraft


class FinancePostingAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def post_system_journal(
        self,
        ctx: TenantContext,
        draft: SystemJournalDraft,
    ) -> PostingResult:
        _ = (ctx, draft, self._db)
        return PostingResult(
            journal_id=uuid4(),
            gl_entry_count=0,
            already_posted=False,
        )
