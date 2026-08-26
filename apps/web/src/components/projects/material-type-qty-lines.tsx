"use client";

import { Plus, Trash2 } from "lucide-react";

import { FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MATERIAL_TYPE_OTHERS } from "@/components/projects/projects-domain";
import type { MaterialLine } from "@/services/projects-portal-service";

export type TypeQtyLineDraft = {
  type: string;
  /** Custom name when type is Others. */
  otherLabel: string;
  quantity: string;
  /** SCM delivery — "true" | "false" | "" (Yes shows date). */
  delivered: string;
  date: string;
};

export function emptyTypeQtyLine(): TypeQtyLineDraft {
  return { type: "", otherLabel: "", quantity: "", delivered: "", date: "" };
}

export function isOthersMaterialType(type: string | null | undefined): boolean {
  return (type ?? "").trim() === MATERIAL_TYPE_OTHERS;
}

function knownOptionValues(
  options?: Array<{ value: string }> | null,
): Set<string> {
  return new Set(
    (options ?? [])
      .map((o) => o.value.trim())
      .filter((v) => v && v !== MATERIAL_TYPE_OTHERS),
  );
}

/** Resolved display/storage type for a draft row (Others → custom name). */
export function resolvedMaterialType(line: TypeQtyLineDraft): string {
  if (isOthersMaterialType(line.type)) return line.otherLabel.trim();
  return line.type.trim();
}

export function linesFromMaterial(
  lines: MaterialLine[] | null | undefined,
  options?: Array<{ value: string }> | null,
): TypeQtyLineDraft[] {
  if (!Array.isArray(lines) || lines.length === 0) return [emptyTypeQtyLine()];
  const known = knownOptionValues(options);
  return lines.map((line) => {
    const rawType = (line.type ?? "").trim();
    const isKnown = Boolean(rawType) && known.has(rawType);
    return {
      type: !rawType ? "" : isKnown ? rawType : MATERIAL_TYPE_OTHERS,
      otherLabel: !rawType || isKnown ? "" : rawType,
      quantity: line.quantity != null ? String(line.quantity) : "",
      delivered: line.date ? "true" : "false",
      date: line.date ?? "",
    };
  });
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
        otherLabel: typeof row.otherLabel === "string" ? row.otherLabel : "",
        quantity:
          row.quantity == null || row.quantity === ""
            ? ""
            : String(row.quantity),
        delivered: typeof row.delivered === "string" ? row.delivered : "",
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
    const type = resolvedMaterialType(line);
    if (!type || type === MATERIAL_TYPE_OTHERS) continue;
    const n = Number(line.quantity);
    const date =
      line.delivered === "true" ? line.date.trim() : "";
    if (!Number.isFinite(n) || n < 1) continue;
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
    const type = resolvedMaterialType(line);
    const n = Number(line.quantity);
    const needsDate =
      requireDate && line.delivered !== "false";
    const dateOk = !needsDate
      ? true
      : line.delivered === "true"
        ? Boolean(line.date.trim())
        : Boolean(line.date.trim());
    return (
      Boolean(type) &&
      type !== MATERIAL_TYPE_OTHERS &&
      Number.isFinite(n) &&
      n >= 1 &&
      dateOk
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
    ? parsed.filter((line) => Boolean(resolvedMaterialType(line)))
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
          const next = { ...line, ...patch };
          if (patch.delivered !== undefined && patch.delivered !== "true") {
            next.date = "";
          }
          if (patch.date !== undefined) {
            next.date = patch.date;
          }
          return next;
        }
        const next = { ...line, ...patch };
        if (patch.type !== undefined && patch.type !== line.type) {
          next.quantity = "";
          next.date = "";
          next.otherLabel = "";
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

  /** Preset types may be used once; Others can appear on multiple rows. */
  const usedPresetTypes = new Set(
    displayLines
      .map((l) => l.type.trim())
      .filter((t) => t && t !== MATERIAL_TYPE_OTHERS),
  );
  const typeLocked = datesOnly || Boolean(disabled);
  const hasOthersOption = options.some((o) => o.value === MATERIAL_TYPE_OTHERS);
  const presetCount = options.filter((o) => o.value !== MATERIAL_TYPE_OTHERS).length;
  const canAddMore =
    hasOthersOption || usedPresetTypes.size < presetCount;

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
          (o) =>
            o.value === MATERIAL_TYPE_OTHERS ||
            o.value === line.type ||
            !usedPresetTypes.has(o.value),
        );
        const typeLabel =
          options.find((o) => o.value === line.type)?.label ?? line.type;
        const displayTypeLabel = isOthersMaterialType(line.type)
          ? line.otherLabel.trim() || "Others"
          : typeLabel;
        const showQty = Boolean(line.type.trim());
        const showOtherLabel = isOthersMaterialType(line.type);

        return (
          <div key={index} className="flex flex-wrap items-center gap-2">
            {datesOnly ? (
              <Input
                className="h-8 min-w-0 flex-1 basis-40"
                value={displayTypeLabel}
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
            {showOtherLabel && !datesOnly ? (
              <Input
                value={line.otherLabel}
                disabled={typeLocked}
                placeholder="Other item"
                className="h-8 min-w-0 flex-1 basis-36"
                onChange={(e) => updateRow(index, { otherLabel: e.target.value })}
              />
            ) : null}
            {showQty ? (
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
                {datesOnly ? (
                  <div
                    className={`flex flex-wrap items-center gap-3 text-sm text-foreground ${disabled ? "pointer-events-none" : ""}`}
                  >
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer rounded border border-input accent-[var(--color-accent,#0369A1)]"
                        checked={line.delivered === "true"}
                        disabled={disabled}
                        onChange={() =>
                          updateRow(index, {
                            delivered: line.delivered === "true" ? "false" : "true",
                          })
                        }
                      />
                      <span>Yes</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer rounded border border-input accent-[var(--color-accent,#0369A1)]"
                        checked={line.delivered === "false"}
                        disabled={disabled}
                        onChange={() =>
                          updateRow(index, {
                            delivered: line.delivered === "false" ? "" : "false",
                          })
                        }
                      />
                      <span>No</span>
                    </label>
                  </div>
                ) : null}
                {showDate && (!datesOnly || line.delivered === "true") ? (
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
          disabled={disabled || !canAddMore}
          onClick={addRow}
        >
          <Plus className="size-3" />
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}
