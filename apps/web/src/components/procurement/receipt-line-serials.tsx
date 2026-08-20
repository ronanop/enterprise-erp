"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

import {
  RECEIPT_SERIAL_NA,
  resizeSerialSlots,
  serialUnitCount,
} from "@/utils/receipt-serial-numbers";
import {
  importLineSerialsFromFile,
  RECEIPT_SERIAL_FILE_ACCEPT,
} from "@/utils/receipt-serials-excel";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type GrnLineDisposition = "bill" | "delivery_challan" | "split";
export type GrnUnitKind = "bill" | "delivery_challan";

export type ReceiptSerialTableLine = {
  lineId: string;
  lineNo: number;
  productLabel: string;
  additional: number;
  billingQuantity: number;
  disposition: GrnLineDisposition;
  unitKinds?: GrnUnitKind[];
};

type ReceiptSerialsTableProps = {
  lines: ReceiptSerialTableLine[];
  serialDraft: Record<string, string[]>;
  disabled?: boolean;
  onChange: (lineId: string, slots: string[]) => void;
  onUnitKindChange?: (lineId: string, unitIndex: number, kind: GrnUnitKind) => void;
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
): GrnLineDisposition {
  const bill = Math.max(0, Math.min(receiveQty, billingQuantity));
  if (bill <= 1e-9) return "delivery_challan";
  if (bill >= receiveQty - 1e-9) return "bill";
  return "split";
}

export function resizeUnitKinds(prev: GrnUnitKind[] | undefined, count: number): GrnUnitKind[] {
  if (count <= 0) return [];
  const next = (prev ?? []).slice(0, count);
  while (next.length < count) next.push("delivery_challan");
  return next;
}

export function billingQuantityFromUnitKinds(
  kinds: GrnUnitKind[],
  receiveQty: number,
): number {
  const units = serialUnitCount(receiveQty);
  if (units <= 0) {
    return kinds[0] === "bill" ? receiveQty : 0;
  }
  const billed = kinds.filter((kind) => kind === "bill").length;
  return Math.min(receiveQty, billed);
}

function UnitKindSlide({
  kind,
  disabled,
  productLabel,
  unitIndex,
  onChange,
}: {
  kind: GrnUnitKind;
  disabled?: boolean;
  productLabel: string;
  unitIndex: number;
  onChange: (kind: GrnUnitKind) => void;
}) {
  const isBilling = kind === "bill";
  return (
    <div
      role="group"
      aria-label={`Billing or delivery challan for unit ${unitIndex + 1} of ${productLabel}`}
      className={cn(
        "relative inline-flex h-8 w-[8.25rem] shrink-0 overflow-hidden rounded-lg border p-0.5",
        "transition-[border-color,background-color] duration-200 motion-reduce:transition-none",
        isBilling
          ? "border-sky-300/80 bg-sky-50"
          : "border-teal-300/80 bg-teal-50",
        disabled && "opacity-50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md shadow-sm",
          "transition-[transform,background-color] duration-200 ease-out motion-reduce:transition-none",
          isBilling ? "translate-x-0 bg-sky-700" : "translate-x-full bg-teal-700",
        )}
      />
      <button
        type="button"
        disabled={disabled}
        aria-pressed={isBilling}
        className={cn(
          "relative z-10 h-full flex-1 cursor-pointer rounded-md text-[10px] font-semibold uppercase tracking-wide",
          "transition-[color,opacity] duration-200 motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed",
          isBilling ? "text-white" : "text-sky-900",
        )}
        onClick={() => onChange("bill")}
      >
        Billing
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={!isBilling}
        className={cn(
          "relative z-10 h-full flex-1 cursor-pointer rounded-md text-[10px] font-semibold uppercase tracking-wide",
          "transition-[color,opacity] duration-200 motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed",
          !isBilling ? "text-white" : "text-teal-900",
        )}
        onClick={() => onChange("delivery_challan")}
      >
        DC
      </button>
    </div>
  );
}

export function ReceiptSerialsTable({
  lines,
  serialDraft,
  disabled,
  onChange,
  onUnitKindChange,
  onImportError,
}: ReceiptSerialsTableProps) {
  const [importingLineId, setImportingLineId] = useState<string | null>(null);

  if (lines.length === 0) return null;

  function setSlot(lineId: string, slots: string[], index: number, value: string) {
    const next = [...slots];
    next[index] = value;
    onChange(lineId, next);
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
      }
      onImportError?.(result.warning ?? null);
    } finally {
      setImportingLineId(null);
    }
  }

  return (
    <div className={procurementUi.tableShell}>
      <div className={procurementUi.tableScroll}>
        <table className={cn(procurementUi.table, "min-w-[760px]")}>
          <thead className={procurementUi.thead}>
            <tr>
              <th className={cn(procurementUi.th, "w-12 text-center")}>S No.</th>
              <th className={procurementUi.th}>Product</th>
              <th className={cn(procurementUi.th, "w-20 text-right")}>Receiving</th>
              <th className={cn(procurementUi.th, "w-16 text-right")}>Unit</th>
              <th className={cn(procurementUi.th, "w-[8rem] text-center")}>Billing / DC</th>
              <th className={procurementUi.th}>Serial number</th>
              <th className={cn(procurementUi.th, "w-24 text-center")}>NA</th>
              <th className={cn(procurementUi.th, "w-[7.5rem] text-center")}>Import</th>
            </tr>
          </thead>
          <tbody>
            {lines.flatMap((line, lineIndex) => {
              const receiveQty = line.additional;
              const unitCount = serialUnitCount(receiveQty);
              const rowCount = Math.max(unitCount, 1);
              const slots = resizeSerialSlots(serialDraft[line.lineId] || [], unitCount);
              const kinds = resizeUnitKinds(line.unitKinds, rowCount);
              const lineImporting = importingLineId === line.lineId;
              const productSNo = lineIndex + 1;
              const rowspanCell = "align-middle";
              const receiveLabel = formatQtyLabel(receiveQty);

              return Array.from({ length: rowCount }, (_, index) => {
                const value = slots[index] ?? "";
                const isNa = value.trim().toUpperCase() === RECEIPT_SERIAL_NA;
                const fractionalOnly = unitCount <= 0;
                const unitKind = kinds[index] ?? "delivery_challan";
                return (
                  <tr key={`${line.lineId}-${index}`} className={procurementUi.tr}>
                    {index === 0 ? (
                      <td
                        rowSpan={rowCount}
                        className={cn(
                          procurementUi.tdNumeric,
                          rowspanCell,
                          "text-center font-medium tabular-nums",
                        )}
                      >
                        {productSNo}
                      </td>
                    ) : null}
                    {index === 0 ? (
                      <>
                        <td
                          rowSpan={rowCount}
                          className={cn(procurementUi.td, rowspanCell, "min-w-[160px]")}
                        >
                          <span className="font-medium text-foreground">{line.productLabel}</span>
                        </td>
                        <td
                          rowSpan={rowCount}
                          className={cn(
                            procurementUi.tdNumeric,
                            rowspanCell,
                            "text-right font-medium tabular-nums",
                          )}
                        >
                          {receiveLabel}
                        </td>
                      </>
                    ) : null}
                    <td
                      className={cn(
                        procurementUi.tdNumeric,
                        "align-middle text-right tabular-nums text-muted-foreground",
                      )}
                    >
                      {fractionalOnly ? "—" : index + 1}
                    </td>
                    <td className={cn(procurementUi.td, "align-middle text-center")}>
                      {onUnitKindChange ? (
                        <UnitKindSlide
                          kind={unitKind}
                          disabled={disabled || lineImporting}
                          productLabel={line.productLabel}
                          unitIndex={index}
                          onChange={(kind) => onUnitKindChange(line.lineId, index, kind)}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {unitKind === "bill" ? "Billing" : "DC"}
                        </span>
                      )}
                    </td>
                    <td className={cn(procurementUi.td, "align-middle")}>
                      {fractionalOnly ? (
                        <span className="text-xs text-muted-foreground">
                          No serial for fractional qty
                        </span>
                      ) : (
                        <Input
                          className={cn(
                            "h-8 w-full min-w-[140px] cursor-text font-mono text-xs transition-colors duration-200",
                            isNa && "text-muted-foreground",
                          )}
                          value={value}
                          disabled={disabled || lineImporting}
                          placeholder="Enter serial or use NA"
                          aria-label={`Serial ${index + 1} for ${line.productLabel}`}
                          onFocus={(e) => {
                            if (isNa) {
                              setSlot(line.lineId, slots, index, "");
                            }
                            e.currentTarget.select();
                          }}
                          onChange={(e) => setSlot(line.lineId, slots, index, e.target.value)}
                        />
                      )}
                    </td>
                    <td className={cn(procurementUi.td, "align-middle text-center")}>
                      {fractionalOnly ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Button
                          type="button"
                          variant={isNa ? "secondary" : "outline"}
                          size="sm"
                          className="h-8 min-w-[3rem] cursor-pointer px-2 text-xs transition-colors duration-200"
                          disabled={disabled || lineImporting}
                          onClick={() =>
                            setSlot(line.lineId, slots, index, isNa ? "" : RECEIPT_SERIAL_NA)
                          }
                        >
                          NA
                        </Button>
                      )}
                    </td>
                    {index === 0 ? (
                      <td
                        rowSpan={rowCount}
                        className={cn(procurementUi.td, rowspanCell, "text-center")}
                      >
                        {fractionalOnly ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <label
                            className={cn(
                              buttonVariants({ size: "sm", variant: "outline" }),
                              "h-7 cursor-pointer gap-1 px-2 text-[11px] transition-colors duration-200",
                              (disabled || lineImporting) && "pointer-events-none opacity-50",
                            )}
                            title="Import serials for all units of this product"
                          >
                            <Upload className="size-3" aria-hidden />
                            Import serials
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
                    ) : null}
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
