"""ESS workplace task allocation service."""

from __future__ import annotations

import base64
import binascii
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import AppException, ForbiddenException, NotFoundException
from modules.ess.schemas import (
    EssDepartmentDirectoryItem,
    EssEmployeeDirectoryItem,
    EssTaskAssigneeItem,
    EssTaskCompleteBody,
    EssTaskCreate,
    EssTaskEventItem,
    EssTaskItem,
    EssTaskMilestone,
    EssTaskProofItem,
    EssTaskReassign,
    EssTaskRequestRedoBody,
)
from modules.ess.task_proof_storage import (
    MAX_TASK_PROOF_FILES,
    TaskProofDownload,
    load_task_proof,
    save_task_proof_bytes,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.repository.base import utcnow
from modules.hr.repository.workplace_task_repository import (
    WorkplaceTaskAssigneeRepository,
    WorkplaceTaskEventRepository,
    WorkplaceTaskProofRepository,
    WorkplaceTaskRepository,
)
from modules.master_data.models.employee import MasterEmployee
from modules.master_data.repository.employee_repository import EmployeeRepository
from modules.organization.models.company import OrgCompany
from modules.organization.models.hierarchy import OrgDepartment

logger = logging.getLogger(__name__)

ACTIVE_EMP_STATUSES = ("active", "probation", "on_leave", "notice_period")
MAX_ASSIGNEES = 25

ASSIGNEE_MILESTONES = (
    "assigned",
    "accepted",
    "started",
    "in_progress",
    "pending_verification",
    "completed",
)

SUBMITTABLE_STATUSES = frozenset(
    {"accepted", "started", "in_progress", "redo_requested"}
)


def _display_name(first: str, last: str) -> str:
    return f"{(first or '').strip()} {(last or '').strip()}".strip() or "Employee"


def _initials(name: str) -> str:
    parts = [p for p in name.split() if p]
    if not parts:
        return "E"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[1][0]}".upper()


def _decode_file_b64(payload: str) -> bytes:
    data = (payload or "").strip()
    if data.startswith("data:") and "," in data:
        data = data.split(",", 1)[1]
    try:
        raw = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AppException("Invalid file content (base64)") from exc
    if not raw:
        raise AppException("Empty file")
    return raw


class EssTaskService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._employees = EmployeeRepository(db)
        self._tasks = WorkplaceTaskRepository(db)
        self._assignees = WorkplaceTaskAssigneeRepository(db)
        self._events = WorkplaceTaskEventRepository(db)
        self._proofs = WorkplaceTaskProofRepository(db)

    def resolve_employee(self, ctx: TenantContext):
        emp = self._employees.get_by_user_id(ctx, ctx.user_id)
        if emp is None:
            raise NotFoundException("No employee profile linked to this user")
        return emp

    def _author_map(self, employee_ids: list[UUID]) -> dict[UUID, tuple[str, str, str]]:
        if not employee_ids:
            return {}
        rows = self._db.scalars(
            select(MasterEmployee).where(
                MasterEmployee.id.in_(employee_ids),
                MasterEmployee.is_deleted.is_(False),
            )
        ).all()
        out: dict[UUID, tuple[str, str, str]] = {}
        for row in rows:
            name = _display_name(row.first_name, row.last_name)
            out[row.id] = (name, _initials(name), row.employee_code or "")
        return out

    def _company_codes(self, company_ids: list[UUID]) -> dict[UUID, str]:
        if not company_ids:
            return {}
        rows = self._db.scalars(
            select(OrgCompany).where(
                OrgCompany.id.in_(company_ids),
                OrgCompany.is_deleted.is_(False),
            )
        ).all()
        return {r.id: r.company_code for r in rows}

    def _dept_map(self, department_ids: list[UUID]) -> dict[UUID, OrgDepartment]:
        if not department_ids:
            return {}
        rows = self._db.scalars(
            select(OrgDepartment).where(
                OrgDepartment.id.in_(department_ids),
                OrgDepartment.is_deleted.is_(False),
            )
        ).all()
        return {r.id: r for r in rows}

    def _resolve_department_head(
        self, ctx: TenantContext, department: OrgDepartment
    ) -> MasterEmployee | None:
        """Prefer official head; else first active manager in the department."""
        if department.head_employee_id:
            head = self._db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.id == department.head_employee_id,
                    MasterEmployee.tenant_id == ctx.tenant_id,
                    MasterEmployee.is_deleted.is_(False),
                    MasterEmployee.status.in_(ACTIVE_EMP_STATUSES),
                )
            )
            if head is not None:
                return head

        return self._db.scalar(
            select(MasterEmployee)
            .where(
                MasterEmployee.tenant_id == ctx.tenant_id,
                MasterEmployee.department_id == department.id,
                MasterEmployee.is_deleted.is_(False),
                MasterEmployee.status.in_(ACTIVE_EMP_STATUSES),
                MasterEmployee.is_manager.is_(True),
            )
            .order_by(
                MasterEmployee.first_name.asc(),
                MasterEmployee.employee_code.asc(),
            )
            .limit(1)
        )

    def list_departments(
        self, ctx: TenantContext, *, q: str = ""
    ) -> list[EssDepartmentDirectoryItem]:
        needle = (q or "").strip()
        stmt = select(OrgDepartment).where(
            OrgDepartment.tenant_id == ctx.tenant_id,
            OrgDepartment.is_deleted.is_(False),
            OrgDepartment.status.in_(("active", "draft")),
        )
        if needle:
            like = f"%{needle}%"
            stmt = stmt.where(
                or_(
                    OrgDepartment.department_name.ilike(like),
                    OrgDepartment.department_code.ilike(like),
                )
            )
        stmt = stmt.order_by(
            OrgDepartment.department_name.asc(),
            OrgDepartment.department_code.asc(),
        )
        depts = list(self._db.scalars(stmt).all())
        if not depts:
            return []

        member_counts = dict(
            self._db.execute(
                select(MasterEmployee.department_id, func.count())
                .where(
                    MasterEmployee.department_id.in_([d.id for d in depts]),
                    MasterEmployee.tenant_id == ctx.tenant_id,
                    MasterEmployee.is_deleted.is_(False),
                    MasterEmployee.status.in_(ACTIVE_EMP_STATUSES),
                )
                .group_by(MasterEmployee.department_id)
            ).all()
        )
        companies = self._company_codes([d.company_id for d in depts])
        items: list[EssDepartmentDirectoryItem] = []
        for dept in depts:
            members = int(member_counts.get(dept.id, 0) or 0)
            if members <= 0:
                continue
            head = self._resolve_department_head(ctx, dept)
            head_name = ""
            head_code = ""
            if head is not None:
                head_name = _display_name(head.first_name, head.last_name)
                head_code = head.employee_code or ""
            items.append(
                EssDepartmentDirectoryItem(
                    department_id=dept.id,
                    department_code=dept.department_code or "",
                    department_name=dept.department_name or "",
                    company_code=companies.get(dept.company_id, ""),
                    member_count=members,
                    head_employee_id=head.id if head else None,
                    head_name=head_name,
                    head_employee_code=head_code,
                    assignable=head is not None,
                )
            )
        return items

    def search_employees(
        self,
        ctx: TenantContext,
        *,
        q: str = "",
        limit: int = 30,
        department_id: UUID | None = None,
    ) -> list[EssEmployeeDirectoryItem]:
        """Tenant-wide active employee directory for assignee picker."""
        limit = max(1, min(limit, 50))
        needle = (q or "").strip()
        stmt = select(MasterEmployee).where(
            MasterEmployee.tenant_id == ctx.tenant_id,
            MasterEmployee.is_deleted.is_(False),
            MasterEmployee.status.in_(ACTIVE_EMP_STATUSES),
        )
        if department_id is not None:
            stmt = stmt.where(MasterEmployee.department_id == department_id)
        if needle:
            like = f"%{needle}%"
            stmt = stmt.where(
                or_(
                    MasterEmployee.employee_code.ilike(like),
                    MasterEmployee.first_name.ilike(like),
                    MasterEmployee.last_name.ilike(like),
                )
            )
        stmt = stmt.order_by(
            MasterEmployee.first_name.asc(),
            MasterEmployee.last_name.asc(),
            MasterEmployee.employee_code.asc(),
        ).limit(limit)
        rows = list(self._db.scalars(stmt).all())
        companies = self._company_codes([r.company_id for r in rows])
        depts = self._dept_map([r.department_id for r in rows if r.department_id])
        items: list[EssEmployeeDirectoryItem] = []
        for row in rows:
            name = _display_name(row.first_name, row.last_name)
            dept = depts.get(row.department_id) if row.department_id else None
            items.append(
                EssEmployeeDirectoryItem(
                    employee_id=row.id,
                    employee_code=row.employee_code or "",
                    name=name,
                    initials=_initials(name),
                    company_code=companies.get(row.company_id, ""),
                    designation=row.designation or "",
                    is_manager=bool(row.is_manager),
                    department_id=row.department_id,
                    department_name=(dept.department_name if dept else "") or "",
                )
            )
        return items

    def _proof_items(
        self, task_id: UUID, proofs
    ) -> dict[UUID, list[EssTaskProofItem]]:
        by_assignee: dict[UUID, list[EssTaskProofItem]] = {}
        for p in proofs or []:
            by_assignee.setdefault(p.assignee_id, []).append(
                EssTaskProofItem(
                    id=p.id,
                    assignee_id=p.assignee_id,
                    file_name=p.file_name,
                    content_type=p.content_type or "",
                    byte_size=int(p.byte_size or 0),
                    note=p.note or "",
                    download_path=f"/ess/tasks/{task_id}/proofs/{p.id}/download",
                    created_at=p.created_at,
                )
            )
        return by_assignee

    def _assignee_items(
        self,
        assignees,
        authors: dict[UUID, tuple[str, str, str]],
        *,
        proofs_by_assignee: dict[UUID, list[EssTaskProofItem]] | None = None,
    ) -> list[EssTaskAssigneeItem]:
        items: list[EssTaskAssigneeItem] = []
        proof_map = proofs_by_assignee or {}
        for a in assignees:
            name, initials, code = authors.get(
                a.employee_id, ("Employee", "E", "")
            )
            items.append(
                EssTaskAssigneeItem(
                    id=a.id,
                    employee_id=a.employee_id,
                    employee_code=code,
                    name=name,
                    initials=initials,
                    status=a.status,
                    responded_at=a.responded_at,
                    started_at=a.started_at,
                    completed_at=a.completed_at,
                    review_note=getattr(a, "review_note", None) or "",
                    submitted_at=getattr(a, "submitted_at", None),
                    verified_at=getattr(a, "verified_at", None),
                    proofs=proof_map.get(a.id, []),
                    milestones=self._milestones_for(a.status),
                )
            )
        return items

    def _milestones_for(self, status: str) -> list[EssTaskMilestone]:
        order = list(ASSIGNEE_MILESTONES)
        if status == "declined":
            return [
                EssTaskMilestone(key="assigned", label="Assigned", done=True),
                EssTaskMilestone(key="declined", label="Declined", done=True),
                EssTaskMilestone(key="accepted", label="Accepted", done=False),
                EssTaskMilestone(key="started", label="Started", done=False),
                EssTaskMilestone(
                    key="pending_verification", label="Submitted", done=False
                ),
                EssTaskMilestone(key="completed", label="Verified", done=False),
            ]
        if status == "redo_requested":
            return [
                EssTaskMilestone(key="assigned", label="Assigned", done=True),
                EssTaskMilestone(key="accepted", label="Accepted", done=True),
                EssTaskMilestone(key="started", label="Started", done=True),
                EssTaskMilestone(key="in_progress", label="In progress", done=True),
                EssTaskMilestone(
                    key="pending_verification", label="Submitted", done=True
                ),
                EssTaskMilestone(key="redo_requested", label="Redo", done=True),
                EssTaskMilestone(key="completed", label="Verified", done=False),
            ]
        reached: set[str] = set()
        if status in order:
            idx = order.index(status)
            reached = set(order[: idx + 1])
        elif status == "assigned":
            reached = {"assigned"}
        labels = {
            "assigned": "Assigned",
            "accepted": "Accepted",
            "started": "Started",
            "in_progress": "In progress",
            "pending_verification": "Submitted",
            "completed": "Verified",
        }
        return [
            EssTaskMilestone(key=k, label=labels[k], done=k in reached) for k in order
        ]

    def _can_reassign(
        self, ctx: TenantContext, task, me: MasterEmployee
    ) -> bool:
        if getattr(task, "assignment_mode", "users") != "department":
            return False
        if not task.department_id:
            return False
        dept = self._db.scalar(
            select(OrgDepartment).where(
                OrgDepartment.id == task.department_id,
                OrgDepartment.tenant_id == ctx.tenant_id,
                OrgDepartment.is_deleted.is_(False),
            )
        )
        if dept is None:
            return False
        head = self._resolve_department_head(ctx, dept)
        return head is not None and head.id == me.id

    def _to_item(
        self,
        task,
        *,
        creators: dict,
        assignees,
        authors: dict,
        events: list | None = None,
        proofs=None,
        my_employee_id: UUID | None = None,
        me: MasterEmployee | None = None,
        ctx: TenantContext | None = None,
    ) -> EssTaskItem:
        cname, cinit, ccode = creators.get(
            task.creator_employee_id, ("Employee", "E", "")
        )
        proof_map = self._proof_items(task.id, proofs)
        assignee_items = self._assignee_items(
            assignees, authors, proofs_by_assignee=proof_map
        )
        my_status = None
        if my_employee_id:
            for a in assignee_items:
                if a.employee_id == my_employee_id:
                    my_status = a.status
                    break
        event_items: list[EssTaskEventItem] = []
        for ev in events or []:
            aname = None
            if ev.actor_employee_id and ev.actor_employee_id in authors:
                aname = authors[ev.actor_employee_id][0]
            event_items.append(
                EssTaskEventItem(
                    id=ev.id,
                    event_type=ev.event_type,
                    label=ev.label,
                    detail=ev.detail or "",
                    actor_name=aname,
                    created_at=ev.created_at,
                )
            )

        dept_name = ""
        dept_code = ""
        if task.department_id:
            dept = self._dept_map([task.department_id]).get(task.department_id)
            if dept:
                dept_name = dept.department_name or ""
                dept_code = dept.department_code or ""

        can_reassign = False
        if me is not None and ctx is not None:
            can_reassign = self._can_reassign(ctx, task, me)
        can_verify = bool(me is not None and task.creator_employee_id == me.id)

        return EssTaskItem(
            id=task.id,
            title=task.title,
            description=task.description or "",
            deadline=task.deadline,
            status=task.status,
            assignment_mode=getattr(task, "assignment_mode", None) or "users",
            department_id=task.department_id,
            department_name=dept_name,
            department_code=dept_code,
            can_reassign_within_department=can_reassign,
            can_verify=can_verify,
            creator_employee_id=task.creator_employee_id,
            creator_name=cname,
            creator_initials=cinit,
            creator_employee_code=ccode,
            assignee_count=int(task.assignee_count or len(assignee_items)),
            assignees=assignee_items,
            my_assignee_status=my_status,
            events=event_items,
            created_at=task.created_at,
        )

    def list_tasks(
        self, ctx: TenantContext, *, scope: str = "all", limit: int = 50
    ) -> list[EssTaskItem]:
        me = self.resolve_employee(ctx)
        rows = self._tasks.list_for_employee(
            ctx, employee_id=me.id, scope=scope, limit=limit
        )
        task_ids = [r.id for r in rows]
        amap = self._assignees.list_for_tasks(ctx, task_ids)
        pmap = self._proofs.list_for_tasks(ctx, task_ids)
        emp_ids = [r.creator_employee_id for r in rows]
        for alist in amap.values():
            emp_ids.extend(a.employee_id for a in alist)
        authors = self._author_map(emp_ids)
        creators = authors
        return [
            self._to_item(
                row,
                creators=creators,
                assignees=amap.get(row.id, []),
                authors=authors,
                proofs=pmap.get(row.id, []),
                my_employee_id=me.id,
                me=me,
                ctx=ctx,
            )
            for row in rows
        ]

    def get_task(self, ctx: TenantContext, task_id: UUID) -> EssTaskItem:
        me = self.resolve_employee(ctx)
        task = self._tasks.get(ctx, task_id)
        if task is None:
            raise NotFoundException("Task not found")
        assignees = self._assignees.list_for_tasks(ctx, [task.id]).get(task.id, [])
        is_party = task.creator_employee_id == me.id or any(
            a.employee_id == me.id for a in assignees
        )
        is_head = False
        if task.department_id:
            dept = self._db.get(OrgDepartment, task.department_id)
            if dept and not dept.is_deleted:
                head = self._resolve_department_head(ctx, dept)
                is_head = head is not None and head.id == me.id
        if not is_party and not is_head:
            raise ForbiddenException("You do not have access to this task")
        events = self._events.list_for_task(ctx, task.id)
        proofs = self._proofs.list_for_tasks(ctx, [task.id]).get(task.id, [])
        emp_ids = [task.creator_employee_id] + [a.employee_id for a in assignees]
        emp_ids += [e.actor_employee_id for e in events if e.actor_employee_id]
        authors = self._author_map(emp_ids)
        return self._to_item(
            task,
            creators=authors,
            assignees=assignees,
            authors=authors,
            events=events,
            proofs=proofs,
            my_employee_id=me.id,
            me=me,
            ctx=ctx,
        )

    def create_task(self, ctx: TenantContext, body: EssTaskCreate) -> EssTaskItem:
        me = self.resolve_employee(ctx)
        title = (body.title or "").strip()
        if not title:
            raise AppException("Task name is required")
        if len(title) > 200:
            raise AppException("Task name too long (max 200)")
        description = (body.description or "").strip()
        if len(description) > 5000:
            raise AppException("Description too long (max 5000)")

        mode = (body.assignment_mode or "users").strip().lower()
        if mode not in {"users", "department"}:
            raise AppException("Invalid assignment mode")

        deadline = body.deadline
        if deadline is not None:
            now = datetime.now(timezone.utc)
            cmp = (
                deadline
                if deadline.tzinfo is not None
                else deadline.replace(tzinfo=timezone.utc)
            )
            if cmp < now:
                raise AppException("Deadline cannot be in the past")
            deadline = cmp

        department: OrgDepartment | None = None
        people: list[MasterEmployee] = []
        if mode == "department":
            if body.department_id is None:
                raise AppException("Select a department")
            department = self._db.scalar(
                select(OrgDepartment).where(
                    OrgDepartment.id == body.department_id,
                    OrgDepartment.tenant_id == ctx.tenant_id,
                    OrgDepartment.is_deleted.is_(False),
                )
            )
            if department is None:
                raise AppException("Department not found")
            head = self._resolve_department_head(ctx, department)
            if head is None:
                raise AppException(
                    "This department has no head or manager to receive the task"
                )
            people = [head]
        else:
            assignee_ids = list(dict.fromkeys(body.assignee_employee_ids or []))
            if not assignee_ids:
                raise AppException("Select at least one assignee")
            if len(assignee_ids) > MAX_ASSIGNEES:
                raise AppException(f"Maximum {MAX_ASSIGNEES} assignees")
            people = list(
                self._db.scalars(
                    select(MasterEmployee).where(
                        MasterEmployee.id.in_(assignee_ids),
                        MasterEmployee.tenant_id == ctx.tenant_id,
                        MasterEmployee.is_deleted.is_(False),
                        MasterEmployee.status.in_(ACTIVE_EMP_STATUSES),
                    )
                ).all()
            )
            if len(people) != len(assignee_ids):
                raise AppException("One or more assignees are invalid or inactive")

        task = self._tasks.create(
            ctx,
            company_id=me.company_id,
            branch_id=me.branch_id,
            creator_employee_id=me.id,
            title=title,
            description=description,
            deadline=deadline,
            status="open",
            assignee_count=len(people),
            assignment_mode=mode,
            department_id=department.id if department else None,
        )
        for person in people:
            row = self._assignees.create(
                ctx,
                company_id=me.company_id,
                branch_id=me.branch_id,
                task_id=task.id,
                employee_id=person.id,
                status="assigned",
            )
            detail = f"Assigned to {_display_name(person.first_name, person.last_name)}"
            if department is not None:
                detail = (
                    f"Assigned to {department.department_name} head "
                    f"({_display_name(person.first_name, person.last_name)})"
                )
            self._events.create(
                ctx,
                company_id=me.company_id,
                branch_id=me.branch_id,
                task_id=task.id,
                assignee_id=row.id,
                actor_employee_id=me.id,
                event_type="assigned",
                label="Assigned",
                detail=detail,
            )

        created_detail = title
        if department is not None:
            created_detail = f"{title} → {department.department_name}"
        self._events.create(
            ctx,
            company_id=me.company_id,
            branch_id=me.branch_id,
            task_id=task.id,
            assignee_id=None,
            actor_employee_id=me.id,
            event_type="created",
            label="Task created",
            detail=created_detail,
        )
        self._notify_assignees(
            ctx,
            task=task,
            people=people,
            creator_name=_display_name(me.first_name, me.last_name),
            department_name=department.department_name if department else None,
        )
        return self.get_task(ctx, task.id)

    def reassign(
        self, ctx: TenantContext, task_id: UUID, body: EssTaskReassign
    ) -> EssTaskItem:
        me = self.resolve_employee(ctx)
        task = self._tasks.get(ctx, task_id)
        if task is None:
            raise NotFoundException("Task not found")
        if not self._can_reassign(ctx, task, me):
            raise ForbiddenException(
                "Only the department head can reassign this task within the department"
            )
        if task.status == "cancelled":
            raise AppException("Cancelled tasks cannot be reassigned")

        assignee_ids = list(dict.fromkeys(body.assignee_employee_ids or []))
        if not assignee_ids:
            raise AppException("Select at least one assignee")
        if len(assignee_ids) > MAX_ASSIGNEES:
            raise AppException(f"Maximum {MAX_ASSIGNEES} assignees")

        people = list(
            self._db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.id.in_(assignee_ids),
                    MasterEmployee.tenant_id == ctx.tenant_id,
                    MasterEmployee.department_id == task.department_id,
                    MasterEmployee.is_deleted.is_(False),
                    MasterEmployee.status.in_(ACTIVE_EMP_STATUSES),
                )
            ).all()
        )
        if len(people) != len(assignee_ids):
            raise AppException(
                "Assignees must be active employees in the same department"
            )

        existing = self._assignees.list_for_tasks(ctx, [task.id]).get(task.id, [])
        for row in existing:
            self._assignees.soft_delete(ctx, row.id)

        for person in people:
            row = self._assignees.create(
                ctx,
                company_id=task.company_id,
                branch_id=task.branch_id,
                task_id=task.id,
                employee_id=person.id,
                status="assigned",
            )
            self._events.create(
                ctx,
                company_id=task.company_id,
                branch_id=task.branch_id,
                task_id=task.id,
                assignee_id=row.id,
                actor_employee_id=me.id,
                event_type="reassigned",
                label="Reassigned",
                detail=(
                    f"Department head reassigned to "
                    f"{_display_name(person.first_name, person.last_name)}"
                ),
            )

        task.assignee_count = len(people)
        task.status = "open"
        task.updated_at = utcnow()
        task.updated_by = ctx.user_id
        self._db.flush()

        self._notify_assignees(
            ctx,
            task=task,
            people=people,
            creator_name=_display_name(me.first_name, me.last_name),
            department_name=None,
        )
        return self.get_task(ctx, task.id)

    def _notify_assignees(
        self,
        ctx,
        *,
        task,
        people,
        creator_name: str,
        department_name: str | None = None,
    ) -> None:
        try:
            from modules.foundation.service.notification_service import NotificationService

            ntf = NotificationService(self._db)
            tpl = ntf.get_or_create_template(
                tenant_id=ctx.tenant_id,
                template_code="ess.task.assigned",
                template_name="ESS Task Assigned",
                channel="in_app",
                body_template="{{body}}",
                subject_template="{{title}}",
                created_by=ctx.user_id,
            )
            for person in people:
                if not person.user_id or person.user_id == ctx.user_id:
                    continue
                body = f"{creator_name} assigned you: {task.title}"
                if department_name:
                    body = (
                        f"{creator_name} assigned a task to {department_name}: "
                        f"{task.title}"
                    )
                ntf.send(
                    tenant_id=ctx.tenant_id,
                    template_id=tpl.id,
                    event_type="ess.task.assigned",
                    recipient_user_id=person.user_id,
                    recipient_address=None,
                    payload_json={
                        "title": "New task assigned",
                        "body": body,
                        "kind": "task",
                        "href": "/MainTabs/Task",
                        "task_id": str(task.id),
                    },
                    created_by=ctx.user_id,
                    channel_override="in_app",
                )
        except Exception:  # noqa: BLE001
            logger.exception("task notify failed task_id=%s", task.id)

    def _mutate_assignee(
        self,
        ctx: TenantContext,
        task_id: UUID,
        *,
        action: str,
    ) -> EssTaskItem:
        me = self.resolve_employee(ctx)
        task = self._tasks.get(ctx, task_id)
        if task is None:
            raise NotFoundException("Task not found")
        row = self._assignees.get_for_employee(ctx, task_id, me.id)
        if row is None:
            raise ForbiddenException("You are not an assignee on this task")

        now = utcnow()
        if action == "accept":
            if row.status != "assigned":
                raise AppException("Only newly assigned tasks can be accepted")
            row.status = "accepted"
            row.responded_at = now
            label, detail, event_type = "Accepted", "Assignee accepted the task", "accepted"
        elif action == "decline":
            if row.status != "assigned":
                raise AppException("Only newly assigned tasks can be declined")
            row.status = "declined"
            row.responded_at = now
            label, detail, event_type = "Declined", "Assignee declined the task", "declined"
        elif action == "start":
            if row.status not in {"accepted", "started"}:
                raise AppException("Accept the task before starting work")
            row.status = "started"
            row.started_at = row.started_at or now
            if task.status == "open":
                task.status = "in_progress"
            label, detail, event_type = "Started", "Work started", "started"
        elif action == "progress":
            if row.status not in {"accepted", "started", "in_progress"}:
                raise AppException("Task is not in a progressable state")
            row.status = "in_progress"
            row.started_at = row.started_at or now
            if task.status == "open":
                task.status = "in_progress"
            label, detail, event_type = "In progress", "Work in progress", "in_progress"
        else:
            raise AppException("Unknown action")

        row.updated_at = now
        row.updated_by = ctx.user_id
        task.updated_at = now
        task.updated_by = ctx.user_id
        self._db.flush()

        self._events.create(
            ctx,
            company_id=task.company_id,
            branch_id=task.branch_id,
            task_id=task.id,
            assignee_id=row.id,
            actor_employee_id=me.id,
            event_type=event_type,
            label=label,
            detail=detail,
        )

        return self.get_task(ctx, task.id)

    def _roll_up_if_verified(
        self, ctx: TenantContext, task, *, actor_employee_id: UUID
    ) -> None:
        assignees = self._assignees.list_for_tasks(ctx, [task.id]).get(task.id, [])
        active = [a for a in assignees if a.status != "declined"]
        if active and all(a.status == "completed" for a in active):
            task.status = "completed"
            task.updated_at = utcnow()
            task.updated_by = ctx.user_id
            self._db.flush()
            self._events.create(
                ctx,
                company_id=task.company_id,
                branch_id=task.branch_id,
                task_id=task.id,
                assignee_id=None,
                actor_employee_id=actor_employee_id,
                event_type="task_completed",
                label="Task completed",
                detail="All assignees verified",
            )

    def accept(self, ctx: TenantContext, task_id: UUID) -> EssTaskItem:
        return self._mutate_assignee(ctx, task_id, action="accept")

    def decline(self, ctx: TenantContext, task_id: UUID) -> EssTaskItem:
        return self._mutate_assignee(ctx, task_id, action="decline")

    def start(self, ctx: TenantContext, task_id: UUID) -> EssTaskItem:
        return self._mutate_assignee(ctx, task_id, action="start")

    def progress(self, ctx: TenantContext, task_id: UUID) -> EssTaskItem:
        return self._mutate_assignee(ctx, task_id, action="progress")

    def complete(
        self, ctx: TenantContext, task_id: UUID, body: EssTaskCompleteBody
    ) -> EssTaskItem:
        me = self.resolve_employee(ctx)
        task = self._tasks.get(ctx, task_id)
        if task is None:
            raise NotFoundException("Task not found")
        row = self._assignees.get_for_employee(ctx, task_id, me.id)
        if row is None:
            raise ForbiddenException("You are not an assignee on this task")
        if row.status not in SUBMITTABLE_STATUSES:
            raise AppException("Task cannot be submitted from current state")

        files = body.files or []
        if not files:
            raise AppException("At least one proof file is required")
        if len(files) > MAX_TASK_PROOF_FILES:
            raise AppException(f"Maximum {MAX_TASK_PROOF_FILES} proof files allowed")

        note = (body.note or "").strip()
        if len(note) > 2000:
            raise AppException("Note too long (max 2000)")

        # Replace any prior proofs for this assignee (resubmit after redo).
        self._proofs.soft_delete_for_assignee(ctx, row.id)

        for item in files:
            raw = _decode_file_b64(item.file_base64)
            uri, safe_name, media_type, byte_size = save_task_proof_bytes(
                company_id=task.company_id,
                task_id=task.id,
                assignee_id=row.id,
                file_name=item.file_name,
                raw=raw,
                content_type=item.content_type,
            )
            self._proofs.create(
                ctx,
                company_id=task.company_id,
                branch_id=task.branch_id,
                task_id=task.id,
                assignee_id=row.id,
                storage_uri=uri,
                file_name=safe_name or item.file_name,
                content_type=media_type,
                byte_size=byte_size,
                uploaded_by_employee_id=me.id,
                note=note,
            )

        now = utcnow()
        row.status = "pending_verification"
        row.submitted_at = now
        row.completed_at = None
        row.verified_at = None
        row.verified_by_employee_id = None
        row.review_note = ""
        row.started_at = row.started_at or now
        row.updated_at = now
        row.updated_by = ctx.user_id
        if task.status == "open":
            task.status = "in_progress"
        elif task.status == "completed":
            task.status = "in_progress"
        task.updated_at = now
        task.updated_by = ctx.user_id
        self._db.flush()

        detail = f"Submitted {len(files)} proof file(s) for verification"
        if note:
            detail = f"{detail}. Note: {note}"
        self._events.create(
            ctx,
            company_id=task.company_id,
            branch_id=task.branch_id,
            task_id=task.id,
            assignee_id=row.id,
            actor_employee_id=me.id,
            event_type="proof_submitted",
            label="Proof submitted",
            detail=detail,
        )
        return self.get_task(ctx, task.id)

    def verify_assignee(
        self, ctx: TenantContext, task_id: UUID, assignee_id: UUID
    ) -> EssTaskItem:
        me = self.resolve_employee(ctx)
        task = self._tasks.get(ctx, task_id)
        if task is None:
            raise NotFoundException("Task not found")
        if task.creator_employee_id != me.id:
            raise ForbiddenException("Only the task assigner can verify proof")
        row = self._assignees.get(ctx, assignee_id)
        if row is None or row.task_id != task.id:
            raise NotFoundException("Assignee not found on this task")
        if row.status != "pending_verification":
            raise AppException("Assignee is not awaiting verification")

        proofs = self._proofs.list_for_assignee(ctx, row.id)
        if not proofs:
            raise AppException("No proof files found for this submission")

        now = utcnow()
        row.status = "completed"
        row.completed_at = now
        row.verified_at = now
        row.verified_by_employee_id = me.id
        row.review_note = ""
        row.updated_at = now
        row.updated_by = ctx.user_id
        task.updated_at = now
        task.updated_by = ctx.user_id
        self._db.flush()

        self._events.create(
            ctx,
            company_id=task.company_id,
            branch_id=task.branch_id,
            task_id=task.id,
            assignee_id=row.id,
            actor_employee_id=me.id,
            event_type="proof_verified",
            label="Proof verified",
            detail="Assigner verified the submitted proof",
        )
        self._roll_up_if_verified(ctx, task, actor_employee_id=me.id)
        return self.get_task(ctx, task.id)

    def request_redo(
        self,
        ctx: TenantContext,
        task_id: UUID,
        assignee_id: UUID,
        body: EssTaskRequestRedoBody,
    ) -> EssTaskItem:
        me = self.resolve_employee(ctx)
        task = self._tasks.get(ctx, task_id)
        if task is None:
            raise NotFoundException("Task not found")
        if task.creator_employee_id != me.id:
            raise ForbiddenException("Only the task assigner can request a redo")
        row = self._assignees.get(ctx, assignee_id)
        if row is None or row.task_id != task.id:
            raise NotFoundException("Assignee not found on this task")
        if row.status != "pending_verification":
            raise AppException("Assignee is not awaiting verification")

        reason = (body.reason or "").strip()
        if not reason:
            raise AppException("Redo reason is required")
        if len(reason) > 2000:
            raise AppException("Reason too long (max 2000)")

        now = utcnow()
        edits: list[str] = []
        if body.title is not None:
            title = body.title.strip()
            if not title:
                raise AppException("Task name cannot be empty")
            if len(title) > 200:
                raise AppException("Task name too long (max 200)")
            if title != task.title:
                task.title = title
                edits.append("title")
        if body.description is not None:
            description = body.description.strip()
            if len(description) > 5000:
                raise AppException("Description too long (max 5000)")
            if description != (task.description or ""):
                task.description = description
                edits.append("description")
        if "deadline" in body.model_fields_set:
            deadline = body.deadline
            if deadline is not None:
                cmp = (
                    deadline
                    if deadline.tzinfo is not None
                    else deadline.replace(tzinfo=timezone.utc)
                )
                if cmp < datetime.now(timezone.utc):
                    raise AppException("Deadline cannot be in the past")
                deadline = cmp
            if deadline != task.deadline:
                task.deadline = deadline
                edits.append("deadline")

        row.status = "redo_requested"
        row.review_note = reason
        row.completed_at = None
        row.verified_at = None
        row.verified_by_employee_id = None
        row.updated_at = now
        row.updated_by = ctx.user_id
        if task.status == "completed":
            task.status = "in_progress"
        elif task.status == "open":
            task.status = "in_progress"
        task.updated_at = now
        task.updated_by = ctx.user_id
        self._db.flush()

        detail = reason
        if edits:
            detail = f"{reason} (updated: {', '.join(edits)})"
        self._events.create(
            ctx,
            company_id=task.company_id,
            branch_id=task.branch_id,
            task_id=task.id,
            assignee_id=row.id,
            actor_employee_id=me.id,
            event_type="redo_requested",
            label="Redo requested",
            detail=detail,
        )
        return self.get_task(ctx, task.id)

    def resolve_proof_download(
        self, ctx: TenantContext, task_id: UUID, proof_id: UUID
    ) -> TaskProofDownload:
        me = self.resolve_employee(ctx)
        task = self._tasks.get(ctx, task_id)
        if task is None:
            raise NotFoundException("Task not found")
        proof = self._proofs.get(ctx, proof_id)
        if proof is None or proof.task_id != task.id:
            raise NotFoundException("Proof not found")
        assignees = self._assignees.list_for_tasks(ctx, [task.id]).get(task.id, [])
        is_party = task.creator_employee_id == me.id or any(
            a.employee_id == me.id for a in assignees
        )
        if not is_party:
            raise ForbiddenException("You do not have access to this proof")
        return load_task_proof(proof.storage_uri, proof.file_name)
