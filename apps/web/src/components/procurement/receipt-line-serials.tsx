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
};

type ReceiptSerialsTableProps = {
  lines: ReceiptSerialTableLine[];
  serialDraft: Record<string, string[]>;
  disabled?: boolean;
  onChange: (lineId: string, slots: string[]) => void;
  onImportError?: (message: string | null) => void;
};

export function ReceiptSerialsTable({
  lines,
  serialDraft,
  disabled,
  onChange,
  onImportError,
}: ReceiptSerialsTableProps) {
  const [importingLineId, setImportingLineId] = useState<string | null>(null);

  if (lines.length === 0) return null;

  function setSlot(lineId: string, slots: string[], index: number, value: string) {
    const next = [...slots];
    next[index] = value;
    onChange(lineId, next);
  }

  function markLineAllNa(lineId: string, unitCount: number) {
    onChange(
      lineId,
      Array.from({ length: unitCount }, () => RECEIPT_SERIAL_NA),
    );
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
              <th className={cn(procurementUi.th, "w-12")}>S No.</th>
              <th className={procurementUi.th}>Product</th>
              <th className={cn(procurementUi.th, "w-20 text-right")}>Receiving</th>
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
                          "align-top font-medium tabular-nums",
                        )}
                      >
                        {productSNo}
                      </td>
                    ) : null}
                    {index === 0 ? (
                      <>
                        <td rowSpan={unitCount} className={cn(procurementUi.td, "align-top")}>
                          <div className="space-y-1.5">
                            <span className="font-medium text-foreground">{line.productLabel}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 cursor-pointer px-2 text-[11px] transition-colors duration-200"
                              disabled={disabled || lineImporting}
                              onClick={() => markLineAllNa(line.lineId, unitCount)}
                            >
                              Mark all NA
                            </Button>
                          </div>
                        </td>
                        <td
                          rowSpan={unitCount}
                          className={cn(procurementUi.tdNumeric, "align-top text-right font-medium")}
                        >
                          {unitCount}
                        </td>
                      </>
                    ) : null}
                    <td className={cn(procurementUi.tdNumeric, "text-right text-muted-foreground")}>
                      {index + 1}
                    </td>
                    <td className={procurementUi.td}>
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
                    <td className={cn(procurementUi.td, "text-center")}>
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
                        className={cn(procurementUi.td, "align-top text-center")}
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
