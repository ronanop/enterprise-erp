"use client";

import { useMemo } from "react";

import { procurementUi } from "@/components/procurement/procurement-ui";
import { cn } from "@/lib/utils";
import type { ProcurementInventoryRow, VendorOption } from "@/services/procurement-service";
import {
  formatGrnProductSummary,
  formatGrnSerialSummary,
  groupInventoryByPoAndGrn,
} from "@/utils/procurement-inventory-grouping";
import { isInventoryLedgerRow } from "@/utils/procurement-inventory-report";

function formatReceiptDate(value: string | null): string {
  if (!value) return "—";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

type GrnStockSummaryTableProps = {
  rows: ProcurementInventoryRow[];
  vendors: Record<string, VendorOption>;
  loading?: boolean;
  query?: string;
};

export function GrnStockSummaryTable({
  rows,
  vendors,
  loading,
  query = "",
}: GrnStockSummaryTableProps) {
  const filtered = useMemo(() => {
    const grnRows = rows.filter(isInventoryLedgerRow);
    const q = query.trim().toLowerCase();
    if (!q) return grnRows;
    return grnRows.filter((row) => {
      const vendor = row.vendor_id ? (vendors[row.vendor_id]?.label ?? "") : "";
      return [row.grn_number, row.company_po_number, vendor, row.product_name, row.serial_number]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, vendors]);

  const poGroups = useMemo(() => groupInventoryByPoAndGrn(filtered), [filtered]);

  return (
    <div className={procurementUi.sectionCard}>
      <p className={procurementUi.sectionTitle}>GRN list</p>
      <div className={procurementUi.tableScroll}>
        <table className={cn(procurementUi.table, "min-w-[800px]")}>
          <thead className={procurementUi.thead}>
            <tr>
              <th className={procurementUi.th}>PO</th>
              <th className={procurementUi.th}>GRN</th>
              <th className={procurementUi.th}>GRN date</th>
              <th className={procurementUi.th}>Vendor</th>
              <th className={procurementUi.th}>Products</th>
              <th className={cn(procurementUi.th, "text-right")}>Units</th>
              <th className={procurementUi.th}>Serial numbers</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className={procurementUi.empty}>
                  {loading
                    ? "Loading GRN list…"
                    : rows.filter(isInventoryLedgerRow).length === 0
                      ? "No GRN stock units. Receive on a GRN with partial billing to see not-billed units here."
                      : "No rows match your search."}
                </td>
              </tr>
            ) : null}
            {poGroups.flatMap((po, poIndex) => {
              const bandRow =
                poIndex % 2 === 0
                  ? "bg-muted/30 hover:bg-muted/40"
                  : "bg-sky-50/45 hover:bg-sky-50/65";
              const bandPoCell = poIndex % 2 === 0 ? "bg-muted/45" : "bg-sky-100/55";
              return po.grns.map((grn, grnIndex) => (
                <tr
                  key={`${po.company_po_number}-${grn.grn_number}`}
                  className={cn(
                    "border-b border-border/45 transition-colors duration-150",
                    bandRow,
                    grnIndex === 0 && poIndex > 0 && "border-t-2 border-t-border/70",
                  )}
                >
                  {grnIndex === 0 ? (
                    <td
                      rowSpan={po.grns.length}
                      className={cn(
                        procurementUi.td,
                        bandPoCell,
                        "align-top border-r border-border/50 font-semibold tabular-nums text-foreground",
                      )}
                    >
                      {po.company_po_number}
                    </td>
                  ) : null}
                  <td className={cn(procurementUi.tdNumeric, "tabular-nums font-medium text-foreground")}>
                    {grn.grn_number}
                  </td>
                  <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                    {formatReceiptDate(grn.receipt_at)}
                  </td>
                  <td className={procurementUi.tdMuted}>
                    {grn.vendor_id ? (vendors[grn.vendor_id]?.label ?? "—") : "—"}
                  </td>
                  <td className={cn(procurementUi.td, "max-w-[280px]")}>
                    <span className="line-clamp-3" title={formatGrnProductSummary(grn.lines)}>
                      {formatGrnProductSummary(grn.lines)}
                    </span>
                  </td>
                  <td className={cn(procurementUi.tdNumeric, "text-right tabular-nums font-medium")}>
                    {grn.totalUnits}
                  </td>
                  <td
                    className={cn(
                      procurementUi.td,
                      "max-w-[200px] font-mono text-xs text-muted-foreground",
                    )}
                    title={formatGrnSerialSummary(grn.lines)}
                  >
                    <span className="line-clamp-2">{formatGrnSerialSummary(grn.lines)}</span>
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
