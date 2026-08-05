/** Shared layout tokens — Enterprise ERP / Swiss minimal, data-dense procurement. */
export const procurementUi = {
  page: "space-y-3",
  tableShell: "overflow-hidden rounded-md border border-border/80 bg-card",
  tableScroll: "overflow-x-auto",
  table: "w-full text-left text-[13px] leading-snug",
  thead:
    "border-b border-border/80 bg-muted/20 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground",
  th: "px-3 py-2.5",
  tr: "border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-muted/20",
  td: "px-3 py-2 align-middle",
  tdMuted: "px-3 py-2 align-middle text-muted-foreground",
  tdNumeric: "px-3 py-2 align-middle tabular-nums",
  empty: "px-3 py-12 text-center text-sm text-muted-foreground",
  searchRow: "flex justify-end",
  searchInput:
    "h-8 w-full max-w-[220px] border-border/70 bg-background text-sm shadow-none transition-colors duration-200",
  rowActions: "flex flex-wrap items-center gap-1",
  actionBtn:
    "h-7 cursor-pointer gap-1 px-2 text-xs font-medium transition-colors duration-200",
  statusBadge: "text-[10px] font-medium uppercase tracking-wide",
  sectionCard:
    "space-y-3 rounded-md border border-border/80 bg-card p-4",
  sectionTitle: "text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground",
} as const;
