"use client";

import { useCallback, useId, useState } from "react";
import { Columns3, Plus, Rows3, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TrackerGrid, TrackerGridColumn } from "@/services/projects-portal-service";

function newColumnId(existing: TrackerGridColumn[]): string {
  let n = existing.length + 1;
  const ids = new Set(existing.map((c) => c.id));
  while (ids.has(`c${n}`)) n += 1;
  return `c${n}`;
}

export function emptyTrackerGrid(columnCount = 4, rowCount = 8): TrackerGrid {
  const columns: TrackerGridColumn[] = Array.from({ length: columnCount }, (_, i) => ({
    id: `c${i + 1}`,
    label: `Column ${i + 1}`,
  }));
  const rows = Array.from({ length: rowCount }, () =>
    Object.fromEntries(columns.map((c) => [c.id, ""])),
  );
  return { columns, rows };
}

type Props = {
  value: TrackerGrid;
  onChange: (next: TrackerGrid) => void;
  disabled?: boolean;
  className?: string;
};

/** Dense Excel-like sheet editor for project customer trackers. */
export function TrackerGridEditor({ value, onChange, disabled, className }: Props) {
  const baseId = useId();
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);

  const patch = useCallback(
    (updater: (prev: TrackerGrid) => TrackerGrid) => {
      onChange(updater(value));
    },
    [onChange, value],
  );

  function addColumn() {
    if (disabled) return;
    patch((prev) => {
      const col: TrackerGridColumn = {
        id: newColumnId(prev.columns),
        label: `Column ${prev.columns.length + 1}`,
      };
      return {
        columns: [...prev.columns, col],
        rows: prev.rows.map((row) => ({ ...row, [col.id]: "" })),
      };
    });
  }

  function removeColumn(colId: string) {
    if (disabled || value.columns.length <= 1) return;
    patch((prev) => ({
      columns: prev.columns.filter((c) => c.id !== colId),
      rows: prev.rows.map((row) => {
        const next = { ...row };
        delete next[colId];
        return next;
      }),
    }));
  }

  function renameColumn(colId: string, label: string) {
    if (disabled) return;
    patch((prev) => ({
      ...prev,
      columns: prev.columns.map((c) => (c.id === colId ? { ...c, label } : c)),
    }));
  }

  function addRow() {
    if (disabled) return;
    patch((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        Object.fromEntries(prev.columns.map((c) => [c.id, ""])),
      ],
    }));
  }

  function removeRow(index: number) {
    if (disabled || value.rows.length <= 1) return;
    patch((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== index),
    }));
  }

  function setCell(rowIndex: number, colId: string, cellValue: string) {
    if (disabled) return;
    patch((prev) => ({
      ...prev,
      rows: prev.rows.map((row, i) =>
        i === rowIndex ? { ...row, [colId]: cellValue } : row,
      ),
    }));
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 cursor-pointer transition-colors duration-200"
          disabled={disabled}
          onClick={addColumn}
        >
          <Columns3 className="size-3.5" /> Add column
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 cursor-pointer transition-colors duration-200"
          disabled={disabled}
          onClick={addRow}
        >
          <Rows3 className="size-3.5" /> Add row
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {value.columns.length} col · {value.rows.length} row
        </span>
      </div>

      <div className="erp-scroll overflow-auto rounded-lg border border-border/70 bg-background">
        <table className="w-max min-w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-muted/40">
              <th className="sticky left-0 z-10 w-10 border-b border-r border-border/60 bg-muted/40 px-2 py-1.5 text-center text-[10px] font-semibold text-muted-foreground">
                #
              </th>
              {value.columns.map((col, colIndex) => (
                <th
                  key={col.id}
                  className="min-w-40 border-b border-r border-border/60 p-0 last:border-r-0"
                >
                  <div className="flex items-center gap-1 px-1 py-1">
                    <Input
                      id={`${baseId}-col-${col.id}`}
                      value={col.label}
                      disabled={disabled}
                      onChange={(e) => renameColumn(col.id, e.target.value)}
                      onFocus={() => setSelected({ row: -1, col: colIndex })}
                      className="h-7 border-0 bg-transparent px-1.5 text-[11px] font-semibold shadow-none focus-visible:ring-1"
                      aria-label={`Column ${colIndex + 1} name`}
                    />
                    <button
                      type="button"
                      aria-label={`Remove column ${col.label}`}
                      className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                      disabled={disabled || value.columns.length <= 1}
                      onClick={() => removeColumn(col.id)}
                    >
                      <Trash2 className="size-3" aria-hidden />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-10 border-b border-border/60 bg-muted/40" />
            </tr>
          </thead>
          <tbody>
            {value.rows.map((row, rowIndex) => (
              <tr key={`${baseId}-row-${rowIndex}`} className="hover:bg-muted/20">
                <td className="sticky left-0 z-10 border-b border-r border-border/50 bg-background px-2 py-0.5 text-center text-[10px] tabular-nums text-muted-foreground">
                  {rowIndex + 1}
                </td>
                {value.columns.map((col, colIndex) => {
                  const active =
                    selected?.row === rowIndex && selected?.col === colIndex;
                  return (
                    <td
                      key={col.id}
                      className={cn(
                        "min-w-40 border-b border-r border-border/50 p-0 last:border-r-0",
                        active && "ring-1 ring-inset ring-primary/40",
                      )}
                    >
                      <input
                        value={row[col.id] ?? ""}
                        disabled={disabled}
                        onChange={(e) => setCell(rowIndex, col.id, e.target.value)}
                        onFocus={() => setSelected({ row: rowIndex, col: colIndex })}
                        className="h-8 w-full bg-transparent px-2 text-[12px] outline-none disabled:cursor-not-allowed"
                        aria-label={`Row ${rowIndex + 1}, ${col.label}`}
                      />
                    </td>
                  );
                })}
                <td className="border-b border-border/50 px-1">
                  <button
                    type="button"
                    aria-label={`Remove row ${rowIndex + 1}`}
                    className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                    disabled={disabled || value.rows.length <= 1}
                    onClick={() => removeRow(rowIndex)}
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 cursor-pointer text-muted-foreground transition-colors duration-200"
        disabled={disabled}
        onClick={addRow}
      >
        <Plus className="size-3.5" /> Insert blank row
      </Button>
    </div>
  );
}
