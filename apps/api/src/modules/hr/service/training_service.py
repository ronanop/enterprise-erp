"""Training services."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.enums import HrEntityType
from modules.hr.models import HrTraining, HrTrainingRequest, HrTrainingRoom
from modules.hr.repository.training_attendance_repository import TrainingAttendanceRepository
from modules.hr.repository.training_repository import TrainingRepository
from modules.hr.repository.training_request_repository import TrainingRequestRepository
from modules.hr.repository.training_room_repository import TrainingRoomRepository
from modules.hr.service.document_number_service import DocumentNumberService
from modules.hr.service.engines import TrainingAttendanceEngine, TrainingEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator


class TrainingService:
    def __init__(self, db: Session) -> None:
        self._repo = TrainingRepository(db)
        self._attendance = TrainingAttendanceRepository(db)
        self._scope = HrScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = TrainingEngine()
        self._master = HrMasterDataAdapter(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Training not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        code = fields.pop("training_code", None) or self._numbers.generate(
            HrEntityType.TRAINING, cid, HrTraining, "training_code"
        )
        employee_ids = fields.pop("employee_ids", None) or []
        row = self._repo.create(ctx, company_id=cid, training_code=code, **fields)
        branch_id = fields.get("branch_id") or row.branch_id
        for emp_id in employee_ids:
            if not branch_id:
                continue
            self._master.get_employee(ctx, emp_id)
            self._attendance.create(
                ctx,
                company_id=cid,
                branch_id=branch_id,
                training_id=row.id,
                employee_id=emp_id,
            )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_training",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"training_code": row.training_code, "training_name": row.training_name},
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Training not found")
        return row

    def assign(
        self,
        ctx: TenantContext,
        training_id: UUID,
        *,
        branch_id: UUID,
        employee_id: UUID,
        company_id: UUID | None = None,
        **fields,
    ):
        training = self.get(ctx, training_id)
        cid = self._scope.resolve_company_id(ctx, company_id or training.company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        return self._attendance.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            training_id=training_id,
            employee_id=employee_id,
            **fields,
        )


class TrainingAttendanceService:
    def __init__(self, db: Session) -> None:
        self._repo = TrainingAttendanceRepository(db)
        self._scope = HrScopeValidator(db)
        self._engine = TrainingAttendanceEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def mark_attended(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Training attendance not found")
        self._engine.mark_attended(row)
        return self._repo.update(ctx, row_id, attendance_status=row.attendance_status)


class TrainingRoomService:
    def __init__(self, db: Session) -> None:
        self._repo = TrainingRoomRepository(db)
        self._scope = HrScopeValidator(db)
        self._numbers = DocumentNumberService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Training room not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        code = fields.pop("room_code", None) or self._numbers.generate(
            HrEntityType.TRAINING_ROOM, cid, HrTrainingRoom, "room_code"
        )
        return self._repo.create(ctx, company_id=cid, room_code=code, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Training room not found")
        return row


class TrainingRequestService:
    def __init__(self, db: Session) -> None:
        self._repo = TrainingRequestRepository(db)
        self._scope = HrScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._master = HrMasterDataAdapter(db)
        self._audit = AuditService(db)
        self._training = TrainingService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Meeting request not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, fields["requested_by_employee_id"])
        code = fields.pop("request_code", None) or self._numbers.generate(
            HrEntityType.TRAINING_REQUEST, cid, HrTrainingRequest, "request_code"
        )
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            request_code=code,
            status=fields.pop("status", "submitted"),
            **fields,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_training_request",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"request_code": row.request_code, "title": row.title},
        )
        return row

    def approve(self, ctx: TenantContext, row_id: UUID, *, approval_notes: str | None = None):
        row = self.get(ctx, row_id)
        if row.status not in {"submitted", "draft"}:
            raise ConflictException("Only submitted requests can be approved")
        training = None
        if row.request_type in {"training", "workshop"}:
            ttype = "compliance" if row.request_type == "workshop" else "technical"
            training = self._training.create(
                ctx,
                company_id=row.company_id,
                branch_id=row.branch_id,
                training_name=row.title,
                training_type=ttype,
                trainer_name=row.host_name,
                trainer_employee_id=row.host_employee_id,
                start_date=row.request_date,
                end_date=row.request_date,
                start_time=row.start_time,
                end_time=row.end_time,
                room_id=row.room_id,
                is_recurring=row.is_recurring,
                recurrence_rule=row.recurrence_rule or "none",
                notes=row.agenda,
                employee_ids=[
                    UUID(str(a["employee_id"]))
                    for a in (row.attendees_json or [])
                    if isinstance(a, dict) and a.get("employee_id")
                ],
            )
        updated = self._repo.update(
            ctx,
            row_id,
            status="approved",
            approval_notes=approval_notes,
            training_id=training.id if training else row.training_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_training_request",
            entity_id=row_id,
            operation="approve",
            performed_by=ctx.user_id,
        )
        return updated

    def reject(self, ctx: TenantContext, row_id: UUID, *, approval_notes: str | None = None):
        row = self.get(ctx, row_id)
        if row.status not in {"submitted", "draft"}:
            raise ConflictException("Only submitted requests can be rejected")
        updated = self._repo.update(ctx, row_id, status="rejected", approval_notes=approval_notes)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_training_request",
            entity_id=row_id,
            operation="reject",
            performed_by=ctx.user_id,
        )
        return updated
