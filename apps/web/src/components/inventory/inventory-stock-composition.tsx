import { formatQty } from "@/services/inventory-service";

interface InventoryStockCompositionProps {
  onHand: number;
  reserved: number;
  available: number;
  loading?: boolean;
}

export function InventoryStockComposition({
  onHand,
  reserved,
  available,
  loading,
}: InventoryStockCompositionProps) {
  const max = Math.max(onHand, reserved, available, 1);
  const rows = [
    { key: "on_hand", label: "On hand", value: onHand, bar: "bg-slate-600" },
    { key: "reserved", label: "Reserved", value: reserved, bar: "bg-amber-500" },
    { key: "available", label: "Available", value: available, bar: "bg-emerald-600" },
  ] as const;

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight">Stock composition</h2>
        <p className="text-[11px] text-muted-foreground">Available = On hand − Reserved (FRD-08)</p>
      </div>
      <ul className="space-y-3">
        {rows.map((row) => {
          const width = Math.max(4, Math.round((row.value / max) * 100));
          return (
            <li key={row.key}>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="font-medium tracking-wide text-muted-foreground uppercase">
                  {row.label}
                </span>
                <span className="font-mono tabular-nums text-foreground">
                  {loading ? "—" : formatQty(row.value)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${row.bar}`}
                  style={{ width: `${width}%` }}
                  role="presentation"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
