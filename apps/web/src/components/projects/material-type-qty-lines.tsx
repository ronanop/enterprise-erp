"use client";

import { Plus, Trash2 } from "lucide-react";

import { FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MaterialLine } from "@/services/projects-portal-service";

export type TypeQtyLineDraft = {
  type: string;
  quantity: string;
  date: string;
};

export function emptyTypeQtyLine(): TypeQtyLineDraft {
  return { type: "", quantity: "", date: "" };
}

export function linesFromMaterial(
  lines: MaterialLine[] | null | undefined,
): TypeQtyLineDraft[] {
  if (!Array.isArray(lines) || lines.length === 0) return [emptyTypeQtyLine()];
  return lines.map((line) => ({
    type: line.type ?? "",
    quantity: line.quantity != null ? String(line.quantity) : "",
    date: line.date ?? "",
  }));
}

export function serializeTypeQtyLines(lines: TypeQtyLineDraft[]): string {
  return JSON.stringify(lines);
}

export function parseTypeQtyLines(raw: string | undefined): TypeQtyLineDraft[] {
  if (!raw?.trim()) return [emptyTypeQtyLine()];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [emptyTypeQtyLine()];
    return parsed.map((item) => {
      if (!item || typeof item !== "object") return emptyTypeQtyLine();
      const row = item as Record<string, unknown>;
      return {
        type: typeof row.type === "string" ? row.type : "",
        quantity:
          row.quantity == null || row.quantity === ""
            ? ""
            : String(row.quantity),
        date: typeof row.date === "string" ? row.date : "",
      };
    });
  } catch {
    return [emptyTypeQtyLine()];
  }
}

export function typeQtyLinesToMaterial(lines: TypeQtyLineDraft[]): MaterialLine[] {
  const out: MaterialLine[] = [];
  for (const line of lines) {
    const type = line.type.trim();
    const n = Number(line.quantity);
    const date = line.date.trim();
    if (!type || !Number.isFinite(n) || n < 1) continue;
    out.push({
      type,
      quantity: Math.trunc(n),
      date: date || null,
    });
  }
  return out;
}

/** True when at least one row has type and quantity ≥ 1 (date optional). */
export function hasValidTypeQtyLines(
  raw: string | undefined,
  opts?: { requireDate?: boolean },
): boolean {
  const requireDate = opts?.requireDate ?? false;
  return parseTypeQtyLines(raw).some((line) => {
    const n = Number(line.quantity);
    return (
      Boolean(line.type.trim()) &&
      Number.isFinite(n) &&
      n >= 1 &&
      (!requireDate || Boolean(line.date.trim()))
    );
  });
}

export function TypeQtyLinesEditor({
  value,
  onChange,
  options,
  disabled,
  addLabel = "Add type",
  showDate = true,
  datesOnly = false,
}: {
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  addLabel?: string;
  /** When false, hide per-line date (Survey type/qty only). Default true for SCM delivery. */
  showDate?: boolean;
  /** SCM mode — type/qty locked from Survey; only delivery date is editable. */
  datesOnly?: boolean;
}) {
  const parsed = parseTypeQtyLines(value);
  const lines = datesOnly
    ? parsed.filter((line) => Boolean(line.type.trim()))
    : parsed;
  const displayLines =
    datesOnly && lines.length === 0
      ? []
      : lines.length
        ? lines
        : [emptyTypeQtyLine()];

  function commit(next: TypeQtyLineDraft[]) {
    onChange(serializeTypeQtyLines(next.length ? next : [emptyTypeQtyLine()]));
  }

  function updateRow(index: number, patch: Partial<TypeQtyLineDraft>) {
    commit(
      displayLines.map((line, i) => {
        if (i !== index) return line;
        if (datesOnly) {
          return { ...line, date: patch.date !== undefined ? patch.date : line.date };
        }
        const next = { ...line, ...patch };
        if (patch.type !== undefined && patch.type !== line.type) {
          next.quantity = "";
          next.date = "";
        }
        return next;
      }),
    );
  }

  function removeRow(index: number) {
    if (datesOnly) return;
    const next = displayLines.filter((_, i) => i !== index);
    commit(next.length ? next : [emptyTypeQtyLine()]);
  }

  function addRow() {
    if (datesOnly) return;
    commit([...displayLines, emptyTypeQtyLine()]);
  }

  const usedTypes = new Set(displayLines.map((l) => l.type.trim()).filter(Boolean));
  const typeLocked = datesOnly || Boolean(disabled);

  if (datesOnly && displayLines.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No materials recorded in Survey yet.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {displayLines.map((line, index) => {
        const available = options.filter(
          (o) => o.value === line.type || !usedTypes.has(o.value),
        );
        const typeLabel =
          options.find((o) => o.value === line.type)?.label ?? line.type;
        return (
          <div key={index} className="flex flex-wrap items-center gap-2">
            {datesOnly ? (
              <Input
                className="h-8 min-w-0 flex-1 basis-40"
                value={typeLabel}
                disabled
                aria-readonly="true"
              />
            ) : (
              <FinanceSelect
                value={line.type}
                disabled={typeLocked}
                className="h-8 min-w-0 flex-1 basis-40"
                onChange={(e) => updateRow(index, { type: e.target.value })}
              >
                <option value="">Select type…</option>
                {available.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </FinanceSelect>
            )}
            {line.type.trim() ? (
              <>
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  disabled={typeLocked}
                  placeholder="Qty"
                  className="h-8 w-20 shrink-0"
                  onChange={(e) => updateRow(index, { quantity: e.target.value })}
                />
                {showDate ? (
                  <Input
                    type="date"
                    value={line.date}
                    disabled={disabled}
                    className="h-8 w-36 shrink-0"
                    onChange={(e) => updateRow(index, { date: e.target.value })}
                  />
                ) : null}
              </>
            ) : null}
            {!datesOnly ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-destructive"
                disabled={disabled || (displayLines.length === 1 && !line.type.trim())}
                onClick={() => removeRow(index)}
                aria-label="Remove line"
              >
                <Trash2 className="size-3.5" />
              </Button>
            ) : null}
          </div>
        );
      })}
      {!datesOnly ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 cursor-pointer gap-1.5 px-2 text-xs transition-colors duration-200"
          disabled={disabled || usedTypes.size >= options.length}
          onClick={addRow}
        >
          <Plus className="size-3" />
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}
