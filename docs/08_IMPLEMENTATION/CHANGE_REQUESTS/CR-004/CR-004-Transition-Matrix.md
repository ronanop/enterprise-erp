# CR-004 — Operational Status Transition Matrix

**Statuses (locked):** `READY_TO_MOVE`, `ASSIGNED`, `RETIRED`, `PENDING_DISPOSAL`, `DISPOSED`

**Note:** This matrix is **LOCKED** under Phase 1.1 (`CR-004-Decision-Log.md`). Enforcement begins Phase 3.

---

## 1. Terminal states

| Status | Terminal? |
|--------|-----------|
| `DISPOSED` | **Yes** — no outbound transitions |
| `RETIRED` | **Effective terminal for assignment** — only allow move to `PENDING_DISPOSAL` or remain retired |
| Others | Non-terminal |

---

## 2. Allowed transitions

| From → To | Allowed | Trigger (recommended) |
|-----------|---------|------------------------|
| `READY_TO_MOVE` → `ASSIGNED` | Yes | Assignment activated (employee) |
| `ASSIGNED` → `READY_TO_MOVE` | Yes | Assignment returned |
| `READY_TO_MOVE` → `RETIRED` | Yes | IT Admin marks outdated (never assign) |
| `ASSIGNED` → `RETIRED` | Yes | Return then retire, or forced retire policy |
| `READY_TO_MOVE` → `PENDING_DISPOSAL` | Yes | Mark not working |
| `ASSIGNED` → `PENDING_DISPOSAL` | Yes | Mark not working (may require return first — policy) |
| `RETIRED` → `PENDING_DISPOSAL` | Yes | Send to disposal pipeline |
| `PENDING_DISPOSAL` → `DISPOSED` | Yes | Disposal document **posted** |
| `PENDING_DISPOSAL` → `READY_TO_MOVE` | Conditional | Only if repair/reinstate policy (maintenance completed) |
| `RETIRED` → `READY_TO_MOVE` | **No** | Violates “never assign again” |
| `DISPOSED` → * | **No** | Terminal |
| * → `ASSIGNED` | Only from `READY_TO_MOVE` | Block assign from retired/disposed/pending |

---

## 3. Blocked transitions (invalid)

| Transition | Reason |
|------------|--------|
| `DISPOSED` → any | Terminal |
| `RETIRED` → `READY_TO_MOVE` | Business rule |
| `ASSIGNED` → `ASSIGNED` | No-op; use assignment doc |
| Assign while `PENDING_DISPOSAL` | Dead asset |
| Assign while `DISPOSED` | Terminal |
| Assign while register `status` not operational (`draft`, `cancelled`) | Existing validators |

---

## 4. Synchronization with existing enums

| Event | `operational_status` | `ast_asset.status` | Assignment |
|-------|----------------------|--------------------|------------|
| Register activated | `READY_TO_MOVE` (default IT policy) | `active` | none |
| Assignment activate | `ASSIGNED` | `active` | `active` |
| Assignment return | `READY_TO_MOVE` | `active` | `returned` |
| Mark retired | `RETIRED` | `active` or `in_maintenance` | must not be active |
| Mark not working | `PENDING_DISPOSAL` | `active`/`in_maintenance` | prefer returned |
| Disposal posted | `DISPOSED` | `disposed`/`written_off` | none active |

**Conflict rule:** If `operational_status = ASSIGNED` but no active assignment → data repair job or auto-fix to `READY_TO_MOVE` (implementation detail Phase 3).

---

## 5. Recommended enforcement layer

```text
OperationalStatusEngine (new, domain)
    ↑
OperationalStatusValidator
    ↑
AssetOperationalService (or extend AssetService — single write path)
    ↑
Router (thin)
```

Assignment/Disposal services **call** operational transition hooks — do not set operational status from UI directly.
