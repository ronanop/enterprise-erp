# Email Page Overrides

> **PROJECT:** Enterprise ERP Platform  
> **Page Type:** Operations / Admin (Notification Engine)  
> **IMPORTANT:** Rules here override `MASTER.md` for `/email/*` screens.

---

## Page-Specific Rules

### Layout

- Dense dashboard layout: KPI strip → provider status + recent deliveries
- Workspace sub-nav: Overview · Compose · Templates · Deliveries · Events
- Compose / Templates: single-column form max-width ~3xl
- Tables: full-width data grids with mono for IDs / addresses

### Color

- Follow Master primary (`#2563EB`) and accent success green for delivered
- Failed deliveries: destructive (`#DC2626`)
- Queued / pending: amber warning tone
- No purple/pink gradients; light mode only

### Components

- Lucide icons only (`Mail`, `Send`, `Server`, `RefreshCw`)
- `cursor-pointer` on all buttons and nav links
- 150–200ms hover / focus transitions
- Focus rings visible on inputs and selects

### Content

- Surface Graph config status (configured / from address / delivery mode) without exposing secrets
- Delivery log shows provider response truncated for ops debugging
