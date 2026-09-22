"""Inventory CRUD and document services."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.finance.domain.enums import JournalType
from modules.finance.repository.fiscal_repository import FiscalRepository
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.workflow_repository import WorkflowRepository
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.workflow_service import WorkflowService
from modules.inventory.domain.enums import (
    AdjustmentStatus,
    CycleCountStatus,
    InvEntityType,
    TransferStatus,
)
from modules.inventory.domain.exceptions import (
    InvalidDocumentState,
    InventoryPeriodClosed,
    SegregationOfDutiesError,
)
from modules.inventory.domain.value_objects import StockKey
from modules.inventory.models.adjustment import InvAdjustmentHeader
from modules.inventory.models.cycle_count import InvCycleCountHeader
from modules.inventory.models.transfer import InvTransferHeader
from modules.inventory.repository.adjustment_repository import AdjustmentRepository
from modules.inventory.repository.balance_repository import BalanceRepository
from modules.inventory.repository.base import utcnow
from modules.inventory.repository.batch_repository import BatchRepository
from modules.inventory.repository.bin_repository import BinRepository
from modules.inventory.repository.cycle_count_repository import CycleCountRepository
from modules.inventory.repository.ledger_repository import LedgerRepository
from modules.inventory.repository.reorder_policy_repository import ReorderPolicyRepository
from modules.inventory.repository.reservation_repository import ReservationRepository
from modules.inventory.repository.serial_repository import SerialRepository
from modules.inventory.repository.transfer_repository import TransferRepository
from modules.inventory.repository.valuation_repository import ValuationRepository
from modules.inventory.service.document_number_service import DocumentNumberService
from modules.inventory.service.engines import (
    AdjustmentEngine,
    CycleCountEngine,
    TransferEngine,
)
from modules.inventory.service.inventory_application_service import InventoryApplicationService
from modules.inventory.service.inventory_scope_validator import InventoryScopeValidator


class BinService:
    def __init__(self, db: Session) -> None:
        self._repo = BinRepository(db)
        self._scope = InventoryScopeValidator(db)
        self._audit = AuditService(db)

    def list_bins(
        self, ctx: TenantContext, company_id: UUID | None = None,
        warehouse_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_bins(ctx, cid, warehouse_id)

    def get_bin(self, ctx: TenantContext, bin_id: UUID):
        row = self._repo.get(ctx, bin_id)
        if row is None:
            raise NotFoundException("Bin not found")
        return row

    def create_bin(self, ctx: TenantContext, **fields):
        cid = self._scope.resolve_company_id(ctx, fields.pop("company_id", None))
        row = self._repo.create(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id, entity_name="inv_bin", entity_id=row.id,
            operation="create", performed_by=ctx.user_id,
        )
        return row

    def update_bin(self, ctx: TenantContext, bin_id: UUID, **fields):
        row = self._repo.update(ctx, bin_id, **fields)
        if row is None:
            raise NotFoundException("Bin not found")
        return row


class BatchService:
    def __init__(self, db: Session) -> None:
        self._repo = BatchRepository(db)
        self._scope = InventoryScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._audit = AuditService(db)

    def list_batches(
        self, ctx: TenantContext, company_id: UUID | None = None,
        product_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_batches(ctx, cid, product_id)

    def get_batch(self, ctx: TenantContext, batch_id: UUID):
        row = self._repo.get(ctx, batch_id)
        if row is None:
            raise NotFoundException("Batch not found")
        return row

    def create_batch(self, ctx: TenantContext, **fields):
        from modules.inventory.models.batch import InvBatch

        cid = self._scope.resolve_company_id(ctx, fields.pop("company_id", None))
        if not fields.get("batch_number"):
            fields["batch_number"] = self._numbers.generate(
                InvEntityType.BATCH, cid, model=InvBatch, code_column="batch_number"
            )
        row = self._repo.create(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id, entity_name="inv_batch", entity_id=row.id,
            operation="create", performed_by=ctx.user_id,
        )
        return row

    def update_batch(self, ctx: TenantContext, batch_id: UUID, **fields):
        row = self._repo.update(ctx, batch_id, **fields)
        if row is None:
            raise NotFoundException("Batch not found")
        return row


class SerialService:
    def __init__(self, db: Session) -> None:
        self._repo = SerialRepository(db)
        self._scope = InventoryScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._audit = AuditService(db)

    def list_serials(
        self, ctx: TenantContext, company_id: UUID | None = None,
        product_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_serials(ctx, cid, product_id)

    def get_serial(self, ctx: TenantContext, serial_id: UUID):
        row = self._repo.get(ctx, serial_id)
        if row is None:
            raise NotFoundException("Serial not found")
        return row

    def create_serial(self, ctx: TenantContext, **fields):
        from modules.inventory.models.serial import InvSerial

        cid = self._scope.resolve_company_id(ctx, fields.pop("company_id", None))
        if not fields.get("serial_number"):
            fields["serial_number"] = self._numbers.generate(
                InvEntityType.SERIAL, cid, model=InvSerial, code_column="serial_number"
            )
        row = self._repo.create(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id, entity_name="inv_serial", entity_id=row.id,
            operation="create", performed_by=ctx.user_id,
        )
        return row

    def update_serial(self, ctx: TenantContext, serial_id: UUID, **fields):
        row = self._repo.update(ctx, serial_id, **fields)
        if row is None:
            raise NotFoundException("Serial not found")
        return row


class StockBalanceService:
    def __init__(self, db: Session) -> None:
        self._repo = BalanceRepository(db)
        self._ledger = LedgerRepository(db)
        self._scope = InventoryScopeValidator(db)
        self._stock = __import__(
            "modules.inventory.service.engines", fromlist=["StockEngine"]
        ).StockEngine()

    def list_stock(self, ctx: TenantContext, company_id: UUID | None = None, **filters):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_balances(ctx, cid, **filters)

    def get_balance(self, ctx: TenantContext, balance_id: UUID):
        row = self._repo.get(ctx, balance_id)
        if row is None:
            raise NotFoundException("Stock balance not found")
        return row

    def list_ledger(self, ctx: TenantContext, company_id: UUID | None = None, **filters):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._ledger.list_ledger(ctx, cid, **filters)

    def get_ledger_entry(self, ctx: TenantContext, entry_id: UUID):
        row = self._ledger.get(ctx, entry_id)
        if row is None:
            raise NotFoundException("Ledger entry not found")
        return row

    def recompute_available(self, ctx: TenantContext, balance_id: UUID):
        row = self.get_balance(ctx, balance_id)
        self._stock.recompute_available(row)
        self._repo.touch(row, ctx)
        return row


class ReservationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ReservationRepository(db)
        self._scope = InventoryScopeValidator(db)
        self._app = InventoryApplicationService(db)

    def list_reservations(
        self, ctx: TenantContext, company_id: UUID | None = None,
        status: str | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_reservations(ctx, cid, status)

    def get_reservation(self, ctx: TenantContext, reservation_id: UUID):
        row = self._repo.get(ctx, reservation_id)
        if row is None:
            raise NotFoundException("Reservation not found")
        return row

    def create_reservation(self, ctx: TenantContext, **fields):
        return self._app.reserve(ctx, **fields)

    def release(self, ctx: TenantContext, reservation_id: UUID):
        return self._app.release_reservation(ctx, reservation_id)


class ValuationService:
    def __init__(self, db: Session) -> None:
        self._repo = ValuationRepository(db)
        self._scope = InventoryScopeValidator(db)

    def list_layers(
        self, ctx: TenantContext, company_id: UUID | None = None,
        warehouse_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_layers(ctx, cid, warehouse_id)

    def run_valuation(self, ctx: TenantContext, company_id: UUID | None = None):
        layers = self.list_layers(ctx, company_id)
        total = sum(Decimal(str(ln.remaining_qty)) * Decimal(str(ln.unit_cost)) for ln in layers)
        return {"layer_count": len(layers), "total_value": float(total)}


class InventoryPostingService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._adjustments = AdjustmentRepository(db)
        self._journals = JournalService(db)
        self._posting = PostingService(db)
        self._fiscal = FiscalRepository(db)
        self._audit = AuditService(db)
        self._scope = InventoryScopeValidator(db)

    def post_adjustment_journal(
        self,
        ctx: TenantContext,
        adjustment_id: UUID,
        *,
        inventory_account_id: UUID,
        offset_account_id: UUID,
    ):
        header = self._adjustments.get(ctx, adjustment_id)
        if header is None:
            raise NotFoundException("Adjustment not found")
        if header.period_id is None:
            raise InvalidDocumentState("Period required")
        period = self._fiscal.get_period(ctx, header.period_id)
        if period and getattr(period, "inventory_closed", False):
            raise InventoryPeriodClosed()

        amount = Decimal("0")
        for line in [ln for ln in header.lines if not ln.is_deleted]:
            qty = abs(Decimal(str(line.quantity)))
            cost = Decimal(str(line.unit_cost or 0))
            amount += qty * cost
        amount = amount.quantize(Decimal("0.0001"))
        if amount <= 0:
            return header

        journal = self._journals.create_journal(
            ctx,
            company_id=header.company_id,
            branch_id=header.branch_id,
            journal_date=header.document_date,
            description=f"Inventory adjustment {header.document_number}",
            journal_type=JournalType.SYSTEM.value,
            period_id=header.period_id,
            fiscal_year_id=header.fiscal_year_id,
        )
        # gain: Dr Inventory Cr Income; loss: Dr Expense Cr Inventory - use signed net
        net = sum(
            Decimal(str(ln.quantity)) * Decimal(str(ln.unit_cost or 0))
            for ln in header.lines if not ln.is_deleted
        )
        if net >= 0:
            self._journals.add_line(
                ctx, journal.id, line_number=1, account_id=inventory_account_id,
                debit_amount=float(amount), credit_amount=0, description="Inventory gain",
            )
            self._journals.add_line(
                ctx, journal.id, line_number=2, account_id=offset_account_id,
                debit_amount=0, credit_amount=float(amount), description="Adjustment income",
            )
        else:
            self._journals.add_line(
                ctx, journal.id, line_number=1, account_id=offset_account_id,
                debit_amount=float(amount), credit_amount=0, description="Adjustment expense",
            )
            self._journals.add_line(
                ctx, journal.id, line_number=2, account_id=inventory_account_id,
                debit_amount=0, credit_amount=float(amount), description="Inventory write-off",
            )
        self._posting.post_system_journal(ctx, journal.id)
        self._adjustments.update(ctx, adjustment_id, finance_journal_id=journal.id)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id, entity_name="inv_adjustment_header", entity_id=adjustment_id,
            operation="finance_post", performed_by=ctx.user_id,
        )
        return self._adjustments.get(ctx, adjustment_id)


class TransferService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = TransferRepository(db)
        self._scope = InventoryScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = TransferEngine()
        self._app = InventoryApplicationService(db)
        self._audit = AuditService(db)
        self._workflow = WorkflowService(db)
        self._workflow_repo = WorkflowRepository(db)

    def list_transfers(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_transfers(ctx, cid)

    def get_transfer(self, ctx: TenantContext, transfer_id: UUID) -> InvTransferHeader:
        row = self._repo.get(ctx, transfer_id)
        if row is None:
            raise NotFoundException("Transfer not found")
        return row

    def create_transfer(self, ctx: TenantContext, *, lines: list[dict] | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, fields.pop("company_id", None))
        branch_id = self._scope.require_branch(ctx, fields.pop("branch_id", None))
        doc = self._numbers.generate(
            InvEntityType.TRANSFER, cid, model=InvTransferHeader, code_column="document_number"
        )
        header = self._repo.create(
            ctx, company_id=cid, branch_id=branch_id, document_number=doc,
            status=TransferStatus.DRAFT.value, **fields,
        )
        for spec in lines or []:
            self._repo.add_line(ctx, header, **spec)
        return self.get_transfer(ctx, header.id)

    def submit(self, ctx: TenantContext, transfer_id: UUID):
        header = self.get_transfer(ctx, transfer_id)
        self._engine.validate_submittable(header)
        definition = self._workflow_repo.get_definition_by_code(
            ctx.tenant_id, "INV_TRANSFER_APPROVAL"
        )
        instance_id = None
        if definition is not None:
            instance = self._workflow.create_instance(
                tenant_id=ctx.tenant_id,
                workflow_id=definition.id,
                entity_name="inv_transfer_header",
                entity_id=header.id,
                started_by=ctx.user_id,
            )
            instance_id = instance.id
        return self._repo.update(
            ctx, transfer_id,
            status=TransferStatus.SUBMITTED.value,
            workflow_status=WorkflowStatus.IN_PROGRESS.value,
            workflow_instance_id=instance_id,
        )

    def approve(self, ctx: TenantContext, transfer_id: UUID):
        header = self.get_transfer(ctx, transfer_id)
        if header.created_by == ctx.user_id:
            raise SegregationOfDutiesError("Creator cannot approve own transfer")
        self._engine.validate_approvable(header)
        return self._repo.update(
            ctx, transfer_id,
            status=TransferStatus.APPROVED.value,
            workflow_status=WorkflowStatus.APPROVED.value,
        )

    def ship(self, ctx: TenantContext, transfer_id: UUID):
        header = self.get_transfer(ctx, transfer_id)
        self._engine.validate_shippable(header)
        for line in [ln for ln in header.lines if not ln.is_deleted]:
            self._app.issue_goods(
                ctx,
                company_id=header.company_id,
                branch_id=header.branch_id,
                warehouse_id=header.from_warehouse_id,
                product_id=line.product_id,
                uom_id=line.uom_id,
                quantity=Decimal(str(line.quantity)),
                source_module="inventory",
                source_document_type="transfer",
                source_document_id=header.id,
                source_line_id=line.id,
                bin_id=line.from_bin_id,
                batch_id=line.batch_id,
            )
        return self._repo.update(
            ctx, transfer_id,
            status=TransferStatus.IN_TRANSIT.value,
            shipped_at=utcnow(),
        )

    def receive(self, ctx: TenantContext, transfer_id: UUID):
        header = self.get_transfer(ctx, transfer_id)
        self._engine.validate_receivable(header)
        for line in [ln for ln in header.lines if not ln.is_deleted]:
            self._app.receive_goods(
                ctx,
                company_id=header.company_id,
                branch_id=header.branch_id,
                warehouse_id=header.to_warehouse_id,
                product_id=line.product_id,
                uom_id=line.uom_id,
                quantity=Decimal(str(line.quantity)),
                source_module="inventory",
                source_document_type="transfer",
                source_document_id=header.id,
                source_line_id=line.id,
                bin_id=line.to_bin_id,
                batch_id=line.batch_id,
            )
        return self._repo.update(
            ctx, transfer_id,
            status=TransferStatus.CLOSED.value,
            received_at=utcnow(),
        )


class AdjustmentService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = AdjustmentRepository(db)
        self._scope = InventoryScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = AdjustmentEngine()
        self._app = InventoryApplicationService(db)
        self._posting = InventoryPostingService(db)
        self._audit = AuditService(db)

    def list_adjustments(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_adjustments(ctx, cid)

    def get_adjustment(self, ctx: TenantContext, adjustment_id: UUID) -> InvAdjustmentHeader:
        row = self._repo.get(ctx, adjustment_id)
        if row is None:
            raise NotFoundException("Adjustment not found")
        return row

    def create_adjustment(self, ctx: TenantContext, *, lines: list[dict] | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, fields.pop("company_id", None))
        branch_id = self._scope.require_branch(ctx, fields.pop("branch_id", None))
        doc = self._numbers.generate(
            InvEntityType.ADJUSTMENT, cid, model=InvAdjustmentHeader, code_column="document_number"
        )
        header = self._repo.create(
            ctx, company_id=cid, branch_id=branch_id, document_number=doc,
            status=AdjustmentStatus.DRAFT.value, **fields,
        )
        for spec in lines or []:
            self._repo.add_line(ctx, header, **spec)
        return self.get_adjustment(ctx, header.id)

    def submit(self, ctx: TenantContext, adjustment_id: UUID):
        header = self.get_adjustment(ctx, adjustment_id)
        self._engine.validate_submittable(header)
        return self._repo.update(ctx, adjustment_id, status=AdjustmentStatus.SUBMITTED.value)

    def approve(self, ctx: TenantContext, adjustment_id: UUID):
        header = self.get_adjustment(ctx, adjustment_id)
        if header.created_by == ctx.user_id:
            raise SegregationOfDutiesError("Creator cannot approve own adjustment")
        self._engine.validate_approvable(header)
        return self._repo.update(ctx, adjustment_id, status=AdjustmentStatus.APPROVED.value)

    def post(
        self,
        ctx: TenantContext,
        adjustment_id: UUID,
        *,
        inventory_account_id: UUID | None = None,
        offset_account_id: UUID | None = None,
    ):
        header = self.get_adjustment(ctx, adjustment_id)
        self._engine.validate_postable(header)
        for line in [ln for ln in header.lines if not ln.is_deleted]:
            self._app.adjust(
                ctx,
                key=StockKey(
                    company_id=header.company_id,
                    branch_id=header.branch_id,
                    warehouse_id=header.warehouse_id,
                    product_id=line.product_id,
                    uom_id=line.uom_id,
                    bin_id=line.bin_id,
                    batch_id=line.batch_id,
                ),
                signed_qty=Decimal(str(line.quantity)),
                source_document_type="adjustment",
                source_document_id=header.id,
                source_line_id=line.id,
                unit_cost=Decimal(str(line.unit_cost or 0)),
            )
        self._repo.update(ctx, adjustment_id, status=AdjustmentStatus.POSTED.value)
        if inventory_account_id and offset_account_id:
            self._posting.post_adjustment_journal(
                ctx, adjustment_id,
                inventory_account_id=inventory_account_id,
                offset_account_id=offset_account_id,
            )
        return self.get_adjustment(ctx, adjustment_id)


class CycleCountService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = CycleCountRepository(db)
        self._balances = BalanceRepository(db)
        self._scope = InventoryScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = CycleCountEngine()
        self._app = InventoryApplicationService(db)
        self._audit = AuditService(db)

    def list_counts(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_counts(ctx, cid)

    def get_count(self, ctx: TenantContext, count_id: UUID) -> InvCycleCountHeader:
        row = self._repo.get(ctx, count_id)
        if row is None:
            raise NotFoundException("Cycle count not found")
        return row

    def create_count(self, ctx: TenantContext, *, lines: list[dict] | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, fields.pop("company_id", None))
        branch_id = self._scope.require_branch(ctx, fields.pop("branch_id", None))
        doc = self._numbers.generate(
            InvEntityType.CYCLE_COUNT, cid, model=InvCycleCountHeader, code_column="document_number"
        )
        header = self._repo.create(
            ctx, company_id=cid, branch_id=branch_id, document_number=doc,
            status=CycleCountStatus.DRAFT.value, **fields,
        )
        for spec in lines or []:
            line = self._repo.add_line(ctx, header, **spec)
            self._engine.compute_variance(line)
        return self.get_count(ctx, header.id)

    def submit(self, ctx: TenantContext, count_id: UUID):
        header = self.get_count(ctx, count_id)
        self._engine.validate_submittable(header)
        for line in header.lines:
            self._engine.compute_variance(line)
        return self._repo.update(ctx, count_id, status=CycleCountStatus.SUBMITTED.value)

    def approve(self, ctx: TenantContext, count_id: UUID):
        header = self.get_count(ctx, count_id)
        if header.created_by == ctx.user_id:
            raise SegregationOfDutiesError("Creator cannot approve own cycle count")
        self._engine.validate_approvable(header)
        return self._repo.update(ctx, count_id, status=CycleCountStatus.APPROVED.value)

    def post(self, ctx: TenantContext, count_id: UUID):
        header = self.get_count(ctx, count_id)
        self._engine.validate_postable(header)
        for line in [ln for ln in header.lines if not ln.is_deleted]:
            variance = Decimal(str(line.variance_qty))
            if variance == 0:
                continue
            # Resolve uom from balance grain
            bal = self._balances.get_for_update(
                ctx,
                company_id=header.company_id,
                warehouse_id=header.warehouse_id,
                product_id=line.product_id,
                bin_id=line.bin_id,
                batch_id=line.batch_id,
            )
            if bal is None:
                continue
            self._app.adjust(
                ctx,
                key=StockKey(
                    company_id=header.company_id,
                    branch_id=header.branch_id,
                    warehouse_id=header.warehouse_id,
                    product_id=line.product_id,
                    uom_id=bal.uom_id,
                    bin_id=line.bin_id,
                    batch_id=line.batch_id,
                ),
                signed_qty=variance,
                source_document_type="cycle_count",
                source_document_id=header.id,
                source_line_id=line.id,
            )
        return self._repo.update(ctx, count_id, status=CycleCountStatus.POSTED.value)


class ReorderPolicyService:
    def __init__(self, db: Session) -> None:
        self._repo = ReorderPolicyRepository(db)
        self._scope = InventoryScopeValidator(db)

    def list_policies(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_policies(ctx, cid)

    def get_policy(self, ctx: TenantContext, policy_id: UUID):
        row = self._repo.get(ctx, policy_id)
        if row is None:
            raise NotFoundException("Reorder policy not found")
        return row

    def create_policy(self, ctx: TenantContext, **fields):
        cid = self._scope.resolve_company_id(ctx, fields.pop("company_id", None))
        return self._repo.create(ctx, company_id=cid, **fields)

    def update_policy(self, ctx: TenantContext, policy_id: UUID, **fields):
        row = self._repo.update(ctx, policy_id, **fields)
        if row is None:
            raise NotFoundException("Reorder policy not found")
        return row
