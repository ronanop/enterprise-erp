"use client";

import { useEffect, useState } from "react";
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

export type ReceiptSerialTableLine = {
  lineId: string;
  lineNo: number;
  productLabel: string;
  additional: number;
  billingQuantity: number;
};

type ReceiptSerialsTableProps = {
  lines: ReceiptSerialTableLine[];
  serialDraft: Record<string, string[]>;
  disabled?: boolean;
  onChange: (lineId: string, slots: string[]) => void;
  onBillingQuantityChange?: (lineId: string, billingQuantity: number) => void;
  onImportError?: (message: string | null) => void;
};

function clampBillingQtyInput(raw: string, maxAllowed: number): string {
  const value = raw.trim();
  if (value === "" || value === ".") return value;
  if (!/^\d*\.?\d*$/.test(value)) return value;
  let next = value;
  if (value.includes(".")) {
    const [intPart = "", frac = ""] = value.split(".");
    const normalizedInt = intPart.replace(/^0+(?=\d)/, "") || "0";
    next = `${normalizedInt}.${frac}`;
  } else {
    next = value.replace(/^0+(?=\d)/, "");
  }
  if (next === "" || next === ".") return next;
  const n = Number(next);
  if (!Number.isFinite(n)) return next;
  if (n > maxAllowed) return String(maxAllowed);
  return next;
}

function parseBillingDraft(raw: string): number {
  const next = raw.trim();
  if (next === "" || next === ".") return 0;
  const n = Number(next);
  return Number.isFinite(n) ? n : 0;
}

function formatQtyLabel(qty: number): string {
  if (!Number.isFinite(qty)) return "0";
  const rounded = Math.round(qty * 1e6) / 1e6;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** Local text draft so values like 0.5 can be typed without the field clearing on "0". */
function BillingQuantityField({
  lineId,
  productLabel,
  receiveQty,
  billingQuantity,
  disabled,
  onBillingQuantityChange,
}: {
  lineId: string;
  productLabel: string;
  receiveQty: number;
  billingQuantity: number;
  disabled?: boolean;
  onBillingQuantityChange: (lineId: string, billingQuantity: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() =>
    billingQuantity > 0 ? String(billingQuantity) : "",
  );

  useEffect(() => {
    if (focused) return;
    setDraft(billingQuantity > 0 ? String(billingQuantity) : "");
  }, [billingQuantity, focused]);

  const display = focused ? draft : billingQuantity > 0 ? String(billingQuantity) : "";
  const billedQty = Math.max(0, Number(billingQuantity) || 0);
  const unbilledQty = Math.max(0, Math.round((receiveQty - billedQty) * 1e6) / 1e6);

  return (
    <div
      className="mx-auto flex w-fit flex-col items-center gap-0.5"
      title="Bill any amount up to receiving qty (decimals allowed). Unbilled qty goes to stock."
    >
      <div className="flex w-fit items-center gap-1 rounded-md border border-border bg-muted/30 p-1">
        <label className="flex cursor-pointer items-center px-1">
          <input
            type="checkbox"
            className="size-4 cursor-pointer accent-primary"
            checked={billingQuantity > 0}
            disabled={disabled}
            aria-label={`Bill ${productLabel}`}
            onChange={(e) => {
              onBillingQuantityChange(lineId, e.target.checked ? receiveQty : 0);
            }}
          />
        </label>
        <Input
          className="h-7 w-16 border-0 bg-transparent text-center text-xs tabular-nums shadow-none focus-visible:ring-0"
          type="text"
          inputMode="decimal"
          placeholder="0"
          disabled={disabled}
          value={display}
          aria-label={`Bill quantity for ${productLabel}`}
          onFocus={(e) => {
            setFocused(true);
            setDraft(billingQuantity > 0 ? String(billingQuantity) : "");
            e.currentTarget.select();
          }}
          onBlur={() => {
            const next = clampBillingQtyInput(draft, receiveQty);
            const parsed = Math.max(0, Math.min(receiveQty, parseBillingDraft(next)));
            const rounded = Math.round(parsed * 1e6) / 1e6;
            setDraft(rounded > 0 ? String(rounded) : "");
            onBillingQuantityChange(lineId, rounded);
            setFocused(false);
          }}
          onChange={(e) => {
            const next = clampBillingQtyInput(e.target.value, receiveQty);
            setDraft(next);
            onBillingQuantityChange(lineId, parseBillingDraft(next));
          }}
        />
      </div>
      {unbilledQty > 1e-9 ? (
        <span className="text-[10px] tabular-nums text-teal-700">
          Stock {formatQtyLabel(unbilledQty)}
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground">Fully billed</span>
      )}
    </div>
  );
}

export function ReceiptSerialsTable({
  lines,
  serialDraft,
  disabled,
  onChange,
  onBillingQuantityChange,
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
        <table className={cn(procurementUi.table, "min-w-[640px]")}>
          <thead className={procurementUi.thead}>
            <tr>
              <th className={cn(procurementUi.th, "w-12 text-center")}>S No.</th>
              <th className={procurementUi.th}>Product</th>
              <th className={cn(procurementUi.th, "w-20 text-right")}>Receiving</th>
              <th className={cn(procurementUi.th, "w-32 text-center")}>Billing</th>
              <th className={cn(procurementUi.th, "w-16 text-right")}>Unit</th>
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
              const lineImporting = importingLineId === line.lineId;
              const productSNo = lineIndex + 1;
              const rowspanCell = "align-middle";
              const receiveLabel = formatQtyLabel(receiveQty);

              return Array.from({ length: rowCount }, (_, index) => {
                const value = slots[index] ?? "";
                const isNa = value.trim().toUpperCase() === RECEIPT_SERIAL_NA;
                const fractionalOnly = unitCount <= 0;
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
                          className={cn(procurementUi.td, rowspanCell)}
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
                        <td
                          rowSpan={rowCount}
                          className={cn(procurementUi.td, rowspanCell, "text-center")}
                        >
                          {onBillingQuantityChange ? (
                            <BillingQuantityField
                              lineId={line.lineId}
                              productLabel={line.productLabel}
                              receiveQty={receiveQty}
                              billingQuantity={line.billingQuantity}
                              disabled={disabled}
                              onBillingQuantityChange={onBillingQuantityChange}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
