"""Interaction, task, meeting, follow-up, and log services."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.crm.domain.enums import CrmEntityType
from modules.crm.models import CrmFollowup, CrmInteraction, CrmMeeting, CrmTask
from modules.crm.repository.call_log_repository import CallLogRepository
from modules.crm.repository.email_log_repository import EmailLogRepository
from modules.crm.repository.followup_repository import FollowupRepository
from modules.crm.repository.interaction_repository import InteractionRepository
from modules.crm.repository.meeting_repository import MeetingRepository
from modules.crm.repository.task_repository import TaskRepository
from modules.crm.repository.visit_log_repository import VisitLogRepository
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.crm.service.engines import (
    CallLogEngine,
    EmailLogEngine,
    FollowupEngine,
    InteractionEngine,
    MeetingEngine,
    TaskEngine,
    VisitLogEngine,
)
from modules.foundation.domain.value_objects import TenantContext


class InteractionService:
    def __init__(self, db: Session) -> None:
        self._repo = InteractionRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = InteractionEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_interactions(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Interaction not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        code = self._numbers.generate(CrmEntityType.INTERACTION, cid, CrmInteraction, "interaction_code")
        row = self._repo.create(
            ctx, company_id=cid, branch_id=branch_id, interaction_code=code, **fields
        )
        self._engine.validate_party(row)
        return row


class TaskService:
    def __init__(self, db: Session) -> None:
        self._repo = TaskRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = TaskEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_tasks(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Task not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        code = self._numbers.generate(CrmEntityType.TASK, cid, CrmTask, "task_code")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, task_code=code, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Task not found")
        return row

    def complete(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.complete(row)
        return self._repo.update(
            ctx, row_id, status="completed", completed_at=datetime.now(timezone.utc)
        )


class FollowupService:
    def __init__(self, db: Session) -> None:
        self._repo = FollowupRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = FollowupEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_followups(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Follow-up not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        code = self._numbers.generate(CrmEntityType.FOLLOWUP, cid, CrmFollowup, "followup_code")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, followup_code=code, **fields)

    def complete(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.complete(row)
        return self._repo.update(ctx, row_id, status="done")


class MeetingService:
    def __init__(self, db: Session) -> None:
        self._repo = MeetingRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = MeetingEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_meetings(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Meeting not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        code = self._numbers.generate(CrmEntityType.MEETING, cid, CrmMeeting, "meeting_code")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, meeting_code=code, **fields)

    def complete(self, ctx: TenantContext, row_id: UUID, *, outcome: str | None = None):
        row = self.get(ctx, row_id)
        self._engine.complete(row)
        return self._repo.update(ctx, row_id, status="completed", outcome=outcome)


class CallLogService:
    def __init__(self, db: Session) -> None:
        self._repo = CallLogRepository(db)
        self._scope = CrmScopeValidator(db)
        self._engine = CallLogEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        return self._repo.list_logs(ctx, self._scope.resolve_company_id(ctx, company_id))

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        row = self._repo.create(ctx, company_id=cid, branch_id=branch_id, **fields)
        self._engine.validate(row)
        return row


class EmailLogService:
    def __init__(self, db: Session) -> None:
        self._repo = EmailLogRepository(db)
        self._scope = CrmScopeValidator(db)
        self._engine = EmailLogEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        return self._repo.list_logs(ctx, self._scope.resolve_company_id(ctx, company_id))

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        row = self._repo.create(ctx, company_id=cid, branch_id=branch_id, **fields)
        self._engine.validate(row)
        return row


class VisitLogService:
    def __init__(self, db: Session) -> None:
        self._repo = VisitLogRepository(db)
        self._scope = CrmScopeValidator(db)
        self._engine = VisitLogEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        return self._repo.list_logs(ctx, self._scope.resolve_company_id(ctx, company_id))

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        row = self._repo.create(ctx, company_id=cid, branch_id=branch_id, **fields)
        self._engine.validate(row)
        return row
