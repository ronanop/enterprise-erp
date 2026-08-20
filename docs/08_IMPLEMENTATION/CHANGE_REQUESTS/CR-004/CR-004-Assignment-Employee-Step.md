# Assignment Wizard — Employee Information (Step 1)

**Date:** 2026-08-06  
**Scope:** Frontend UI only — existing `/employees` + org lookup APIs. No new endpoints. No business-rule changes.

## Behaviour

| Element | Behaviour |
|---------|-----------|
| Search | Filters directory by Employee ID / Name (and email) |
| Select | Dropdown + quick search results list |
| Auto-fill | On selection, read-only profile grid populates |
| Loading | Skeleton while container loads employees |
| Empty | “No employee selected” until a choice is made |

## Read-only fields

Employee ID · Employee Name · Department · Designation · Branch · Phone Number · Email · Manager · Employment Status

## Data binding

`listEmployeeWizardOptions()` maps existing employee list fields (+ department/branch label lookups + manager name from the same list via `reporting_manager_id`).

Wizard state still only persists `employeeId` / `departmentId` for assignment create/update.
