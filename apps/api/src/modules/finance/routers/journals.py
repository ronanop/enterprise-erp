"""Journal routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from modules.finance.dependencies import PaginationParams, extract_update_fields, get_pagination, paginate
from modules.finance.schemas import (
    GlEntryResponse,
    JournalCommentRequest,
    JournalCreateRequest,
    JournalLineCreateRequest,
    JournalLineResponse,
    JournalLinesReorderRequest,
    JournalLineUpdateRequest,
    JournalListResponse,
    JournalResponse,
    JournalUpdateRequest,
    WorkflowActionRequest,
)
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

journals_router = APIRouter(prefix="/journals", tags=["Finance - Journals"])


@journals_router.get("", response_model=APIResponse[JournalListResponse])
def list_journals(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    status: Annotated[str | None, Query()] = None,
    journal_type: Annotated[str | None, Query(alias="journal_type")] = None,
    period_id: UUID | None = None,
    q: Annotated[str | None, Query()] = None,
    sort_by: Annotated[str, Query()] = "journal_date",
    sort_dir: Annotated[str, Query()] = "desc",
) -> APIResponse[JournalListResponse]:
    journals = JournalService(db).list_journals(
        ctx,
        company_id,
        status=status,
        journal_type=journal_type,
        period_id=period_id,
        search=q,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    page = paginate(journals, pagination)
    return APIResponse(
        message="Journals retrieved",
        data=JournalListResponse(
            items=[JournalResponse.model_validate(j) for j in page],
            total=len(journals),
            page=pagination.page,
            page_size=pagination.page_size,
        ),
    )


@journals_router.post("", response_model=APIResponse[JournalResponse])
def create_journal(
    body: JournalCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[JournalResponse]:
    journal = JournalService(db).create_journal(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Journal created", data=JournalResponse.model_validate(journal))


@journals_router.get("/{journal_id}", response_model=APIResponse[JournalResponse])
def get_journal(
    journal_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[JournalResponse]:
    journal = JournalService(db).get_journal(ctx, journal_id)
    payload = JournalResponse.model_validate(journal)
    active_lines = sorted(
        [ln for ln in journal.lines if not ln.is_deleted],
        key=lambda ln: ln.line_number,
    )
    payload.lines = [JournalLineResponse.model_validate(ln) for ln in active_lines]
    return APIResponse(message="Journal retrieved", data=payload)


@journals_router.patch("/{journal_id}", response_model=APIResponse[JournalResponse])
def update_journal(
    journal_id: UUID,
    body: JournalUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[JournalResponse]:
    journal = JournalService(db).update_journal(ctx, journal_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Journal updated", data=JournalResponse.model_validate(journal))


@journals_router.post("/{journal_id}/lines", response_model=APIResponse[JournalLineResponse])
def add_journal_line(
    journal_id: UUID,
    body: JournalLineCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[JournalLineResponse]:
    line = JournalService(db).add_line(ctx, journal_id, **body.model_dump())
    db.commit()
    return APIResponse(message="Journal line added", data=JournalLineResponse.model_validate(line))


@journals_router.patch(
    "/{journal_id}/lines/{line_id}",
    response_model=APIResponse[JournalLineResponse],
)
def update_journal_line(
    journal_id: UUID,
    line_id: UUID,
    body: JournalLineUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[JournalLineResponse]:
    line = JournalService(db).update_line(
        ctx, journal_id, line_id, **extract_update_fields(body)
    )
    db.commit()
    return APIResponse(message="Journal line updated", data=JournalLineResponse.model_validate(line))


@journals_router.delete("/{journal_id}/lines/{line_id}", response_model=APIResponse[dict])
def delete_journal_line(
    journal_id: UUID,
    line_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    JournalService(db).delete_line(ctx, journal_id, line_id)
    db.commit()
    return APIResponse(message="Journal line deleted", data={"id": str(line_id)})


@journals_router.post(
    "/{journal_id}/lines/reorder",
    response_model=APIResponse[JournalResponse],
)
def reorder_journal_lines(
    journal_id: UUID,
    body: JournalLinesReorderRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[JournalResponse]:
    journal = JournalService(db).reorder_lines(ctx, journal_id, body.line_ids)
    db.commit()
    return APIResponse(message="Journal lines reordered", data=JournalResponse.model_validate(journal))


@journals_router.post("/{journal_id}/comments", response_model=APIResponse[dict])
def add_journal_comment(
    journal_id: UUID,
    body: JournalCommentRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    result = JournalService(db).add_comment(ctx, journal_id, body.comment)
    db.commit()
    return APIResponse(message="Comment recorded", data=result)


@journals_router.post("/{journal_id}/submit", response_model=APIResponse[dict])
def submit_journal(
    journal_id: UUID,
    _body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:submit"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    instance = JournalService(db).submit(ctx, journal_id)
    db.commit()
    return APIResponse(message="Journal submitted", data={"workflow_instance_id": str(instance.id)})


@journals_router.post("/{journal_id}/approve", response_model=APIResponse[dict])
def approve_journal(
    journal_id: UUID,
    _body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:approve"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    instance = JournalService(db).approve(ctx, journal_id)
    db.commit()
    return APIResponse(message="Journal approved", data={"status": instance.status})


@journals_router.post("/{journal_id}/reject", response_model=APIResponse[dict])
def reject_journal(
    journal_id: UUID,
    _body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:approve"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    instance = JournalService(db).reject(ctx, journal_id)
    db.commit()
    return APIResponse(message="Journal rejected", data={"status": instance.status})


@journals_router.post("/{journal_id}/post", response_model=APIResponse[list[GlEntryResponse]])
def post_journal(
    journal_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:post"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[GlEntryResponse]]:
    entries = PostingService(db).post_journal(ctx, journal_id)
    db.commit()
    return APIResponse(
        message="Journal posted",
        data=[GlEntryResponse.model_validate(e) for e in entries],
    )


@journals_router.post("/{journal_id}/reverse", response_model=APIResponse[JournalResponse])
def reverse_journal(
    journal_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.journal:reverse"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[JournalResponse]:
    reversal = JournalService(db).reverse(ctx, journal_id)
    db.commit()
    return APIResponse(message="Reversal journal created", data=JournalResponse.model_validate(reversal))
