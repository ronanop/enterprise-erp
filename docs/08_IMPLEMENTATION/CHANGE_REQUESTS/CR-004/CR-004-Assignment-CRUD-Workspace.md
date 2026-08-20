# CR-004 — Assignment CRUD Workspace

**Date:** 2026-08-06  
**Scope:** Frontend only — reuse existing Assignment Wizard, `assignmentFrontendService`, and APIs.

## Entry

| Route | UI |
|-------|----|
| `/assets/asset-assignments` | Assignment CRUD list workspace |
| `/assets/asset-assignments/new` | Create / edit draft (Issue wizard) |
| `/assets/asset-assignments/return` | Return active assignment |

## CRUD workflow

| Action | Rule | Implementation |
|--------|------|----------------|
| **Create** | New assignment | Issue wizard → `createDraft` / submit / activate |
| **View** | Any status | List view dialog |
| **Edit** | Draft only | `?draftId=` → Issue wizard (`loadDraft` / `updateDraft`) |
| **Return** | Active only | Return wizard |
| **Delete** | Draft only | Soft-delete via `POST …/cancel` (`cancelDraft`) — **never** active |

Asset selection is locked after activation (`canChangeAsset: false`).

## UI sections (Issue wizard)

1. **Employee Information** — search by Employee ID / Name; auto-fill read-only profile (ID, Name, Department, Designation, Branch, Phone, Email, Manager, Employment Status); loading skeleton + “No employee selected” empty state  
2. Asset Information — tag, serial, name, make, model, configuration, location, earlier used by  
3. Issued Items — Charger, Mouse, Keyboard, Laptop Bag, Dock, HDMI Cable, Adapter, Headset, Other  
4. Assignment Details — issued date, delivery challan, delivery status, remarks, expected return  
5. Review & Confirm  

## Components reused

- `AssignmentWizard` / `AssignmentWizardContainer` / `ReturnWizardContainer`
- `assignmentFrontendService` (+ `list`, `cancelDraft`)
- `AssetAssignmentWorkspace` (list + CRUD actions)
- Existing assignment navigation / routes / backend workflows

## Tests

- `assignment-crud-rules.test.ts`
- Updated wizard / container / service suites
