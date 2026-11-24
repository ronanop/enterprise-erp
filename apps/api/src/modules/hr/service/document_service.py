"""Employee document service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.enums import HrEntityType
from modules.hr.models import HrEmployeeDocument
from modules.hr.repository.employee_document_repository import EmployeeDocumentRepository
from modules.hr.service.document_number_service import DocumentNumberService
from modules.hr.service.engines import EmployeeDocumentEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator


class EmployeeDocumentService:
    def __init__(self, db: Session) -> None:
        self._repo = EmployeeDocumentRepository(db)
        self._scope = HrScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = EmployeeDocumentEngine()
        self._master = HrMasterDataAdapter(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Employee document not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, employee_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        doc = self._numbers.generate(
            HrEntityType.EMPLOYEE_DOCUMENT, cid, HrEmployeeDocument, "document_number"
        )
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            document_number=doc,
            **fields,
        )

    def verify(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.verify(row)
        return self._repo.update(ctx, row_id, verification_status=row.verification_status)
