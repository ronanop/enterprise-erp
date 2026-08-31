# CR-004 — Assignment & Return Wireframes

**Phase:** 5B-1 — UI/UX design freeze  
**Style:** Data-dense ERP (MASTER tokens); Lucide icons in implementation — not shown in ASCII.

---

## 1. Assignment list (context)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Asset assignments                                    [Refresh] [Issue asset]│
│ Allocate assets to employees…                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ Team roster:  [ Priya S ] [ Rahul K ] [ … ]   ← shortcut → Wizard Step 1    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Assignments                                                                 │
│ [Search…] [Status ▼] [Allocation ▼]                                         │
│ ┌──────────┬─────────────┬──────────┬──────────┬─────────┬────────────────┐ │
│ │ Document │ Asset       │ Assignee │ Status   │ Del.ref │ Actions        │ │
│ ├──────────┼─────────────┼──────────┼──────────┼─────────┼────────────────┤ │
│ │ AASN-…   │ LT-001      │ Priya S  │ active   │ DC-42   │ View · Return  │ │
│ │ AASN-…   │ LT-014      │ —        │ draft    │ —       │ Continue issue │ │
│ └──────────┴─────────────┴──────────┴──────────┴─────────┴────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

*5B-2:* Add **Delivery ref** column; **Issue asset** opens wizard (replaces “Add assignment” label per freeze).

---

## 2. Assignment wizard — desktop shell

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Issue asset                                              Branch: HQ ▾  [×]  │
├──────────────────┬──────────────────────────────────────────────────────────┤
│ ① Employee    ●  │  Step 1 — Employee                                         │
│ ② Asset          │  ┌────────────────────────────────────────────────────┐  │
│ ③ Issued items   │  │ Allocation type  ( Employee ▼ )  [Other allocation] │  │
│ ④ Delivery       │  │ Employee *       [ Search or select employee…    ▼] │  │
│ ⑤ Review         │  │ Expected return  [ yyyy-mm-dd ]                      │  │
│                  │  └────────────────────────────────────────────────────┘  │
│                  │                          [Cancel]  [Save draft]  [Next →] │
└──────────────────┴──────────────────────────────────────────────────────────┘
```

---

## 3. Step 2 — Asset

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 2 — Asset                                                              │
│  [ Search by code, name, serial… ]                    Filter: Ready To Move   │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ○ LT-2024-001  Dell Latitude 5540    SN: …    Branch: HQ   [Ready]     ││
│  │ ● LT-2024-014  Dell Latitude 7440    SN: …    Branch: HQ   [Ready]     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─ Selected ─────────────────────────────────────────────────────────────┐│
│  │ LT-2024-014 · Latitude 7440 · Category: Laptop                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                              [← Back]  [Save draft]  [Next →]               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Step 3 — Issued items

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 3 — Issued items                                                       │
│  Accessories registered on this asset. Select what you are issuing.         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ [✓] COMP-CHG-01   USB-C Charger 65W        status: installed           ││
│  │ [✓] COMP-BAG-01   Laptop bag               status: installed           ││
│  │ [ ] COMP-DOCK-01  USB-C dock               status: installed           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ℹ No components? Register them on the asset record first.                  │
│                              [← Back]  [Save draft]  [Next →]               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Step 4 — Delivery

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 4 — Delivery                                                           │
│  Delivery reference status *   ( Pending ▼ | Issued | Received )            │
│  Delivery reference number     [ DC-2026-0042        ]  required if Issued  │
│  Assignment remarks            ┌──────────────────────────────────────────┐ │
│                                │ Laptop bag + charger included.           │ │
│                                └──────────────────────────────────────────┘ │
│  Helper: Required for employee issues before submit.                        │
│                              [← Back]  [Save draft]  [Next →]               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Step 5 — Review

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 5 — Review                                                             │
│  ┌──────────────────────┬────────────────────────────────────────────────┐│
│  │ Employee             │ Priya Sharma                                   ││
│  │ Asset                │ LT-2024-014 · Latitude 7440                    ││
│  │ Issued items         │ Charger, Laptop bag                            ││
│  │ Delivery             │ Pending · (no number)                          ││
│  │ Remarks              │ Laptop bag + charger included.                 ││
│  │ Expected return      │ —                                              ││
│  └──────────────────────┴────────────────────────────────────────────────┘│
│  Creates a draft assignment. Submit for approval from the assignment list.  │
│                              [← Back]              [Create draft]           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Return wizard — Step 2 (condition)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Return asset — Step 2 of 4                                                  │
│  How is the asset being returned?                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ (●) Good — return to stock                                              ││
│  │     Asset goes to Ready To Move (can be re-issued).                     ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │ ( ) Outdated — retire                                                   ││
│  │     Asset marked Retired (not given to anyone).                         ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │ ( ) Not working — pending disposal                                      ││
│  │     Asset marked Pending disposal.                                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                              [← Back]  [Next →]                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Return wizard — Step 4 (confirm)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Return asset — Review                                                       │
│  Asset LT-2024-014 · Assignment AASN-2026-000088                            │
│  Condition: Good — return to stock                                          │
│  Remarks: Minor scuffs on lid.                                            │
│  ⚠ This updates operational status and clears custodian when applicable.    │
│                              [← Back]  [Confirm return]                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Inventory drawer hook

```
┌─ Asset detail (drawer) ─────────────────────┐
│ …                                           │
│ Assignment                                  │
│  Employee: Priya Sharma                     │
│  Issue date: 2026-07-12                     │
│  [ Return asset ]  → opens Return wizard    │
└─────────────────────────────────────────────┘
```

---

## 10. Mobile (assignment wizard)

```
┌──────────────────────┐
│ Issue asset      [×] │
│ ●○○○○  Step 1 of 5   │
├──────────────────────┤
│ (stacked fields)     │
│                      │
├──────────────────────┤
│ [Cancel]    [Next →] │  ← sticky footer
└──────────────────────┘
```

Stepper horizontal dots; full viewport height; swipe-back optional (5B-2 nice-to-have).

---

## Component reuse (implementation hint)

| UI block | Shared component (existing / planned) |
|----------|--------------------------------------|
| KPI / empty | `EmptyState` |
| Step footer buttons | ShadCN `Button` variants |
| Asset summary card | Pattern from `AssetDetailDrawer` header |
| Status chips | `StatusBadge` + ops labels |
| Branch context | `BranchSelector` read-only chip |

No new visual language — navy primary, slate muted, accent CTA per MASTER.
