# DBS — HR Workplace Task (ESS allocation)

**Schema:** `hr`  
**Prefix:** `hr_workplace_task`  
**Standards:** UUID PK, audit columns, soft delete, tenant/company/branch, Alembic-only

## Tables

| Table | Notes |
|-------|-------|
| `hr_workplace_task` | Title, description, deadline, creator, roll-up `status` (`open` / `in_progress` / `completed` / `cancelled`) |
| `hr_workplace_task_assignee` | Per-person allocation; unique `(task_id, employee_id)`; status `assigned` → `accepted`/`declined` → `started`/`in_progress` → `completed` |
| `hr_workplace_task_event` | Milestone / audit trail |

## API

Employee routes under `/api/v1/ess/tasks*` + `/api/v1/ess/employees?q=` (tenant-wide directory for assignee search).
