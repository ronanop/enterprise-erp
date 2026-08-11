"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

import {
  RECEIPT_SERIAL_NA,
  resizeSerialSlots,
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

  function clampBillingQtyInput(raw: string, maxAllowed: number): string {
    const value = raw.trim();
    if (value === "") return "";
    if (!/^\d*$/.test(value)) return value.replace(/\D/g, "");
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    if (n > maxAllowed) return String(maxAllowed);
    return value.replace(/^0+(?=\d)/, "");
  }

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
        receiveQty: line.additional,
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
              const unitCount = line.additional;
              const slots = resizeSerialSlots(serialDraft[line.lineId] || [], unitCount);
              const lineImporting = importingLineId === line.lineId;
              const productSNo = lineIndex + 1;
              const rowspanCell = "align-middle";
              return Array.from({ length: unitCount }, (_, index) => {
                const value = slots[index] ?? "";
                const isNa = value.trim().toUpperCase() === RECEIPT_SERIAL_NA;
                return (
                  <tr key={`${line.lineId}-${index}`} className={procurementUi.tr}>
                    {index === 0 ? (
                      <td
                        rowSpan={unitCount}
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
                          rowSpan={unitCount}
                          className={cn(procurementUi.td, rowspanCell)}
                        >
                          <span className="font-medium text-foreground">{line.productLabel}</span>
                        </td>
                        <td
                          rowSpan={unitCount}
                          className={cn(
                            procurementUi.tdNumeric,
                            rowspanCell,
                            "text-right font-medium tabular-nums",
                          )}
                        >
                          {unitCount}
                        </td>
                        <td
                          rowSpan={unitCount}
                          className={cn(procurementUi.td, rowspanCell, "text-center")}
                        >
                          <div
                            className="mx-auto flex w-fit items-center gap-1 rounded-md border border-border bg-muted/30 p-1"
                            title="Tick to bill all units, or type how many to bill"
                          >
                            <label className="flex cursor-pointer items-center px-1">
                              <input
                                type="checkbox"
                                className="size-4 cursor-pointer accent-primary"
                                checked={line.billingQuantity > 0}
                                disabled={disabled || !onBillingQuantityChange}
                                aria-label={`Bill ${line.productLabel}`}
                                onChange={(e) => {
                                  if (!onBillingQuantityChange) return;
                                  onBillingQuantityChange(
                                    line.lineId,
                                    e.target.checked ? unitCount : 0,
                                  );
                                }}
                              />
                            </label>
                            <Input
                              className="h-7 w-12 border-0 bg-transparent text-center text-xs tabular-nums shadow-none focus-visible:ring-0"
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              disabled={disabled || !onBillingQuantityChange}
                              value={
                                line.billingQuantity > 0
                                  ? String(line.billingQuantity)
                                  : ""
                              }
                              aria-label={`Bill quantity for ${line.productLabel}`}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                if (!onBillingQuantityChange) return;
                                const next = clampBillingQtyInput(
                                  e.target.value,
                                  unitCount,
                                );
                                const parsed = next === "" ? 0 : Number(next);
                                onBillingQuantityChange(
                                  line.lineId,
                                  Number.isFinite(parsed) ? parsed : 0,
                                );
                              }}
                            />
                          </div>
                        </td>
                      </>
                    ) : null}
                    <td
                      className={cn(
                        procurementUi.tdNumeric,
                        "align-middle text-right tabular-nums text-muted-foreground",
                      )}
                    >
                      {index + 1}
                    </td>
                    <td className={cn(procurementUi.td, "align-middle")}>
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
                    </td>
                    <td className={cn(procurementUi.td, "align-middle text-center")}>
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
                    </td>
                    {index === 0 ? (
                      <td
                        rowSpan={unitCount}
                        className={cn(procurementUi.td, rowspanCell, "text-center")}
                      >
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
