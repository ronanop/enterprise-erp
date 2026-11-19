-- Dedupe organization.org_department tenant-wide by normalized name (erp_hrms)
-- Keeper: head_employee_id NOT NULL preferred, else oldest created_at
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _dedupe_stats (
  metric text PRIMARY KEY,
  value bigint
);

INSERT INTO _dedupe_stats (metric, value)
VALUES ('active_depts_before', (SELECT COUNT(*) FROM organization.org_department WHERE is_deleted = false));

CREATE TEMP TABLE _dept_dup_map AS
WITH ranked AS (
  SELECT
    id,
    lower(trim(department_name)) AS norm_name,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(department_name))
      ORDER BY
        (head_employee_id IS NOT NULL) DESC,
        created_at ASC,
        id ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY lower(trim(department_name))
      ORDER BY
        (head_employee_id IS NOT NULL) DESC,
        created_at ASC,
        id ASC
    ) AS keeper_id
  FROM organization.org_department
  WHERE is_deleted = false
),
dup_groups AS (
  SELECT norm_name
  FROM ranked
  GROUP BY norm_name
  HAVING COUNT(*) > 1
)
SELECT r.id AS duplicate_id, r.keeper_id, r.norm_name
FROM ranked r
JOIN dup_groups g ON g.norm_name = r.norm_name
WHERE r.rn > 1;

INSERT INTO _dedupe_stats (metric, value)
VALUES ('duplicate_rows_to_merge', (SELECT COUNT(*) FROM _dept_dup_map));

UPDATE master.master_employee e
SET department_id = m.keeper_id, updated_at = now()
FROM _dept_dup_map m
WHERE e.department_id = m.duplicate_id;

UPDATE hr.hr_department_assignment h
SET department_id = m.keeper_id, updated_at = now()
FROM _dept_dup_map m
WHERE h.department_id = m.duplicate_id;

UPDATE organization.org_cost_center t
SET department_id = m.keeper_id, updated_at = now()
FROM _dept_dup_map m
WHERE t.department_id = m.duplicate_id;

UPDATE organization.org_profit_center t
SET department_id = m.keeper_id, updated_at = now()
FROM _dept_dup_map m
WHERE t.department_id = m.duplicate_id;

UPDATE payroll.pay_employee_salary t
SET department_id = m.keeper_id, updated_at = now()
FROM _dept_dup_map m
WHERE t.department_id = m.duplicate_id;

UPDATE payroll.pay_payroll_run_line t
SET department_id = m.keeper_id, updated_at = now()
FROM _dept_dup_map m
WHERE t.department_id = m.duplicate_id;

UPDATE payroll.pay_payroll_summary t
SET department_id = m.keeper_id, updated_at = now()
FROM _dept_dup_map m
WHERE t.department_id = m.duplicate_id;

UPDATE recruitment.rec_job_requisition t
SET department_id = m.keeper_id, updated_at = now()
FROM _dept_dup_map m
WHERE t.department_id = m.duplicate_id;

UPDATE recruitment.rec_offer t
SET department_id = m.keeper_id, updated_at = now()
FROM _dept_dup_map m
WHERE t.department_id = m.duplicate_id;

UPDATE recruitment.rec_onboarding t
SET department_id = m.keeper_id, updated_at = now()
FROM _dept_dup_map m
WHERE t.department_id = m.duplicate_id;

UPDATE recruitment.rec_recruitment_report t
SET department_id = m.keeper_id, updated_at = now()
FROM _dept_dup_map m
WHERE t.department_id = m.duplicate_id;

UPDATE organization.org_department d
SET parent_department_id = m.keeper_id, updated_at = now()
FROM _dept_dup_map m
WHERE d.parent_department_id = m.duplicate_id;

DELETE FROM organization.org_department_module om
USING _dept_dup_map m
WHERE om.department_id = m.duplicate_id
  AND EXISTS (
    SELECT 1 FROM organization.org_department_module k
    WHERE k.department_id = m.keeper_id
      AND k.module_key = om.module_key
  );

UPDATE organization.org_department_module om
SET department_id = m.keeper_id
FROM _dept_dup_map m
WHERE om.department_id = m.duplicate_id;

UPDATE organization.org_department d
SET
  is_deleted = true,
  deleted_at = now(),
  status = 'inactive',
  department_code = LEFT(
    d.department_code || '-DUP-' || LEFT(REPLACE(d.id::text, '-', ''), 8),
    50
  ),
  updated_at = now()
FROM _dept_dup_map m
WHERE d.id = m.duplicate_id;

INSERT INTO _dedupe_stats (metric, value)
VALUES ('duplicate_norm_names_merged', (SELECT COUNT(DISTINCT norm_name) FROM _dept_dup_map));

INSERT INTO _dedupe_stats (metric, value)
VALUES ('active_depts_after', (SELECT COUNT(*) FROM organization.org_department WHERE is_deleted = false));

INSERT INTO _dedupe_stats (metric, value)
VALUES ('remaining_duplicate_groups', (
  SELECT COUNT(*) FROM (
    SELECT lower(trim(department_name))
    FROM organization.org_department
    WHERE is_deleted = false
    GROUP BY lower(trim(department_name))
    HAVING COUNT(*) > 1
  ) x
));

COMMIT;

\echo '=== DEDUPE REPORT (tenant-wide by name) ==='
SELECT * FROM _dedupe_stats ORDER BY metric;

\echo '=== REMAINING ACTIVE DEPARTMENTS ==='
SELECT id, department_name, company_id, branch_id, head_employee_id
FROM organization.org_department
WHERE is_deleted = false
ORDER BY lower(trim(department_name));