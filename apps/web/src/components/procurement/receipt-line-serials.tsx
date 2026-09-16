"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

import {
  resizeSerialSlots,
  serialUnitCount,
} from "@/utils/receipt-serial-numbers";
import {
  importLineSerialsFromFile,
  RECEIPT_SERIAL_FILE_ACCEPT,
} from "@/utils/receipt-serials-excel";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type GrnLineDisposition = "bill" | "delivery_challan" | "stock" | "split";
export type GrnUnitKind = "bill" | "delivery_challan" | "stock";

const UNIT_KIND_ORDER: GrnUnitKind[] = ["stock", "bill", "delivery_challan"];

export type ReceiptSerialTableLine = {
  lineId: string;
  lineNo: number;
  productLabel: string;
  productName?: string;
  description?: string;
  hsnSac?: string;
  additional: number;
  billingQuantity: number;
  disposition: GrnLineDisposition;
  unitKinds?: GrnUnitKind[];
  /** Max receive qty still allowed for this line (remaining on PO). */
  maxAdditional?: number;
};

type ReceiptSerialsTableProps = {
  lines: ReceiptSerialTableLine[];
  serialDraft: Record<string, string[]>;
  disabled?: boolean;
  onChange: (lineId: string, slots: string[]) => void;
  onDispositionChange?: (lineId: string, kind: GrnUnitKind) => void;
  onQuantityChange?: (lineId: string, quantity: number) => void;
  onImportError?: (message: string | null) => void;
};

function formatQtyLabel(qty: number): string {
  if (!Number.isFinite(qty)) return "0";
  const rounded = Math.round(qty * 1e6) / 1e6;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function dispositionFromBillingQuantity(
  receiveQty: number,
  billingQuantity: number,
  deliveryChallanQuantity = 0,
): GrnLineDisposition {
  const bill = Math.max(0, Math.min(receiveQty, billingQuantity));
  const dc = Math.max(0, Math.min(receiveQty - bill, deliveryChallanQuantity));
  const stock = Math.max(0, receiveQty - bill - dc);
  const parts = [bill > 1e-9, dc > 1e-9, stock > 1e-9].filter(Boolean).length;
  if (parts > 1) return "split";
  if (bill >= receiveQty - 1e-9) return "bill";
  if (dc >= receiveQty - 1e-9) return "delivery_challan";
  return "stock";
}

export function resizeUnitKinds(prev: GrnUnitKind[] | undefined, count: number): GrnUnitKind[] {
  if (count <= 0) return [];
  const next = (prev ?? []).slice(0, count);
  while (next.length < count) next.push("stock");
  return next;
}

export function quantityFromUnitKinds(
  kinds: GrnUnitKind[],
  receiveQty: number,
  kind: GrnUnitKind,
): number {
  const units = serialUnitCount(receiveQty);
  if (units <= 0) {
    return kinds[0] === kind ? receiveQty : 0;
  }
  const counted = kinds.filter((entry) => entry === kind).length;
  return Math.min(receiveQty, counted);
}

export function billingQuantityFromUnitKinds(
  kinds: GrnUnitKind[],
  receiveQty: number,
): number {
  return quantityFromUnitKinds(kinds, receiveQty, "bill");
}

export function deliveryChallanQuantityFromUnitKinds(
  kinds: GrnUnitKind[],
  receiveQty: number,
): number {
  return quantityFromUnitKinds(kinds, receiveQty, "delivery_challan");
}

/** Map a single line-level disposition to billing / DC qty (stock = neither). */
export function quantitiesFromLineDisposition(
  kind: GrnUnitKind,
  receiveQty: number,
): {
  disposition: GrnLineDisposition;
  billingQuantity: number;
  deliveryChallanQuantity: number;
  unitKinds: GrnUnitKind[];
} {
  const qty = Math.max(0, receiveQty);
  const units = Math.max(serialUnitCount(qty), qty > 0 ? 1 : 0);
  const unitKinds = resizeUnitKinds(
    Array.from({ length: units }, () => kind),
    units,
  );
  if (kind === "bill") {
    return {
      disposition: "bill",
      billingQuantity: qty,
      deliveryChallanQuantity: 0,
      unitKinds,
    };
  }
  if (kind === "delivery_challan") {
    return {
      disposition: "delivery_challan",
      billingQuantity: 0,
      deliveryChallanQuantity: qty,
      unitKinds,
    };
  }
  return {
    disposition: "stock",
    billingQuantity: 0,
    deliveryChallanQuantity: 0,
    unitKinds,
  };
}

export function lineDispositionKind(line: {
  disposition?: GrnLineDisposition;
  billingQuantity?: number;
  unitKinds?: GrnUnitKind[];
  additional?: number;
}): GrnUnitKind {
  if (line.disposition === "bill") return "bill";
  if (line.disposition === "delivery_challan") return "delivery_challan";
  if (line.disposition === "stock") return "stock";
  const kinds = line.unitKinds || [];
  if (kinds.length > 0 && kinds.every((k) => k === "bill")) return "bill";
  if (kinds.length > 0 && kinds.every((k) => k === "delivery_challan")) {
    return "delivery_challan";
  }
  const receiveQty = Number(line.additional) || 0;
  if ((line.billingQuantity || 0) >= receiveQty - 1e-9 && receiveQty > 0) return "bill";
  return "stock";
}

export function serialsTextFromSlots(slots: string[]): string {
  return slots.map((s) => s.trim()).filter(Boolean).join(", ");
}

export function slotsFromSerialsText(text: string, unitCount: number): string[] {
  const parsed = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return resizeSerialSlots(parsed, unitCount);
}

function DispositionSlide({
  kind,
  disabled,
  productLabel,
  onChange,
}: {
  kind: GrnUnitKind;
  disabled?: boolean;
  productLabel: string;
  onChange: (kind: GrnUnitKind) => void;
}) {
  const activeIndex = Math.max(0, UNIT_KIND_ORDER.indexOf(kind));
  const thumbClass =
    kind === "bill" ? "bg-sky-700" : kind === "delivery_challan" ? "bg-teal-700" : "bg-slate-700";
  const frameClass =
    kind === "bill"
      ? "border-sky-300/80 bg-sky-50"
      : kind === "delivery_challan"
        ? "border-teal-300/80 bg-teal-50"
        : "border-slate-300/80 bg-slate-50";
  return (
    <div
      role="group"
      aria-label={`Stock, billing, or delivery challan for ${productLabel}`}
      className={cn(
        "relative inline-flex h-8 w-[11.25rem] shrink-0 overflow-hidden rounded-lg border p-0.5",
        "transition-[border-color,background-color] duration-200 motion-reduce:transition-none",
        frameClass,
        disabled && "opacity-50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0.5 w-[calc(33.333%-2px)] rounded-md shadow-sm",
          "transition-[transform,background-color] duration-200 ease-out motion-reduce:transition-none",
          thumbClass,
        )}
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {UNIT_KIND_ORDER.map((value) => {
        const selected = kind === value;
        const label = value === "bill" ? "Billing" : value === "delivery_challan" ? "DC" : "Stock";
        const idleColor =
          value === "bill" ? "text-sky-900" : value === "delivery_challan" ? "text-teal-900" : "text-slate-800";
        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            className={cn(
              "relative z-10 h-full flex-1 cursor-pointer rounded-md text-[10px] font-semibold uppercase tracking-wide",
              "transition-[color,opacity] duration-200 motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              "disabled:cursor-not-allowed",
              selected ? "text-white" : idleColor,
            )}
            onClick={() => onChange(value)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function ReceiptSerialsTable({
  lines,
  serialDraft,
  disabled,
  onChange,
  onDispositionChange,
  onQuantityChange,
  onImportError,
}: ReceiptSerialsTableProps) {
  const [importingLineId, setImportingLineId] = useState<string | null>(null);
  const [serialTextDraft, setSerialTextDraft] = useState<Record<string, string>>({});

  if (lines.length === 0) return null;

  function displaySerialText(lineId: string, slots: string[]): string {
    if (Object.prototype.hasOwnProperty.call(serialTextDraft, lineId)) {
      return serialTextDraft[lineId] ?? "";
    }
    return serialsTextFromSlots(slots);
  }

  async function onImportLine(line: ReceiptSerialTableLine, file: File) {
    setImportingLineId(line.lineId);
    onImportError?.(null);
    try {
      const result = await importLineSerialsFromFile(file, {
        lineId: line.lineId,
        receiveQty: serialUnitCount(line.additional),
        productLabel: line.productLabel,
      });
      if (!result.ok) {
        onImportError?.(result.message);
        return;
      }
      const slots = result.serialDraft[line.lineId];
      if (slots) {
        onChange(line.lineId, slots);
        setSerialTextDraft((prev) => {
          const next = { ...prev };
          delete next[line.lineId];
          return next;
        });
      }
      onImportError?.(result.warning ?? null);
    } finally {
      setImportingLineId(null);
    }
  }

  return (
    <div className={procurementUi.tableShell}>
      <div className={procurementUi.tableScroll}>
        <table className={cn(procurementUi.table, "min-w-[920px]")}>
          <thead className={procurementUi.thead}>
            <tr>
              <th className={cn(procurementUi.th, "w-12 text-center")}>S No.</th>
              <th className={procurementUi.th}>Product</th>
              <th className={procurementUi.th}>Description</th>
              <th className={cn(procurementUi.th, "w-24")}>HSN/SAC</th>
              <th className={cn(procurementUi.th, "w-[11.5rem] text-center")}>Stock / Billing / DC</th>
              <th className={cn(procurementUi.th, "w-24 text-right")}>Qty</th>
              <th className={procurementUi.th}>Serial number</th>
              <th className={cn(procurementUi.th, "w-[7.5rem] text-center")}>Import</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, lineIndex) => {
              const receiveQty = line.additional;
              const unitCount = serialUnitCount(receiveQty);
              const slots = resizeSerialSlots(serialDraft[line.lineId] || [], unitCount);
              const disposition = lineDispositionKind(line);
              const lineImporting = importingLineId === line.lineId;
              const fractionalOnly = unitCount <= 0 && receiveQty > 0;
              const serialText = displaySerialText(line.lineId, slots);
              const maxQty = line.maxAdditional ?? receiveQty;
              const productName = (line.productName || line.productLabel || "-").trim() || "-";
              const description = (line.description || "").trim() || "-";
              const hsnSac = (line.hsnSac || "").trim() || "-";

              return (
                <tr key={line.lineId} className={procurementUi.tr}>
                  <td
                    className={cn(
                      procurementUi.tdNumeric,
                      "text-center font-medium tabular-nums align-middle",
                    )}
                  >
                    {lineIndex + 1}
                  </td>
                  <td className={cn(procurementUi.td, "min-w-[120px] align-middle")}>
                    <span className="font-medium text-foreground">{productName}</span>
                  </td>
                  <td className={cn(procurementUi.td, "min-w-[140px] align-middle text-muted-foreground")}>
                    {description}
                  </td>
                  <td className={cn(procurementUi.td, "align-middle tabular-nums text-muted-foreground")}>
                    {hsnSac}
                  </td>
                  <td className={cn(procurementUi.td, "align-middle text-center")}>
                    {onDispositionChange ? (
                      <DispositionSlide
                        kind={disposition}
                        disabled={disabled || lineImporting}
                        productLabel={line.productLabel}
                        onChange={(kind) => onDispositionChange(line.lineId, kind)}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {disposition === "bill"
                          ? "Billing"
                          : disposition === "delivery_challan"
                            ? "DC"
                            : "Stock"}
                      </span>
                    )}
                  </td>
                  <td className={cn(procurementUi.tdNumeric, "align-middle text-right")}>
                    {onQuantityChange ? (
                      <Input
                        type="number"
                        min={0}
                        max={maxQty}
                        step="1"
                        inputMode="decimal"
                        className="h-8 w-full min-w-[4.5rem] cursor-text text-right tabular-nums text-xs transition-colors duration-200"
                        value={formatQtyLabel(receiveQty)}
                        disabled={disabled || lineImporting}
                        aria-label={`Quantity for ${line.productLabel}`}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (!Number.isFinite(next) || next < 0) return;
                          onQuantityChange(line.lineId, Math.min(maxQty, next));
                          setSerialTextDraft((prev) => {
                            const copy = { ...prev };
                            delete copy[line.lineId];
                            return copy;
                          });
                        }}
                      />
                    ) : (
                      <span className="font-medium tabular-nums">{formatQtyLabel(receiveQty)}</span>
                    )}
                  </td>
                  <td className={cn(procurementUi.td, "align-middle")}>
                    {fractionalOnly ? (
                      <span className="text-xs text-muted-foreground">
                        No serial for fractional qty
                      </span>
                    ) : unitCount <= 0 ? (
                      <span className="text-xs text-muted-foreground">Enter qty first</span>
                    ) : (
                      <Input
                        className="h-8 w-full min-w-[180px] cursor-text font-mono text-xs transition-colors duration-200"
                        value={serialText}
                        disabled={disabled || lineImporting}
                        placeholder={`e.g. SN1, SN2, … (${unitCount})`}
                        aria-label={`Serial numbers for ${line.productLabel}`}
                        onChange={(e) => {
                          const text = e.target.value;
                          setSerialTextDraft((prev) => ({ ...prev, [line.lineId]: text }));
                          onChange(line.lineId, slotsFromSerialsText(text, unitCount));
                        }}
                        onBlur={() => {
                          setSerialTextDraft((prev) => {
                            const copy = { ...prev };
                            delete copy[line.lineId];
                            return copy;
                          });
                        }}
                      />
                    )}
                  </td>
                  <td className={cn(procurementUi.td, "text-center align-middle")}>
                    {unitCount <= 0 ? (
                      <span className="text-xs text-muted-foreground">-</span>
                    ) : (
                      <label
                        className={cn(
                          buttonVariants({ size: "sm", variant: "outline" }),
                          "h-7 cursor-pointer gap-1 px-2 text-[11px] transition-colors duration-200",
                          (disabled || lineImporting) && "pointer-events-none opacity-50",
                        )}
                        title="Import serials for this product"
                      >
                        <Upload className="size-3" aria-hidden />
                        Import
                        <input
                          type="file"
                          accept={RECEIPT_SERIAL_FILE_ACCEPT}
                          className="sr-only"
                          disabled={disabled || lineImporting}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void onImportLine(line, file);
                          }}
                        />
                      </label>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
