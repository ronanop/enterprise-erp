# HRMS Alembic baseline

Revision `0001_hrms_standalone` creates schemas:

- `foundation`, `organization`, `master` (employee), `platform`, `hr`, `payroll`, `recruitment`

**Use a new empty PostgreSQL database.** Do not run this against a database that still holds the former full-ERP schemas.

```bash
cd apps/api
# point DATABASE_URL / .env at an empty DB, then:
alembic upgrade head
```
