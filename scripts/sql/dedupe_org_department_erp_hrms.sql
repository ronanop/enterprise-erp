-- Dedupe organization.org_department within each company (erp_hrms)
-- Keeper: head_employee_id NOT NULL preferred, else oldest created_at
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _dedupe_stats (
  metric text PRIMARY KEY,
  value bigint
);

INSERT INTO _dedupe_stats (metric, value)
VALUES ('active_depts_before', (SELECT COUNT(*) FROM organization.org_department WHERE is_deleted = false));

-- Map duplicate id -> keeper id
CREATE TEMP TABLE _dept_dup_map AS
WITH ranked AS (
  SELECT
    id,
    company_id,
    lower(trim(department_name)) AS norm_name,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, lower(trim(department_name))
      ORDER BY
        (head_employee_id IS NOT NULL) DESC,
        created_at ASC,
        id ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY company_id, lower(trim(department_name))
      ORDER BY
        (head_employee_id IS NOT NULL) DESC,
        created_at ASC,
        id ASC
    ) AS keeper_id
  FROM organization.org_department
  WHERE is_deleted = false
),
dup_groups AS (
  SELECT company_id, norm_name
  FROM ranked
  GROUP BY company_id, norm_name
  HAVING COUNT(*) > 1
)
SELECT r.id AS duplicate_id, r.keeper_id
FROM ranked r
JOIN dup_groups g ON g.company_id = r.company_id AND g.norm_name = r.norm_name
WHERE r.rn > 1;

INSERT INTO _dedupe_stats (metric, value)
VALUES ('duplicate_rows_to_merge', (SELECT COUNT(*) FROM _dept_dup_map));

-- FK reassignment (discovered via information_schema)
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

-- Parent pointers (exclude self; dup rows still active here)
UPDATE organization.org_department d
SET parent_department_id = m.keeper_id, updated_at = now()
FROM _dept_dup_map m
WHERE d.parent_department_id = m.duplicate_id;

-- Module rows: drop duplicate-side rows that would collide on keeper
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

-- Soft-delete duplicate departments; free branch+department_code uniqueness
UPDATE organization.org_department d
SET
  is_deleted = true,
  deleted_at = now(),
  status = 'inactive',
  department_code = LEFT(
    d.department_code || '-DUP-' || REPLACE(SUBSTRING(d.id::text, 1, 8), '-', ''),
    50
  ),
  updated_at = now()
FROM _dept_dup_map m
WHERE d.id = m.duplicate_id;

INSERT INTO _dedupe_stats (metric, value)
VALUES ('duplicate_groups_merged', (
  SELECT COUNT(DISTINCT (d.company_id, lower(trim(d.department_name))))
  FROM organization.org_department d
  JOIN _dept_dup_map m ON m.duplicate_id = d.id
));

-- Orphan non-Cache companies: zero active employees -> soft-delete departments only
CREATE TEMP TABLE _orphan_company_ids AS
SELECT c.id AS company_id, c.company_name, c.company_code
FROM organization.org_company c
WHERE COALESCE(c.is_deleted, false) = false
  AND c.company_name NOT ILIKE '%Cache Digitech%'
  AND c.company_name NOT ILIKE '%Cache Technologies%'
  AND NOT EXISTS (
    SELECT 1 FROM master.master_employee e
    WHERE e.company_id = c.id AND COALESCE(e.is_deleted, false) = false
  );

INSERT INTO _dedupe_stats (metric, value)
VALUES ('orphan_companies_with_zero_employees', (SELECT COUNT(*) FROM _orphan_company_ids));

CREATE TEMP TABLE _orphan_dept_ids AS
SELECT d.id
FROM organization.org_department d
JOIN _orphan_company_ids o ON o.company_id = d.company_id
WHERE d.is_deleted = false;

UPDATE organization.org_department d
SET
  is_deleted = true,
  deleted_at = now(),
  status = 'inactive',
  department_code = CASE
    WHEN d.department_code NOT LIKE '%-ORPHAN-%' THEN LEFT(
      d.department_code || '-ORPHAN-' || REPLACE(SUBSTRING(d.id::text, 1, 8), '-', ''),
      50
    )
    ELSE d.department_code
  END,
  updated_at = now()
FROM _orphan_dept_ids x
WHERE d.id = x.id;

INSERT INTO _dedupe_stats (metric, value)
VALUES ('orphan_company_depts_soft_deleted', (SELECT COUNT(*) FROM _orphan_dept_ids));

INSERT INTO _dedupe_stats (metric, value)
VALUES ('active_depts_after', (SELECT COUNT(*) FROM organization.org_department WHERE is_deleted = false));

-- Verify no remaining duplicate groups among active rows
INSERT INTO _dedupe_stats (metric, value)
VALUES ('remaining_duplicate_groups', (
  SELECT COUNT(*) FROM (
    SELECT company_id, lower(trim(department_name))
    FROM organization.org_department
    WHERE is_deleted = false
    GROUP BY company_id, lower(trim(department_name))
    HAVING COUNT(*) > 1
  ) x
));

COMMIT;

\echo '=== DEDUPE REPORT ==='
SELECT * FROM _dedupe_stats ORDER BY metric;

\echo '=== NON-CACHE COMPANIES (employee count) ==='
SELECT
  c.company_name,
  c.company_code,
  (SELECT COUNT(*) FROM master.master_employee e WHERE e.company_id = c.id AND COALESCE(e.is_deleted, false) = false) AS active_employees,
  CASE
    WHEN c.company_name ILIKE '%Cache Digitech%' OR c.company_name ILIKE '%Cache Technologies%' THEN 'cache (excluded from orphan rule)'
    WHEN NOT EXISTS (
      SELECT 1 FROM master.master_employee e WHERE e.company_id = c.id AND COALESCE(e.is_deleted, false) = false
    ) THEN 'orphan candidate'
    ELSE 'has employees'
  END AS orphan_status
FROM organization.org_company c
WHERE COALESCE(c.is_deleted, false) = false
ORDER BY c.company_name;