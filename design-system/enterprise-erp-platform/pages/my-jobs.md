# My Jobs Page Overrides

> **PROJECT:** iConnect Plus  
> **Page:** `/my-jobs` (platform Overview)  
> Overrides `design-system/enterprise-erp-platform/MASTER.md` for this page only.

---

## Purpose

Cross-module inbox of approvals and assigned work for the signed-in user. One dense table per module that currently has open jobs (CRM, Projects, HR).

## Layout

- Max width: shell default (`1400px`)
- Density: High (dashboard)
- One section card per module; module title in the section header
- Empty state when no modules return jobs

## Components

- `PageHeader` + refresh action
- Per-module bordered table (Job / Reference / Detail / Status / Open)
- Lucide icons only; `cursor-pointer` on Open links and Refresh
- Hover transitions 150–200ms; respect `prefers-reduced-motion`

## Data

- Aggregate from existing module APIs (no cross-module DB access)
- Only show modules the user is assigned to (or ERP admin)
- Omit 401/403 modules silently

## Avoid

- Mixing all modules into a single flat table
- Cards in the job list rows
- Purple/pink gradients or dark-mode-by-default
