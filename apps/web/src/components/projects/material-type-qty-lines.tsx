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

/** True when at least one row has type, quantity ≥ 1, and date. */
export function hasValidTypeQtyLines(raw: string | undefined): boolean {
  return parseTypeQtyLines(raw).some((line) => {
    const n = Number(line.quantity);
    return (
      Boolean(line.type.trim()) &&
      Number.isFinite(n) &&
      n >= 1 &&
      Boolean(line.date.trim())
    );
  });
}

export function TypeQtyLinesEditor({
  value,
  onChange,
  options,
  disabled,
  addLabel = "Add type",
}: {
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  addLabel?: string;
}) {
  const lines = parseTypeQtyLines(value);

  function commit(next: TypeQtyLineDraft[]) {
    onChange(serializeTypeQtyLines(next.length ? next : [emptyTypeQtyLine()]));
  }

  function updateRow(index: number, patch: Partial<TypeQtyLineDraft>) {
    commit(
      lines.map((line, i) => {
        if (i !== index) return line;
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
    const next = lines.filter((_, i) => i !== index);
    commit(next.length ? next : [emptyTypeQtyLine()]);
  }

  function addRow() {
    commit([...lines, emptyTypeQtyLine()]);
  }

  const usedTypes = new Set(lines.map((l) => l.type.trim()).filter(Boolean));

  return (
    <div className="space-y-1.5">
      {lines.map((line, index) => {
        const available = options.filter(
          (o) => o.value === line.type || !usedTypes.has(o.value),
        );
        return (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <FinanceSelect
              value={line.type}
              disabled={disabled}
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
            {line.type.trim() ? (
              <>
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  disabled={disabled}
                  placeholder="Qty"
                  className="h-8 w-20 shrink-0"
                  onChange={(e) => updateRow(index, { quantity: e.target.value })}
                />
                <Input
                  type="date"
                  value={line.date}
                  disabled={disabled}
                  className="h-8 w-36 shrink-0"
                  onChange={(e) => updateRow(index, { date: e.target.value })}
                />
              </>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-destructive"
              disabled={disabled || (lines.length === 1 && !line.type.trim())}
              onClick={() => removeRow(index)}
              aria-label="Remove line"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        );
      })}
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
    </div>
  );
}
