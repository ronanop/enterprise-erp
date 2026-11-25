# DBS — HR Workplace Task (ESS allocation)

**Schema:** `hr`  
**Prefix:** `hr_workplace_task`  
**Standards:** UUID PK, audit columns, soft delete, tenant/company/branch, Alembic-only

## Tables

| Table | Notes |
|-------|-------|
| `hr_workplace_task` | Title, description, deadline, creator, roll-up `status` (`open` / `in_progress` / `completed` / `cancelled`) |
| `hr_workplace_task_assignee` | Per-person allocation; unique `(task_id, employee_id)`; status `assigned` → `accepted` / `declined` / `transferred` → work → `pending_verification` → `completed` (or `redo_requested`) |
| `hr_workplace_task_event` | Milestone / audit trail |

## Assignee response (pending `assigned`)

| Action | Effect |
|--------|--------|
| Accept | Status → `started`, work timer begins |
| Reject (`decline`) | Status → `declined`; creator notified |
| Transfer | Status → `transferred`; new person or department head gets `assigned`; creator + new assignee notified |

## API

Employee routes under `/api/v1/ess/tasks*` + `/api/v1/ess/employees?q=` + `/api/v1/ess/departments` + `POST /ess/tasks/{id}/transfer`.
