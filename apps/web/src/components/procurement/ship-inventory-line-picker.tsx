"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { OvfInventoryShipLine } from "@/utils/ovf-stock";

export type InventoryLineSelection = Record<string, { selected: boolean; qty: number }>;

export function ShipInventoryLinePicker({
  lines,
  selection,
  onSelectionChange,
  loading,
  emptyLabel,
  heading = "GRN stock by product",
}: {
  lines: OvfInventoryShipLine[];
  selection: InventoryLineSelection;
  onSelectionChange: (next: InventoryLineSelection) => void;
  loading?: boolean;
  emptyLabel: string;
  heading?: string;
}) {
  const selectedCount = lines.filter(
    (line) => selection[line.id]?.selected && (selection[line.id]?.qty ?? 0) > 0,
  ).length;
  const allSelected = lines.length > 0 && selectedCount === lines.length;

  function setLineSelected(id: string, selected: boolean) {
    const line = lines.find((row) => row.id === id);
    if (!line) return;
    onSelectionChange({
      ...selection,
      [id]: {
        selected,
        qty: selection[id]?.qty ?? line.max_qty,
      },
    });
  }

  function setLineQty(id: string, raw: string) {
    const line = lines.find((row) => row.id === id);
    if (!line) return;
    const parsed = Number(raw);
    const qty = Number.isFinite(parsed)
      ? Math.max(0, Math.min(line.max_qty, parsed))
      : 0;
    onSelectionChange({
      ...selection,
      [id]: {
        selected: selection[id]?.selected ?? true,
        qty,
      },
    });
  }

  function toggleAll(selected: boolean) {
    const next: InventoryLineSelection = { ...selection };
    for (const line of lines) {
      next[line.id] = {
        selected,
        qty: next[line.id]?.qty ?? line.max_qty,
      };
    }
    onSelectionChange(next);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {heading}
        </p>
        {lines.length > 0 ? (
          <button
            type="button"
            className="cursor-pointer text-[10px] font-medium text-sky-800 underline-offset-2 transition-colors duration-200 hover:text-sky-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => toggleAll(!allSelected)}
          >
            {allSelected ? "Clear all" : "Select all"}
          </button>
        ) : null}
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading GRN warehouse stock…</p>
      ) : lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border/60 bg-background/80 p-1.5">
          {lines.map((line) => {
            const row = selection[line.id];
            const selected = Boolean(row?.selected);
            const qty = row?.qty ?? line.max_qty;
            return (
              <li
                key={line.id}
                className={cn(
                  "flex items-start gap-2 rounded-md border px-2 py-1.5 transition-colors duration-200",
                  selected
                    ? "border-sky-200/80 bg-sky-50/50"
                    : "border-transparent bg-transparent opacity-70",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-sky-700"
                  checked={selected}
                  onChange={(event) => setLineSelected(line.id, event.target.checked)}
                  aria-label={`Include ${line.product_name}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {line.product_name}
                  </p>
                  {line.detail ? (
                    <p className="truncate text-[10px] text-muted-foreground">{line.detail}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={line.max_qty}
                    step="any"
                    value={qty}
                    disabled={!selected}
                    onChange={(event) => setLineQty(line.id, event.target.value)}
                    className="h-7 w-16 cursor-pointer px-1.5 text-right text-xs tabular-nums"
                    aria-label={`Quantity for ${line.product_name}`}
                  />
                  <span className="text-[10px] text-muted-foreground">/ {line.max_qty}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
