"""Chart of accounts service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.finance.repository.coa_repository import COARepository
from modules.finance.schemas import (
    AccountRelatedJournalResponse,
    ChartOfAccountBalanceResponse,
    ChartOfAccountImportResult,
    ChartOfAccountResponse,
    ChartOfAccountSummaryResponse,
)
from modules.finance.service.finance_scope_validator import FinanceScopeValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

_EDITABLE_STATUSES = {"draft", "inactive"}
_ACCOUNT_TYPES = {"asset", "liability", "equity", "revenue", "expense"}


class ChartOfAccountService:
    def __init__(self, db: Session) -> None:
        self._repo = COARepository(db)
        self._scope = FinanceScopeValidator(db)
        self._audit = AuditService(db)

    def list_account_groups(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_account_groups(ctx, cid)

    def create_account_group(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        group = self._repo.create_account_group(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_account_group",
            entity_id=group.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return group

    def list_accounts(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        status: str | None = None,
        account_type: str | None = None,
        account_group_id: UUID | None = None,
        parent_account_id: UUID | None = None,
        is_posting_account: bool | None = None,
        search: str | None = None,
        sort_by: str = "account_code",
        sort_dir: str = "asc",
        include_balance: bool = True,
    ) -> list[ChartOfAccountResponse]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        accounts = self._repo.list_accounts(
            ctx,
            cid,
            status=status,
            account_type=account_type,
            account_group_id=account_group_id,
            parent_account_id=parent_account_id,
            is_posting_account=is_posting_account,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        balances = self._repo.account_balances(ctx, cid) if include_balance else {}
        return [self._to_response(ctx, a, balances) for a in accounts]

    def get_account(self, ctx: TenantContext, account_id: UUID) -> ChartOfAccountResponse:
        account = self._repo.get_account(ctx, account_id)
        if account is None:
            raise NotFoundException("Account not found")
        self._scope.validate_company_access(ctx, account.company_id)
        balances = self._repo.account_balances(ctx, account.company_id)
        return self._to_response(ctx, account, balances)

    def get_account_entity(self, ctx: TenantContext, account_id: UUID):
        account = self._repo.get_account(ctx, account_id)
        if account is None:
            raise NotFoundException("Account not found")
        self._scope.validate_company_access(ctx, account.company_id)
        return account

    def list_children(self, ctx: TenantContext, account_id: UUID) -> list[ChartOfAccountResponse]:
        parent = self.get_account_entity(ctx, account_id)
        children = self._repo.list_children(ctx, account_id)
        balances = self._repo.account_balances(ctx, parent.company_id)
        return [self._to_response(ctx, a, balances) for a in children]

    def create_account(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._validate_account_fields(ctx, cid, fields, account_id=None)
        account = self._repo.create_account(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_chart_of_account",
            entity_id=account.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"account_code": account.account_code, "status": account.status},
        )
        return self.get_account(ctx, account.id)

    def update_account(self, ctx: TenantContext, account_id: UUID, **fields):
        account = self.get_account_entity(ctx, account_id)
        if account.status not in _EDITABLE_STATUSES and "status" not in fields:
            # Allow metadata edits only in draft/inactive; active needs deactivate first
            # except status transitions handled by workflow actions.
            raise AppException("Active accounts must be deactivated before edit")
        if account.status == "active" and set(fields.keys()) - {"status"}:
            raise AppException("Active accounts must be deactivated before edit")
        self._validate_account_fields(ctx, account.company_id, fields, account_id=account_id)
        updated = self._repo.update_account(ctx, account_id, **fields)
        if updated is None:
            raise NotFoundException("Account not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_chart_of_account",
            entity_id=account_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=fields,
        )
        return self.get_account(ctx, account_id)

    def delete_account(self, ctx: TenantContext, account_id: UUID) -> None:
        account = self.get_account_entity(ctx, account_id)
        if self._repo.count_children(ctx, account_id) > 0:
            raise ConflictException("Cannot delete account with child accounts")
        debit, credit = self._repo.account_balance(ctx, account.company_id, account_id)
        if debit or credit:
            raise ConflictException("Cannot delete account with ledger balance")
        if not self._repo.soft_delete_account(ctx, account_id):
            raise NotFoundException("Account not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_chart_of_account",
            entity_id=account_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

    def submit(self, ctx: TenantContext, account_id: UUID, comments: str | None = None):
        account = self.get_account_entity(ctx, account_id)
        if account.status != "draft":
            raise AppException("Only draft accounts can be submitted")
        self._repo.update_account(ctx, account_id, status="draft")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_chart_of_account",
            entity_id=account_id,
            operation="submit",
            performed_by=ctx.user_id,
            new_value={"comments": comments, "status": "submitted"},
        )
        return self.get_account(ctx, account_id)

    def approve(self, ctx: TenantContext, account_id: UUID, comments: str | None = None):
        account = self.get_account_entity(ctx, account_id)
        if account.status != "draft":
            raise AppException("Only draft accounts can be approved")
        self._repo.update_account(ctx, account_id, status="active")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_chart_of_account",
            entity_id=account_id,
            operation="approve",
            performed_by=ctx.user_id,
            new_value={"comments": comments, "status": "active"},
        )
        return self.get_account(ctx, account_id)

    def reject(self, ctx: TenantContext, account_id: UUID, comments: str | None = None):
        account = self.get_account_entity(ctx, account_id)
        if account.status != "draft":
            raise AppException("Only draft accounts can be rejected")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_chart_of_account",
            entity_id=account_id,
            operation="reject",
            performed_by=ctx.user_id,
            new_value={"comments": comments, "status": "draft"},
        )
        return self.get_account(ctx, account_id)

    def activate(self, ctx: TenantContext, account_id: UUID, comments: str | None = None):
        account = self.get_account_entity(ctx, account_id)
        if account.status not in {"draft", "inactive"}:
            raise AppException("Only draft or inactive accounts can be activated")
        self._repo.update_account(ctx, account_id, status="active")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_chart_of_account",
            entity_id=account_id,
            operation="activate",
            performed_by=ctx.user_id,
            new_value={"comments": comments, "status": "active"},
        )
        return self.get_account(ctx, account_id)

    def deactivate(self, ctx: TenantContext, account_id: UUID, comments: str | None = None):
        account = self.get_account_entity(ctx, account_id)
        if account.status != "active":
            raise AppException("Only active accounts can be deactivated")
        self._repo.update_account(ctx, account_id, status="inactive")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_chart_of_account",
            entity_id=account_id,
            operation="deactivate",
            performed_by=ctx.user_id,
            new_value={"comments": comments, "status": "inactive"},
        )
        return self.get_account(ctx, account_id)

    def summary(self, ctx: TenantContext, company_id: UUID | None = None) -> ChartOfAccountSummaryResponse:
        accounts = self.list_accounts(ctx, company_id, include_balance=False)
        by_type = {t: 0 for t in _ACCOUNT_TYPES}
        active = inactive = draft = 0
        for a in accounts:
            by_type[a.account_type] = by_type.get(a.account_type, 0) + 1
            if a.status == "active":
                active += 1
            elif a.status == "inactive":
                inactive += 1
            elif a.status == "draft":
                draft += 1
        recent = sorted(
            accounts,
            key=lambda a: a.created_at or "",
            reverse=True,
        )[:8]
        return ChartOfAccountSummaryResponse(
            total_accounts=len(accounts),
            active_accounts=active,
            inactive_accounts=inactive,
            draft_accounts=draft,
            assets=by_type.get("asset", 0),
            liabilities=by_type.get("liability", 0),
            equity=by_type.get("equity", 0),
            income=by_type.get("revenue", 0),
            expense=by_type.get("expense", 0),
            recently_created=recent,
        )

    def balance(self, ctx: TenantContext, account_id: UUID) -> ChartOfAccountBalanceResponse:
        account = self.get_account_entity(ctx, account_id)
        debit, credit = self._repo.account_balance(ctx, account.company_id, account_id)
        signed = debit - credit
        if account.normal_balance == "credit":
            signed = credit - debit
        return ChartOfAccountBalanceResponse(
            account_id=account.id,
            account_code=account.account_code,
            debit_total=debit,
            credit_total=credit,
            balance=signed,
        )

    def related_journals(self, ctx: TenantContext, account_id: UUID) -> list[AccountRelatedJournalResponse]:
        self.get_account_entity(ctx, account_id)
        journals = self._repo.related_journals(ctx, account_id)
        return [
            AccountRelatedJournalResponse(
                id=j.id,
                journal_number=j.journal_number,
                journal_date=j.journal_date,
                description=j.description,
                status=j.status,
                total_debit=float(j.total_debit or 0),
                total_credit=float(j.total_credit or 0),
            )
            for j in journals
        ]

    def import_accounts(
        self, ctx: TenantContext, company_id: UUID | None, rows: list
    ) -> ChartOfAccountImportResult:
        cid = self._scope.resolve_company_id(ctx, company_id)
        created = 0
        errors: list[str] = []
        for idx, row in enumerate(rows, start=1):
            data = row.model_dump() if hasattr(row, "model_dump") else dict(row)
            try:
                group_id = data.get("account_group_id")
                if not group_id and data.get("account_group_code"):
                    group = self._repo.get_account_group_by_code(ctx, cid, data["account_group_code"])
                    if group is None:
                        raise AppException(f"Unknown account group code {data['account_group_code']}")
                    group_id = group.id
                if not group_id:
                    raise AppException("account_group_id or account_group_code required")
                parent_id = None
                if data.get("parent_account_code"):
                    parent = self._repo.get_account_by_code(ctx, cid, data["parent_account_code"])
                    if parent is None:
                        raise AppException(f"Unknown parent code {data['parent_account_code']}")
                    parent_id = parent.id
                self.create_account(
                    ctx,
                    cid,
                    account_group_id=group_id,
                    account_code=data["account_code"],
                    account_name=data["account_name"],
                    account_type=data["account_type"],
                    normal_balance=data["normal_balance"],
                    parent_account_id=parent_id,
                    is_posting_account=bool(data.get("is_posting_account", True)),
                    is_cost_center_enabled=bool(data.get("is_cost_center_enabled", False)),
                    currency_code=data.get("currency_code"),
                    description=data.get("description"),
                    status=data.get("status") or "draft",
                )
                created += 1
            except Exception as exc:  # noqa: BLE001 — collect row errors for import summary
                errors.append(f"Row {idx}: {exc}")
        return ChartOfAccountImportResult(created=created, failed=len(errors), errors=errors)

    def merge_accounts(
        self, ctx: TenantContext, source_account_id: UUID, target_account_id: UUID, comments: str | None = None
    ):
        """API-ready stub — ledger remapping not implemented in Phase 2."""
        if source_account_id == target_account_id:
            raise AppException("Source and target must differ")
        self.get_account_entity(ctx, source_account_id)
        self.get_account_entity(ctx, target_account_id)
        raise AppException(
            "Account merge is prepared but ledger remapping is not enabled yet. "
            f"Comments recorded intent: {comments or 'n/a'}"
        )

    def _validate_account_fields(
        self,
        ctx: TenantContext,
        company_id: UUID,
        fields: dict,
        *,
        account_id: UUID | None,
    ) -> None:
        if "account_type" in fields and fields["account_type"] not in _ACCOUNT_TYPES:
            raise AppException("Invalid account type")
        if "normal_balance" in fields and fields["normal_balance"] not in {"debit", "credit"}:
            raise AppException("Invalid normal balance")
        if "status" in fields and fields["status"] not in {"draft", "active", "inactive"}:
            raise AppException("Invalid status")
        if "account_group_id" in fields and fields["account_group_id"] is not None:
            group = self._repo.get_account_group(ctx, fields["account_group_id"])
            if group is None or group.company_id != company_id:
                raise AppException("Invalid account group")
        if "parent_account_id" in fields and fields["parent_account_id"] is not None:
            parent = self._repo.get_account(ctx, fields["parent_account_id"])
            if parent is None or parent.company_id != company_id:
                raise AppException("Invalid parent account")
            if account_id and parent.id == account_id:
                raise AppException("Account cannot be its own parent")
        if "account_code" in fields and fields["account_code"]:
            existing = self._repo.get_account_by_code(ctx, company_id, fields["account_code"])
            if existing and existing.id != account_id:
                raise ConflictException("Account code already exists")

    def _to_response(
        self,
        ctx: TenantContext,
        account,
        balances: dict[UUID, tuple[float, float]],
    ) -> ChartOfAccountResponse:
        debit, credit = balances.get(account.id, (0.0, 0.0))
        signed = debit - credit
        if account.normal_balance == "credit":
            signed = credit - debit
        parent_code = parent_name = None
        if account.parent_account_id:
            parent = self._repo.get_account(ctx, account.parent_account_id)
            if parent:
                parent_code = parent.account_code
                parent_name = parent.account_name
        group = self._repo.get_account_group(ctx, account.account_group_id)
        return ChartOfAccountResponse(
            id=account.id,
            company_id=account.company_id,
            account_group_id=account.account_group_id,
            account_code=account.account_code,
            account_name=account.account_name,
            account_type=account.account_type,
            normal_balance=account.normal_balance,
            parent_account_id=account.parent_account_id,
            is_posting_account=account.is_posting_account,
            is_cost_center_enabled=account.is_cost_center_enabled,
            is_profit_center_enabled=account.is_profit_center_enabled,
            is_tax_applicable=bool(getattr(account, "is_tax_applicable", False)),
            currency_code=account.currency_code,
            description=getattr(account, "description", None),
            status=account.status,
            version=account.version,
            created_by=account.created_by,
            created_at=account.created_at,
            updated_by=account.updated_by,
            updated_at=account.updated_at,
            parent_account_code=parent_code,
            parent_account_name=parent_name,
            account_group_code=group.group_code if group else None,
            account_group_name=group.group_name if group else None,
            balance=signed,
            child_count=self._repo.count_children(ctx, account.id),
        )
