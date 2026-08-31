# CR-004 — Assignment Navigation

**Owner:** `apps/web/src/components/assets/navigation/assignment-navigation.ts`  

Assignment module URLs and `open*` APIs must go through this module (page hosts use `createAssignmentNavigation`).

Cross-module inventory menus still use `asset-navigation.ts`, which **delegates** Issue/Return href construction here.

---

## Paths

| Key | Path |
|-----|------|
| `list` | `/assets/asset-assignments` |
| `new` | `/assets/asset-assignments/new` |
| `return` | `/assets/asset-assignments/return` |
| `inventory` | `/assets/assets` |

---

## API

| Method | Behavior |
|--------|----------|
| `openAssignmentList()` | Assignment list workspace |
| `openNewAssignment()` | Blank Issue wizard |
| `openDraft(draftId)` | Issue wizard draft resume |
| `openIssue(assetId, extra?)` | Issue wizard with asset (+ optional employee) |
| `openReturn(assetId)` | Return wizard (`intent=return`) |
| `openReturnByAssignment(assignmentId)` | Return by assignment id |
| `openInventory(assetId?)` | Soft-return to inventory; optional focus stash |
| `buildAssignmentWizardHref(params)` | Pure href builder |
| `buildReturnWizardHref(params)` | Pure href builder |

Aliases: `buildIssueWizardHref` ≡ `buildAssignmentWizardHref`.

---

## Rules

- Navigation only — no UI, fetch, or business rules.
- Containers remain URL-agnostic; page hosts map query → props.
- Do not duplicate href builders in inventory or wizard folders.
