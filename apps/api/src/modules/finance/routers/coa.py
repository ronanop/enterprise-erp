"""Finance COA routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from modules.finance.dependencies import PaginationParams, extract_update_fields, get_pagination, paginate
from modules.finance.schemas import (
    AccountGroupCreateRequest,
    AccountGroupResponse,
    AccountRelatedJournalResponse,
    ChartOfAccountBalanceResponse,
    ChartOfAccountCreateRequest,
    ChartOfAccountImportRequest,
    ChartOfAccountImportResult,
    ChartOfAccountListResponse,
    ChartOfAccountMergeRequest,
    ChartOfAccountResponse,
    ChartOfAccountSummaryResponse,
    ChartOfAccountUpdateRequest,
    WorkflowActionRequest,
)
from modules.finance.service.chart_of_account_service import ChartOfAccountService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

account_groups_router = APIRouter(prefix="/account-groups", tags=["Finance - Account Groups"])
chart_of_accounts_router = APIRouter(prefix="/chart-of-accounts", tags=["Finance - COA"])


@account_groups_router.get("", response_model=APIResponse[list[AccountGroupResponse]])
def list_account_groups(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list[AccountGroupResponse]]:
    groups = ChartOfAccountService(db).list_account_groups(ctx, company_id)
    return APIResponse(message="Account groups retrieved", data=[AccountGroupResponse.model_validate(g) for g in groups])


@account_groups_router.post("", response_model=APIResponse[AccountGroupResponse])
def create_account_group(
    body: AccountGroupCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:create"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[AccountGroupResponse]:
    group = ChartOfAccountService(db).create_account_group(ctx, company_id, **body.model_dump())
    db.commit()
    return APIResponse(message="Account group created", data=AccountGroupResponse.model_validate(group))


@chart_of_accounts_router.get("/summary", response_model=APIResponse[ChartOfAccountSummaryResponse])
def account_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[ChartOfAccountSummaryResponse]:
    summary = ChartOfAccountService(db).summary(ctx, company_id)
    return APIResponse(message="COA summary retrieved", data=summary)


@chart_of_accounts_router.get("")
def list_accounts(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    status: Annotated[str | None, Query()] = None,
    account_type: Annotated[str | None, Query()] = None,
    account_group_id: UUID | None = None,
    parent_account_id: UUID | None = None,
    is_posting_account: bool | None = None,
    q: Annotated[str | None, Query()] = None,
    sort_by: Annotated[str, Query()] = "account_code",
    sort_dir: Annotated[str, Query()] = "asc",
    tree: Annotated[bool, Query()] = False,
    paged: Annotated[bool, Query()] = False,
) -> APIResponse[ChartOfAccountListResponse | list[ChartOfAccountResponse]]:
    """Default list shape stays an array so Journal account lookups remain unchanged."""
    # When tree=true, return a large page so hierarchy clients get the full chart.
    page_size = max(pagination.page_size, 500) if tree else pagination.page_size
    page_num = 1 if tree else pagination.page
    accounts = ChartOfAccountService(db).list_accounts(
        ctx,
        company_id,
        status=status,
        account_type=account_type,
        account_group_id=account_group_id,
        parent_account_id=parent_account_id,
        is_posting_account=is_posting_account,
        search=q,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    effective = PaginationParams(page=page_num, page_size=page_size)
    page = paginate(accounts, effective)
    if paged or tree:
        return APIResponse(
            message="Chart of accounts retrieved",
            data=ChartOfAccountListResponse(
                items=page,
                total=len(accounts),
                page=page_num,
                page_size=page_size,
            ),
        )
    return APIResponse(message="Chart of accounts retrieved", data=page)


@chart_of_accounts_router.post("", response_model=APIResponse[ChartOfAccountResponse])
def create_account(
    body: ChartOfAccountCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:create"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[ChartOfAccountResponse]:
    account = ChartOfAccountService(db).create_account(ctx, company_id, **body.model_dump())
    db.commit()
    return APIResponse(message="Account created", data=account)


@chart_of_accounts_router.post("/import", response_model=APIResponse[ChartOfAccountImportResult])
def import_accounts(
    body: ChartOfAccountImportRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:create"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[ChartOfAccountImportResult]:
    result = ChartOfAccountService(db).import_accounts(ctx, company_id, body.rows)
    db.commit()
    return APIResponse(message="Import completed", data=result)


@chart_of_accounts_router.post("/merge", response_model=APIResponse[dict])
def merge_accounts(
    body: ChartOfAccountMergeRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    ChartOfAccountService(db).merge_accounts(
        ctx, body.source_account_id, body.target_account_id, body.comments
    )
    db.commit()
    return APIResponse(message="Merge completed", data={})


@chart_of_accounts_router.get("/{account_id}", response_model=APIResponse[ChartOfAccountResponse])
def get_account(
    account_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ChartOfAccountResponse]:
    account = ChartOfAccountService(db).get_account(ctx, account_id)
    return APIResponse(message="Account retrieved", data=account)


@chart_of_accounts_router.patch("/{account_id}", response_model=APIResponse[ChartOfAccountResponse])
def update_account(
    account_id: UUID,
    body: ChartOfAccountUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ChartOfAccountResponse]:
    account = ChartOfAccountService(db).update_account(ctx, account_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Account updated", data=account)


@chart_of_accounts_router.delete("/{account_id}", response_model=APIResponse[dict])
def delete_account(
    account_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:delete"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    ChartOfAccountService(db).delete_account(ctx, account_id)
    db.commit()
    return APIResponse(message="Account deleted", data={})


@chart_of_accounts_router.get(
    "/{account_id}/children", response_model=APIResponse[list[ChartOfAccountResponse]]
)
def list_children(
    account_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ChartOfAccountResponse]]:
    children = ChartOfAccountService(db).list_children(ctx, account_id)
    return APIResponse(message="Child accounts retrieved", data=children)


@chart_of_accounts_router.get(
    "/{account_id}/balance", response_model=APIResponse[ChartOfAccountBalanceResponse]
)
def account_balance(
    account_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ChartOfAccountBalanceResponse]:
    balance = ChartOfAccountService(db).balance(ctx, account_id)
    return APIResponse(message="Account balance retrieved", data=balance)


@chart_of_accounts_router.get(
    "/{account_id}/journals", response_model=APIResponse[list[AccountRelatedJournalResponse]]
)
def related_journals(
    account_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[AccountRelatedJournalResponse]]:
    journals = ChartOfAccountService(db).related_journals(ctx, account_id)
    return APIResponse(message="Related journals retrieved", data=journals)


@chart_of_accounts_router.post("/{account_id}/submit", response_model=APIResponse[ChartOfAccountResponse])
def submit_account(
    account_id: UUID,
    body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ChartOfAccountResponse]:
    account = ChartOfAccountService(db).submit(ctx, account_id, body.comments)
    db.commit()
    return APIResponse(message="Account submitted", data=account)


@chart_of_accounts_router.post("/{account_id}/approve", response_model=APIResponse[ChartOfAccountResponse])
def approve_account(
    account_id: UUID,
    body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ChartOfAccountResponse]:
    account = ChartOfAccountService(db).approve(ctx, account_id, body.comments)
    db.commit()
    return APIResponse(message="Account approved", data=account)


@chart_of_accounts_router.post("/{account_id}/reject", response_model=APIResponse[ChartOfAccountResponse])
def reject_account(
    account_id: UUID,
    body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ChartOfAccountResponse]:
    account = ChartOfAccountService(db).reject(ctx, account_id, body.comments)
    db.commit()
    return APIResponse(message="Account rejected", data=account)


@chart_of_accounts_router.post("/{account_id}/activate", response_model=APIResponse[ChartOfAccountResponse])
def activate_account(
    account_id: UUID,
    body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ChartOfAccountResponse]:
    account = ChartOfAccountService(db).activate(ctx, account_id, body.comments)
    db.commit()
    return APIResponse(message="Account activated", data=account)


@chart_of_accounts_router.post("/{account_id}/deactivate", response_model=APIResponse[ChartOfAccountResponse])
def deactivate_account(
    account_id: UUID,
    body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.coa:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ChartOfAccountResponse]:
    account = ChartOfAccountService(db).deactivate(ctx, account_id, body.comments)
    db.commit()
    return APIResponse(message="Account deactivated", data=account)
