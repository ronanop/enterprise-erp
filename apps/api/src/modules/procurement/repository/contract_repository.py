"""Procurement vendor contract repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.models.contract import ProcVendorContract, ProcVendorContractLine
from modules.procurement.repository.base import ProcScopedRepository, utcnow


class ContractRepository(ProcScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_contracts(self, ctx: TenantContext, company_id: UUID | None) -> list[ProcVendorContract]:
        stmt = select(ProcVendorContract).where(ProcVendorContract.is_deleted.is_(False))
        stmt = self.apply_optional_company_filter(stmt, ProcVendorContract, company_id)
        stmt = self.apply_proc_filter(stmt, ProcVendorContract, ctx)
        return list(
            self.db.scalars(stmt.order_by(ProcVendorContract.start_date.desc())).all()
        )

    def get_contract(self, ctx: TenantContext, contract_id: UUID) -> ProcVendorContract | None:
        stmt = (
            select(ProcVendorContract)
            .options(selectinload(ProcVendorContract.lines))
            .where(
                ProcVendorContract.id == contract_id,
                ProcVendorContract.tenant_id == ctx.tenant_id,
                ProcVendorContract.is_deleted.is_(False),
            )
        )
        return self.db.scalar(stmt)

    def get_contract_for_update(
        self, ctx: TenantContext, contract_id: UUID
    ) -> ProcVendorContract | None:
        stmt = (
            select(ProcVendorContract)
            .options(selectinload(ProcVendorContract.lines))
            .where(
                ProcVendorContract.id == contract_id,
                ProcVendorContract.tenant_id == ctx.tenant_id,
                ProcVendorContract.is_deleted.is_(False),
            )
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def create_contract(
        self, ctx: TenantContext, *, company_id: UUID, **fields: object
    ) -> ProcVendorContract:
        row = ProcVendorContract(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_contract(
        self, ctx: TenantContext, contract_id: UUID, **fields: object
    ) -> ProcVendorContract | None:
        row = self.get_contract_for_update(ctx, contract_id)
        if row is None:
            return None
        for key, value in fields.items():
            if hasattr(row, key):
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version += 1
        self.db.flush()
        return row

    def add_line(
        self, ctx: TenantContext, contract: ProcVendorContract, **fields: object
    ) -> ProcVendorContractLine:
        row = ProcVendorContractLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=contract.company_id,
            branch_id=contract.branch_id,
            contract_id=contract.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row
