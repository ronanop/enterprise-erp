"""Separation service — completes via Master Data identity sync; FNF via payroll."""

import copy
from datetime import date, datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session
from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.enums import HrEntityType, NoticeStatus
from modules.hr.domain.exceptions import InvalidEmploymentState, InvalidSeparationState
from modules.hr.models import HrEmployment, HrSeparation
from modules.hr.repository.separation_repository import SeparationRepository
from modules.hr.service.document_number_service import DocumentNumberService
from modules.hr.service.engines import EmploymentEngine, SeparationEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator

DEFAULT_CHECKLIST = [
    {"key": "assets", "label": "Asset return", "done": False, "notes": None},
    {"key": "it", "label": "IT access revocation", "done": False, "notes": None},
    {"key": "finance", "label": "Finance clearance", "done": False, "notes": None},
    {"key": "hr", "label": "HR clearance", "done": False, "notes": None},
    {"key": "exit_interview", "label": "Exit interview", "done": False, "notes": None},
]

# Maps approval stage → checklist key auto-cleared on that approval
_STAGE_CHECKLIST_KEY = {
    "it": "it",
    "accounts": "finance",
    "hr": "hr",
}

NOTICE_TYPES = {"resignation", "retirement"}
EXITED_NOTICE = {
    NoticeStatus.SERVED.value,
    NoticeStatus.NOT_SERVED.value,
    NoticeStatus.DIRECT_EXIT.value,
}


def default_notice_status(separation_type: str, serve_notice: bool | None) -> str:
    if serve_notice is True:
        return NoticeStatus.PENDING.value
    if serve_notice is False:
        return NoticeStatus.NOT_APPLICABLE.value
    if (separation_type or "").lower() in NOTICE_TYPES:
        return NoticeStatus.PENDING.value
    return NoticeStatus.NOT_APPLICABLE.value


def default_clearance() -> dict:
    return {
        "checklist": [dict(item) for item in DEFAULT_CHECKLIST],
        "exit_interview": None,
        "documents": [],
        "approvals": [],
    }


def _append_approval_artifact(
    clearance: dict,
    *,
    stage: str,
    remarks: str | None,
    file_name: str | None,
    file_data_url: str | None,
    user_id: object | None,
) -> dict:
    """Record remarks / attachment for submit or an approval stage."""
    note = (remarks or "").strip() or None
    fname = (file_name or "").strip() or None
    fdata = (file_data_url or "").strip() or None
    if not note and not fname and not fdata:
        return clearance

    approvals = list(clearance.get("approvals") or [])
    entry = {
        "id": str(uuid4()),
        "stage": stage,
        "remarks": note,
        "file_name": fname,
        "file_data_url": fdata,
        "at": datetime.now(timezone.utc).isoformat(),
        "by": str(user_id) if user_id else None,
    }
    approvals.append(entry)
    clearance["approvals"] = approvals

    if fname or fdata:
        docs = list(clearance.get("documents") or [])
        docs.append(
            {
                "id": str(uuid4()),
                "name": fname or f"{stage} approval attachment",
                "doc_type": f"approval_{stage}",
                "notes": note,
                "file_name": fname,
                "file_data_url": fdata,
                "uploaded_at": entry["at"],
                "uploaded_by": entry["by"],
            }
        )
        clearance["documents"] = docs
    return clearance


class SeparationService:
    def __init__(self, db: Session) -> None:
        self._repo = SeparationRepository(db)
        self._scope = HrScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = SeparationEngine()
        self._master = HrMasterDataAdapter(db)
        self._audit = AuditService(db)
        self._db = db

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Separation not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, employee_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        doc = self._numbers.generate(HrEntityType.SEPARATION, cid, HrSeparation, "document_number")
        clearance = fields.pop("clearance_json", None) or default_clearance()
        if "checklist" not in clearance:
            clearance = {**default_clearance(), **clearance}
        serve_notice = fields.pop("serve_notice", None)
        sep_type = str(fields.get("separation_type") or "resignation")
        employment = self._find_employment(ctx, cid, employee_id)
        notice_days = fields.get("notice_period_days")
        if notice_days is None and employment is not None:
            notice_days = employment.notice_period_days
        resignation_date = fields.get("resignation_date") or date.today()
        requested = fields.get("requested_last_working_date")
        expected = fields.get("expected_exit_date")
        if expected is None and requested is not None:
            expected = requested
        elif expected is None and notice_days:
            expected = resignation_date + timedelta(days=int(notice_days))
        initiated_by = fields.get("initiated_by") or "hr"
        notice_status = default_notice_status(sep_type, serve_notice)
        fields["resignation_date"] = resignation_date
        fields["notice_period_days"] = notice_days
        fields["expected_exit_date"] = expected
        fields["initiated_by"] = initiated_by
        fields["notice_status"] = notice_status
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            document_number=doc,
            clearance_json=clearance,
            **fields,
        )

    def submit(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        remarks: str | None = None,
        file_name: str | None = None,
        file_data_url: str | None = None,
    ):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        clearance = self._clearance_for_update(row)
        clearance = _append_approval_artifact(
            clearance,
            stage="submitted",
            remarks=remarks,
            file_name=file_name,
            file_data_url=file_data_url,
            user_id=ctx.user_id,
        )
        updated = self._repo.update(ctx, row_id, status=row.status, clearance_json=clearance)
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.separation_submitted",
                template_name="Separation Submitted",
                event_type="hr.separation_submitted",
                title="Exit request submitted",
                body=f"Your offboarding case {row.document_number} was submitted and is pending manager approval.",
                kind="separation",
                extra={"separation_id": str(row.id), "document_number": row.document_number},
                cc_reporting_manager=True,
            )
        except Exception:
            pass
        return updated

    def approve(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        stage: str = "manager",
        remarks: str | None = None,
        file_name: str | None = None,
        file_data_url: str | None = None,
    ):
        row = self.get(ctx, row_id)
        stage_key = (stage or "manager").strip().lower()
        if stage_key == "manager":
            self._engine.manager_approve(row)
        elif stage_key in {"it", "it_approved"}:
            self._engine.it_approve(row)
            stage_key = "it"
        elif stage_key in {"accounts", "accounts_approved", "finance"}:
            self._engine.accounts_approve(row)
            stage_key = "accounts"
        elif stage_key in {"hr", "hr_approved"}:
            self._engine.hr_approve(row)
            stage_key = "hr"
        else:
            raise InvalidSeparationState(
                "stage must be one of: manager, it, accounts, hr"
            )

        update_kwargs: dict = {"status": row.status}
        clearance = self._clearance_for_update(row)
        checklist_key = _STAGE_CHECKLIST_KEY.get(stage_key)
        if checklist_key:
            new_checklist: list[dict] = []
            for item in clearance.get("checklist") or []:
                entry = dict(item)
                if str(entry.get("key")) == checklist_key:
                    entry["done"] = True
                    entry["notes"] = (
                        (remarks or "").strip()
                        or entry.get("notes")
                        or f"Auto-cleared on {stage_key} approval"
                    )
                new_checklist.append(entry)
            clearance["checklist"] = new_checklist

        clearance = _append_approval_artifact(
            clearance,
            stage=stage_key,
            remarks=remarks,
            file_name=file_name,
            file_data_url=file_data_url,
            user_id=ctx.user_id,
        )
        update_kwargs["clearance_json"] = clearance

        updated = self._repo.update(ctx, row_id, **update_kwargs)
        try:
            from modules.hr.service.hr_notify import notify_employee, notify_users_with_permission

            doc = row.document_number
            if stage_key == "manager":
                notify_employee(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    employee_id=row.employee_id,
                    template_code="hr.separation_manager_approved",
                    template_name="Exit Manager Approved",
                    event_type="hr.separation_manager_approved",
                    title="Exit request approved by manager",
                    body=(
                        f"Your offboarding case {doc} was approved by your reporting manager. "
                        "IT approval is pending."
                    ),
                    kind="separation",
                    extra={"separation_id": str(row.id), "document_number": doc},
                    cc_reporting_manager=False,
                )
                notify_users_with_permission(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    permission_code="hr.separation:approve",
                    template_code="hr.separation_pending_it",
                    template_name="Exit Pending IT",
                    event_type="hr.separation_pending_it",
                    title="Exit approved by manager — IT action needed",
                    body=f"Offboarding {doc} was approved by the reporting manager. Please complete IT approval.",
                    kind="separation",
                    extra={"separation_id": str(row.id), "document_number": doc},
                    exclude_user_ids={ctx.user_id} if ctx.user_id else None,
                )
            elif stage_key == "it":
                notify_users_with_permission(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    permission_code="hr.separation:approve",
                    template_code="hr.separation_pending_accounts",
                    template_name="Exit Pending Accounts",
                    event_type="hr.separation_pending_accounts",
                    title="Exit IT approved — Accounts action needed",
                    body=f"Offboarding {doc} was approved by IT. Please complete Accounts approval.",
                    kind="separation",
                    extra={"separation_id": str(row.id), "document_number": doc},
                    exclude_user_ids={ctx.user_id} if ctx.user_id else None,
                )
            elif stage_key == "accounts":
                notify_users_with_permission(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    permission_code="hr.separation:approve",
                    template_code="hr.separation_pending_hr",
                    template_name="Exit Pending HR",
                    event_type="hr.separation_pending_hr",
                    title="Exit Accounts approved — HR action needed",
                    body=f"Offboarding {doc} was approved by Accounts. Please complete HR approval.",
                    kind="separation",
                    extra={"separation_id": str(row.id), "document_number": doc},
                    exclude_user_ids={ctx.user_id} if ctx.user_id else None,
                )
            else:
                notify_employee(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    employee_id=row.employee_id,
                    template_code="hr.separation_hr_approved",
                    template_name="Exit HR Approved",
                    event_type="hr.separation_hr_approved",
                    title="Exit request approved by HR",
                    body=(
                        f"Your offboarding case {doc} was approved by HR. "
                        "Exit interview, documents, and full & final settlement will follow."
                    ),
                    kind="separation",
                    extra={"separation_id": str(row.id), "document_number": doc},
                    cc_reporting_manager=False,
                )
        except Exception:
            pass
        if stage_key == "manager" and (updated.notice_status or "") == NoticeStatus.PENDING.value:
            try:
                updated = self.start_notice(ctx, row_id)
            except InvalidSeparationState:
                pass
        if stage_key == "hr":
            self._notify_fnf_after_hr(ctx, updated)
        return updated

    def start_notice(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        notice_period_days: int | None = None,
        notice_start_date: date | None = None,
    ):
        row = self.get(ctx, row_id)
        if row.status in {"draft", "cancelled", "completed"}:
            raise InvalidSeparationState("Submit the exit request before starting notice")
        if row.notice_status in EXITED_NOTICE:
            raise InvalidSeparationState(f"Cannot start notice when status is {row.notice_status}")
        days = notice_period_days if notice_period_days is not None else row.notice_period_days
        if days is None:
            emp = self._find_employment(ctx, row.company_id, row.employee_id)
            days = emp.notice_period_days if emp is not None else 30
        start = notice_start_date or date.today()
        expected = row.expected_exit_date or row.requested_last_working_date or (
            start + timedelta(days=int(days or 0))
        )
        self._sync_employment_notice(ctx, row)
        updated = self._repo.update(
            ctx,
            row_id,
            notice_status=NoticeStatus.ON_NOTICE.value,
            notice_period_days=int(days or 0),
            notice_start_date=start,
            expected_exit_date=expected,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="start_notice",
            performed_by=ctx.user_id,
            new_value={"notice_start_date": str(start), "expected_exit_date": str(expected)},
        )
        try:
            from modules.hr.service.hr_notify import notify_employee, notify_users_with_permission

            doc = row.document_number
            lwd = expected.isoformat() if expected else ""
            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.exit_on_notice",
                template_name="On Notice",
                event_type="hr.exit_on_notice",
                title="You are On Notice",
                body=(
                    f"Offboarding {doc}: you are serving notice until {lwd}. "
                    "Manager, IT, Accounts, and HR approvals continue in parallel."
                ),
                kind="separation",
                extra={
                    "separation_id": str(row.id),
                    "document_number": doc,
                    "href": "/hr/separation",
                },
            )
            notify_users_with_permission(
                self._db,
                tenant_id=ctx.tenant_id,
                permission_code="hr.separation:read",
                template_code="hr.exit_on_notice_hr",
                template_name="Employee On Notice",
                event_type="hr.exit_on_notice",
                title=f"On Notice — {doc}",
                body=f"Employee is On Notice until {lwd}. Complete remaining exit approvals.",
                kind="separation",
                extra={"separation_id": str(row.id), "document_number": doc, "href": "/hr/separation"},
                exclude_user_ids={ctx.user_id} if ctx.user_id else None,
            )
        except Exception:
            pass
        return updated

    def mark_direct_exit(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        remarks: str | None = None,
        last_working_date: date | None = None,
    ):
        row = self.get(ctx, row_id)
        if row.status in {"cancelled", "completed"}:
            raise InvalidSeparationState("Cannot mark direct exit on this case")
        if row.notice_status == NoticeStatus.SERVED.value:
            raise InvalidSeparationState("Notice already served")
        lwd = last_working_date or date.today()
        from_on_notice = row.notice_status == NoticeStatus.ON_NOTICE.value
        notice_status = (
            NoticeStatus.NOT_SERVED.value if from_on_notice else NoticeStatus.DIRECT_EXIT.value
        )
        self._sync_employment_separated(ctx, row)
        updated = self._repo.update(
            ctx,
            row_id,
            notice_status=notice_status,
            approved_last_working_date=lwd,
            expected_exit_date=lwd,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="direct_exit",
            performed_by=ctx.user_id,
            new_value={"notice_status": notice_status, "last_working_date": str(lwd), "remarks": remarks},
        )
        try:
            from modules.hr.service.hr_notify import notify_employee

            doc = row.document_number
            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.exit_direct",
                template_name="Direct Exit",
                event_type="hr.exit_direct",
                title="Marked as directly exited",
                body=(
                    f"Offboarding {doc} was marked as a direct exit"
                    + (" without serving remaining notice." if from_on_notice else " (notice not served).")
                    + " Full & final settlement will follow."
                ),
                kind="separation",
                extra={"separation_id": str(row.id), "document_number": doc, "href": "/hr/separation"},
            )
        except Exception:
            pass
        self._notify_fnf_pending(ctx, updated)
        return updated

    def confirm_last_working_day(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        last_working_date: date | None = None,
        remarks: str | None = None,
    ):
        row = self.get(ctx, row_id)
        if row.notice_status != NoticeStatus.ON_NOTICE.value:
            raise InvalidSeparationState("Confirm last working day only while On Notice")
        lwd = last_working_date or row.expected_exit_date or row.requested_last_working_date or date.today()
        self._sync_employment_separated(ctx, row)
        updated = self._repo.update(
            ctx,
            row_id,
            notice_status=NoticeStatus.SERVED.value,
            approved_last_working_date=lwd,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="confirm_lwd",
            performed_by=ctx.user_id,
            new_value={"last_working_date": str(lwd), "remarks": remarks},
        )
        self._notify_fnf_pending(ctx, updated)
        return updated

    def _find_employment(self, ctx: TenantContext, company_id: UUID, employee_id: UUID):
        stmt = select(HrEmployment).where(
            HrEmployment.company_id == company_id,
            HrEmployment.employee_id == employee_id,
            HrEmployment.is_deleted.is_(False),
        )
        rows = list(self._db.scalars(stmt).all())
        if not rows:
            return None
        rank = {s: i for i, s in enumerate(
            (
                *EmploymentEngine.ACTIVE_SET,
                "separated",
            )
        )}
        rows.sort(key=lambda r: rank.get(r.status, 99))
        return rows[0]

    def _sync_employment_notice(self, ctx: TenantContext, row: HrSeparation) -> None:
        from modules.hr.service.employment_service import EmploymentService

        emp = self._find_employment(ctx, row.company_id, row.employee_id)
        if emp is None:
            return
        try:
            EmploymentService(self._db).start_notice(ctx, emp.id)
        except (InvalidEmploymentState, Exception):
            try:
                self._master.update_employee_status(ctx, row.employee_id, "notice_period")
            except Exception:
                pass

    def _sync_employment_separated(self, ctx: TenantContext, row: HrSeparation) -> None:
        from modules.hr.service.employment_service import EmploymentService

        emp = self._find_employment(ctx, row.company_id, row.employee_id)
        if emp is not None:
            try:
                EmploymentService(self._db).mark_separated(ctx, emp.id)
            except (InvalidEmploymentState, Exception):
                pass
        status = "terminated" if row.separation_type in {"termination", "death"} else "resigned"
        try:
            self._master.update_employee_status(ctx, row.employee_id, status)
        except Exception:
            pass

    def _notify_fnf_after_hr(self, ctx: TenantContext, row: HrSeparation) -> None:
        if row.fnf_status in {"settled", "waived"}:
            return
        if (row.notice_status or "") in EXITED_NOTICE:
            self._notify_fnf_pending(ctx, row)
            return
        if (row.notice_status or "") == NoticeStatus.ON_NOTICE.value:
            try:
                from modules.hr.service.hr_notify import notify_employee, notify_users_with_permission

                lwd = (row.expected_exit_date or row.requested_last_working_date)
                lwd_s = lwd.isoformat() if lwd else "last working day"
                notify_employee(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    employee_id=row.employee_id,
                    template_code="hr.fnf_scheduled",
                    template_name="FNF After Notice",
                    event_type="hr.fnf_scheduled",
                    title="FNF will be due after notice",
                    body=(
                        f"HR approved offboarding {row.document_number}. "
                        f"Full & final settlement will be pending from {lwd_s}."
                    ),
                    kind="separation",
                    extra={"separation_id": str(row.id), "document_number": row.document_number},
                )
                notify_users_with_permission(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    permission_code="hr.separation:complete",
                    template_code="hr.fnf_scheduled_hr",
                    template_name="FNF After Notice",
                    event_type="hr.fnf_scheduled",
                    title=f"FNF scheduled — {row.document_number}",
                    body=f"Employee is On Notice. Prepare FNF after {lwd_s}.",
                    kind="separation",
                    extra={"separation_id": str(row.id), "href": "/hr/separation"},
                    exclude_user_ids={ctx.user_id} if ctx.user_id else None,
                )
            except Exception:
                pass

    def _notify_fnf_pending(self, ctx: TenantContext, row: HrSeparation) -> None:
        if row.fnf_status in {"settled", "waived"}:
            return
        try:
            from modules.hr.service.hr_notify import notify_employee, notify_users_with_permission

            doc = row.document_number
            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.fnf_pending",
                template_name="FNF Pending",
                event_type="hr.fnf_pending",
                title="Full & final settlement is pending",
                body=(
                    f"FNF for offboarding {doc} is pending. "
                    "HR will prepare and settle your full & final after clearance."
                ),
                kind="separation",
                extra={"separation_id": str(row.id), "document_number": doc, "href": "/ess/inbox"},
            )
            notify_users_with_permission(
                self._db,
                tenant_id=ctx.tenant_id,
                permission_code="hr.separation:complete",
                template_code="hr.fnf_pending_hr",
                template_name="FNF Pending",
                event_type="hr.fnf_pending",
                title=f"FNF pending — {doc}",
                body="Employee has exited. Prepare and settle full & final.",
                kind="separation",
                extra={"separation_id": str(row.id), "document_number": doc, "href": "/hr/separation"},
                exclude_user_ids={ctx.user_id} if ctx.user_id else None,
            )
        except Exception:
            pass

    def _ensure_clearance(self, row: HrSeparation) -> dict:
        clearance = dict(row.clearance_json or {})
        if not isinstance(clearance.get("checklist"), list) or not clearance["checklist"]:
            clearance = {**default_clearance(), **{k: v for k, v in clearance.items() if k != "checklist"}}
            if "exit_interview" not in clearance:
                clearance["exit_interview"] = None
        if not isinstance(clearance.get("documents"), list):
            clearance["documents"] = []
        if not isinstance(clearance.get("approvals"), list):
            clearance["approvals"] = []
        return clearance

    def _clearance_for_update(self, row: HrSeparation) -> dict:
        """Deep copy so JSONB mutations always persist (avoid in-place ORM aliasing)."""
        return copy.deepcopy(self._ensure_clearance(row))

    def update_checklist(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        item_key: str,
        done: bool,
        notes: str | None = None,
    ):
        row = self.get(ctx, row_id)
        clearance = self._clearance_for_update(row)
        checklist = clearance.get("checklist") or []
        found = False
        new_checklist: list[dict] = []
        for item in checklist:
            entry = dict(item)
            if str(entry.get("key")) == item_key:
                entry["done"] = bool(done)
                if notes is not None:
                    entry["notes"] = notes
                found = True
            new_checklist.append(entry)
        if not found:
            raise AppException(f"Unknown checklist item '{item_key}'")
        clearance["checklist"] = new_checklist
        updated = self._repo.update(ctx, row_id, clearance_json=clearance)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="checklist_update",
            performed_by=ctx.user_id,
            new_value={"item_key": item_key, "done": done},
        )
        return updated

    def save_exit_interview(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        answers: dict,
        interviewer_notes: str | None = None,
    ):
        row = self.get(ctx, row_id)
        if row.status != "hr_approved":
            raise InvalidSeparationState("Exit interview can be recorded after HR approval")
        clearance = self._clearance_for_update(row)
        clearance["exit_interview"] = {
            "answers": answers,
            "interviewer_notes": interviewer_notes,
            "completed_at": date.today().isoformat(),
            "completed_by": str(ctx.user_id) if ctx.user_id else None,
        }
        new_checklist: list[dict] = []
        for item in clearance.get("checklist") or []:
            entry = dict(item)
            if str(entry.get("key")) == "exit_interview":
                entry["done"] = True
            new_checklist.append(entry)
        clearance["checklist"] = new_checklist
        updated = self._repo.update(ctx, row_id, clearance_json=clearance)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="exit_interview",
            performed_by=ctx.user_id,
        )
        return updated

    def add_document(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        name: str,
        doc_type: str = "other",
        notes: str | None = None,
        file_name: str | None = None,
    ):
        row = self.get(ctx, row_id)
        if row.status not in {
            "hr_approved",
            "accounts_approved",
            "it_approved",
            "manager_approved",
            "completed",
        }:
            raise InvalidSeparationState("Upload exit documents after manager approval")
        if row.status == "completed":
            raise InvalidSeparationState("Cannot upload documents on a completed exit")
        title = (name or "").strip()
        if not title:
            raise InvalidSeparationState("Document name is required")
        clearance = self._clearance_for_update(row)
        docs = list(clearance.get("documents") or [])
        docs.append(
            {
                "id": str(uuid4()),
                "name": title,
                "doc_type": (doc_type or "other").strip().lower() or "other",
                "notes": notes,
                "file_name": file_name,
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                "uploaded_by": str(ctx.user_id) if ctx.user_id else None,
            }
        )
        clearance["documents"] = docs
        updated = self._repo.update(ctx, row_id, clearance_json=clearance)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="exit_document_upload",
            performed_by=ctx.user_id,
            new_value={"name": title, "doc_type": doc_type},
        )
        return updated

    def _ensure_open_payroll_period(self, ctx: TenantContext, company_id: UUID, anchor: date):
        from sqlalchemy import select

        from modules.payroll.models import PayPayrollPeriod
        from modules.payroll.service.payroll_period_service import PayrollPeriodService

        period = self._db.scalar(
            select(PayPayrollPeriod)
            .where(
                PayPayrollPeriod.company_id == company_id,
                PayPayrollPeriod.is_deleted.is_(False),
                PayPayrollPeriod.status.in_(("open", "processing")),
            )
            .order_by(PayPayrollPeriod.start_date.desc())
        )
        if period is not None:
            return period

        y, m = anchor.year, anchor.month
        if m == 12:
            end = date(y, 12, 31)
        else:
            end = date(y, m + 1, 1)
            from datetime import timedelta

            end = end - timedelta(days=1)
        start = date(y, m, 1)
        code = f"{y}-{m:02d}"
        return PayrollPeriodService(self._db).create(
            ctx,
            company_id=company_id,
            branch_id=None,
            period_code=code,
            period_name=f"Payroll {anchor.strftime('%B %Y')}",
            payroll_year=y,
            payroll_month=m,
            start_date=start,
            end_date=end,
            status="open",
        )

    def prepare_fnf(self, ctx: TenantContext, row_id: UUID):
        """Create a final_settlement payroll run, calculate salary, add encashment + gratuity."""
        from decimal import Decimal

        from sqlalchemy import select

        from modules.hr.models import HrEmployment
        from modules.hr.service.fnf_amounts import (
            basic_from_gross,
            compute_gratuity,
            compute_leave_encashment,
            daily_rate_from_gross,
        )
        from modules.payroll.models import PayPayrollRunLine
        from modules.payroll.service.payroll_run_service import PayrollRunService

        row = self.get(ctx, row_id)
        if row.status != "hr_approved":
            raise InvalidSeparationState(
                "FNF can be prepared only after HR approval "
                "(Manager → IT → Accounts → HR)"
            )
        clearance = self._ensure_clearance(row)
        if not clearance.get("exit_interview"):
            raise InvalidSeparationState(
                "Record the exit interview before preparing FNF"
            )
        if row.fnf_status in {"settled", "waived"}:
            raise InvalidSeparationState(f"FNF already {row.fnf_status}")

        lwd = row.approved_last_working_date or row.requested_last_working_date
        period = self._ensure_open_payroll_period(ctx, row.company_id, lwd)
        pay = PayrollRunService(self._db)
        run = pay.create(
            ctx,
            branch_id=row.branch_id,
            company_id=row.company_id,
            payroll_period_id=period.id,
            run_date=lwd,
            run_type="final_settlement",
            currency_code="INR",
            target_employee_id=row.employee_id,
            status="draft",
        )
        calculated = pay.calculate(ctx, run.id)

        employment = self._db.scalar(
            select(HrEmployment).where(
                HrEmployment.employee_id == row.employee_id,
                HrEmployment.company_id == row.company_id,
                HrEmployment.is_deleted.is_(False),
            )
        )
        line = self._db.scalar(
            select(PayPayrollRunLine).where(
                PayPayrollRunLine.payroll_run_id == calculated.id,
                PayPayrollRunLine.employee_id == row.employee_id,
                PayPayrollRunLine.is_deleted.is_(False),
            )
        )
        gross = Decimal("0")
        if line is not None:
            gross = Decimal(str(line.gross_earnings or 0))
        elif employment is not None and employment.ctc_amount:
            gross = Decimal(str(employment.ctc_amount))

        basic = basic_from_gross(gross)
        rate = daily_rate_from_gross(gross)
        encash_days, encash_amount, encash_details = compute_leave_encashment(
            self._db,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            employee_id=row.employee_id,
            daily_rate=rate,
            apply_usage=True,
        )
        doj = employment.date_of_joining if employment else None
        gratuity_amount, years = compute_gratuity(
            date_of_joining=doj,
            last_working_date=lwd,
            basic=basic,
        )
        extra = encash_amount + gratuity_amount

        total_gross = Decimal(str(calculated.total_gross or 0)) + extra
        total_net = Decimal(str(calculated.total_net or 0)) + extra
        if line is not None:
            breakdown = dict(line.component_breakdown_json or {})
            breakdown["leave_encashment"] = float(encash_amount)
            breakdown["gratuity"] = float(gratuity_amount)
            breakdown["encashment_days"] = float(encash_days)
            breakdown["years_of_service"] = years
            line.component_breakdown_json = breakdown
            line.gross_earnings = Decimal(str(line.gross_earnings or 0)) + extra
            line.net_pay = Decimal(str(line.net_pay or 0)) + extra
            self._db.flush()
        elif extra > 0 and employment is not None:
            from modules.payroll.repository.payroll_run_line_repository import (
                PayrollRunLineRepository,
            )
            from modules.payroll.domain.enums import RunLineStatus

            PayrollRunLineRepository(self._db).create(
                ctx,
                company_id=row.company_id,
                branch_id=row.branch_id,
                payroll_run_id=calculated.id,
                employee_id=row.employee_id,
                employee_salary_id=None,
                department_id=None,
                employment_id=employment.id,
                paid_days=Decimal("0"),
                lop_days=Decimal("0"),
                leave_days=Decimal("0"),
                gross_earnings=extra,
                total_deductions=Decimal("0"),
                net_pay=extra,
                employer_contribution=Decimal("0"),
                component_breakdown_json={
                    "leave_encashment": float(encash_amount),
                    "gratuity": float(gratuity_amount),
                    "encashment_days": float(encash_days),
                    "years_of_service": years,
                },
                status=RunLineStatus.CALCULATED.value,
            )
            total_gross = extra
            total_net = extra

        from modules.payroll.repository.payroll_run_repository import PayrollRunRepository

        calculated = PayrollRunRepository(self._db).update(
            ctx,
            calculated.id,
            total_gross=total_gross,
            total_net=total_net,
            employee_count=max(int(calculated.employee_count or 0), 1),
        )

        clearance = dict(row.clearance_json or {})
        clearance["fnf"] = {
            "payroll_run_id": str(calculated.id),
            "document_number": calculated.document_number,
            "total_net": str(calculated.total_net),
            "total_gross": str(calculated.total_gross),
            "leave_encashment_days": str(encash_days),
            "leave_encashment_amount": str(encash_amount),
            "leave_encashment_details": encash_details,
            "gratuity_amount": str(gratuity_amount),
            "years_of_service": years,
            "status": "calculated",
        }
        updated = self._repo.update(
            ctx,
            row_id,
            fnf_status="calculated",
            fnf_payroll_run_id=calculated.id,
            clearance_json=clearance,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="fnf_prepare",
            performed_by=ctx.user_id,
            new_value={
                "fnf_payroll_run_id": str(calculated.id),
                "leave_encashment": str(encash_amount),
                "gratuity": str(gratuity_amount),
            },
        )
        return updated

    def settle_fnf(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.fnf_status not in {"prepared", "calculated"}:
            raise InvalidSeparationState("Prepare FNF before marking it settled")
        clearance = dict(row.clearance_json or {})
        fnf = dict(clearance.get("fnf") or {})
        fnf["status"] = "settled"
        clearance["fnf"] = fnf
        updated = self._repo.update(
            ctx,
            row_id,
            fnf_status="settled",
            clearance_json=clearance,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="fnf_settle",
            performed_by=ctx.user_id,
        )
        return updated

    def waive_fnf(self, ctx: TenantContext, row_id: UUID, *, reason: str | None = None):
        row = self.get(ctx, row_id)
        if row.status != "hr_approved":
            raise InvalidSeparationState("Waive FNF only after HR approval")
        clearance = dict(row.clearance_json or {})
        clearance["fnf"] = {"status": "waived", "reason": reason}
        return self._repo.update(
            ctx,
            row_id,
            fnf_status="waived",
            clearance_json=clearance,
        )

    def complete(self, ctx: TenantContext, row_id: UUID, *, approved_last_working_date: date | None = None):
        row = self.get(ctx, row_id)
        clearance = self._ensure_clearance(row)
        if not clearance.get("exit_interview"):
            raise InvalidSeparationState("Exit interview is required before completing separation")
        if row.fnf_status not in {"settled", "waived"}:
            raise InvalidSeparationState(
                "Settle or waive FNF before completing separation"
            )
        self._engine.complete(row)
        lwd = approved_last_working_date or row.approved_last_working_date or row.requested_last_working_date
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            approved_last_working_date=lwd,
        )
        self._master.complete_separation_identity(
            ctx,
            row.employee_id,
            separation_type=row.separation_type,
            date_of_leaving=lwd,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="complete",
            performed_by=ctx.user_id,
        )
        return updated
