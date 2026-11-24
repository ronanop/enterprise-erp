"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, MapPinned, Receipt, RefreshCw } from "lucide-react";

import { DeliveryStatusOutcomeDialog } from "@/components/procurement/delivery-status-outcome-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { ListSearch } from "@/components/shared/list-toolbar";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listProcurementInventory, createInvoiceGenerationTasks, listOrderReceiptBatches } from "@/services/procurement-service";
import { ApiClientError } from "@/services/api-client";
import {
  getDeliveryChallan,
  listDeliveryChallans,
  upsertDeliveryChallan,
  type DeliveryChallanRecord,
} from "@/utils/delivery-challan-storage";
import { invoiceAlreadyCreatedForChallan, invoiceNumberForDeliveryChallan } from "@/utils/grn-challan-pending";
import {
  buildDeliveryStatusExportRows,
  exportDeliveryStatusXlsx,
} from "@/utils/delivery-status-excel-export";
import { consumeDeliveryStatusFlash, setDeliveryStatusFlash } from "@/utils/delivery-status-flash";
import { deliveryStatusUpdateHref } from "@/utils/delivery-status-routes";
import {
  deliveryStatusRowFromChallan,
  deliveryStatusUiMode,
  shipmentStatusBadgeVariant,
  type DeliveryStatusRow,
} from "@/utils/delivery-status-storage";
import {
  formatGeneratedGrnNumbers,
  resolveChallanDisplayGrnNumbers,
  uniqueGeneratedGrnNumbers,
} from "@/utils/grn-number-display";
import { formatUniquePoLabels } from "@/utils/format-po-labels";

type DeliveryStatusListRow = DeliveryStatusRow & {
  canUpdateOutcome: boolean;
  directBilling: boolean;
  /** Invoice number found on any challan / billing record of the same PO. */
  groupInvoice?: string;
};

function documentNumbers(row: DeliveryStatusListRow): { challan: string; invoice: string } {
  const challan = getDeliveryChallan(row.challanId);
  const isBilling = (challan?.grnKind || "delivery_challan") === "billing";
  const challanNumber = isBilling
    ? ""
    : (challan?.challanNumber || row.challanNumber || "").trim();
  let invoice = challan ? invoiceNumberForDeliveryChallan(challan) : "";
  if (!invoice) {
    const stored = (row.billInvoiceNumber || "").trim();
    if (
      stored &&
      stored !== challanNumber &&
      !/^DC\//i.test(stored)
    ) {
      invoice = stored;
    }
  }
  return { challan: challanNumber, invoice: invoice || (row.groupInvoice || "").trim() };
}

function poGroupKey(row: DeliveryStatusListRow): string {
  return (row.purchaseOrderNumber || row.orderId || row.challanId || "").trim().toLowerCase();
}

/** One row per PO: the dispatched delivery challan wins, else the latest record. */
function collapseRowsByPo(rows: DeliveryStatusListRow[]): DeliveryStatusListRow[] {
  const groups = new Map<string, DeliveryStatusListRow[]>();
  for (const row of rows) {
    const key = poGroupKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const rank = (row: DeliveryStatusListRow) =>
    (row.canUpdateOutcome ? 2 : 0) + (row.directBilling ? 0 : 1);
  return [...groups.values()].map((group) => {
    const primary = [...group].sort((a, b) => {
      const diff = rank(b) - rank(a);
      if (diff !== 0) return diff;
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    })[0];
    const groupInvoice =
      group.map((row) => documentNumbers(row).invoice).find(Boolean) || "";
    return { ...primary, groupInvoice };
  });
}

function loadDeliveryStatusRows(): DeliveryStatusListRow[] {
  const rows = listDeliveryChallans().flatMap((challan) => {
    const kind = challan.grnKind || "delivery_challan";
    if (kind === "billing" && challan.sourceChallanId) return [];
    try {
      const row = deliveryStatusRowFromChallan(challan);
      return [
        {
          ...row,
          canUpdateOutcome: deliveryStatusUiMode(row) === "tracking",
          directBilling: kind === "billing",
        },
      ];
    } catch {
      return [];
    }
  });
  return collapseRowsByPo(rows);
}

async function enrichDeliveryStatusGrnNumbers(
  rows: DeliveryStatusListRow[],
): Promise<DeliveryStatusListRow[]> {
  try {
    const inventory = await listProcurementInventory();
    return rows.map((row) => {
      const challan = getDeliveryChallan(row.challanId);
      if (!challan) return row;
      const numbers = resolveChallanDisplayGrnNumbers(challan, inventory);
      const label = formatGeneratedGrnNumbers(numbers);
      const storedClean = uniqueGeneratedGrnNumbers(challan.selectedGrnNumbers);
      if (
        numbers.length > 0 &&
        (storedClean.join("\0") !== numbers.join("\0") ||
          (challan.selectedGrnNumbers?.length ?? 0) !== numbers.length)
      ) {
        upsertDeliveryChallan({
          ...challan,
          selectedGrnNumbers: numbers,
        });
      }
      return { ...row, grnSummary: label };
    });
  } catch {
    return rows;
  }
}

export function DeliveryStatusListPage() {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<ReturnType<typeof consumeDeliveryStatusFlash>>(null);
  const [rows, setRows] = useState<DeliveryStatusListRow[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [invoiceNotice, setInvoiceNotice] = useState<string | null>(null);
  const [invoiceBusyId, setInvoiceBusyId] = useState<string | null>(null);
  const [outcomeChallan, setOutcomeChallan] = useState<DeliveryChallanRecord | null>(null);

  const load = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    setFlash(consumeDeliveryStatusFlash());
    const base = loadDeliveryStatusRows();
    setRows(base);
    void enrichDeliveryStatusGrnNumbers(base).then(setRows);
  }, [version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.purchaseOrderNumber,
        row.customerPoNumber,
        row.grnSummary,
        row.challanNumber,
        documentNumbers(row).challan,
        documentNumbers(row).invoice,
        row.cacheInvoiceNumber,
        row.billInvoiceNumber,
        row.shipmentStatus,
        row.docketNumber,
        row.deliveryBoyName,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query]);

  function onExport() {
    setExportError(null);
    if (rows.length === 0) {
      setExportError("No delivery status rows available to export.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    exportDeliveryStatusXlsx(
      `delivery-status-${stamp}.xlsx`,
      buildDeliveryStatusExportRows(rows),
    );
  }

  async function generateInvoice(challanId: string) {
    const challan = getDeliveryChallan(challanId);
    if (!challan || challan.grnKind === "billing" || invoiceBusyId) return;
    const batchFromKeys = (challan.selectedGrnKeys || []).find((key) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        key.trim(),
      ),
    );
    let batchId = batchFromKeys || "";
    if (!batchId && challan.orderId) {
      try {
        const batches = await listOrderReceiptBatches(challan.orderId);
        const latest = [...batches].reverse().find((batch) => batch.id);
        batchId = latest?.id ? String(latest.id) : "";
      } catch {
        batchId = "";
      }
    }
    if (!challan.orderId || !batchId) {
      setInvoiceNotice(null);
      setExportError(
        "This delivery challan has no GRN receipt, so it cannot be sent for invoice generation.",
      );
      return;
    }
    setInvoiceBusyId(challanId);
    setExportError(null);
    setInvoiceNotice(null);
    try {
      await createInvoiceGenerationTasks({
        order_id: challan.orderId,
        receipt_batch_id: batchId,
        items_summary: challan.lines
          .map((line) => (line.itemName || line.product || "").replace(/^\[quote:[^\]]+\]\s*/i, "").trim())
          .filter(Boolean)
          .join(", "),
        vendor_name: challan.vendorName,
        customer_name: challan.customerName,
        grn_number: challan.selectedGrnNumbers.join(", ") || undefined,
      });
      setInvoiceNotice(
        "Invoice generation was sent to the Invoice generation user. It appears in their My Jobs.",
      );
    } catch (err) {
      const detail =
        err instanceof ApiClientError
          ? [err.message, ...err.errors].filter(Boolean).join(" - ")
          : err instanceof Error && err.message.trim()
            ? err.message
            : "Could not send invoice generation";
      setExportError(detail);
    } finally {
      setInvoiceBusyId(null);
    }
  }

  return (
    <div className={procurementUi.page}>
      <PageHeader
        title="Delivery status"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={onExport}
            >
              <FileSpreadsheet className="mr-1.5 size-3.5 text-[#0369A1]" />
              Export to Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={load}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      <p className="text-sm text-muted-foreground">
        After dispatch is saved, use <span className="font-medium text-foreground">Update status</span>{" "}
        to mark Delivered, Delayed, or Failed.
      </p>

      {flash ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            flash.variant === "success"
              ? "border-sky-200 bg-sky-50 text-sky-900"
              : "border-amber-200 bg-amber-50 text-amber-950",
          )}
        >
          {flash.message}
        </div>
      ) : null}

      {invoiceNotice ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          {invoiceNotice}
        </div>
      ) : null}

      {exportError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {exportError}
        </div>
      ) : null}

      <div className="flex justify-end">
        <ListSearch
          value={query}
          onChange={setQuery}
          placeholder="Search PO, GRN, challan, invoice, or status…"
          aria-label="Search delivery status"
        />
      </div>

      <div className={procurementUi.tableShell}>
        <div className={procurementUi.tableScroll}>
          <table className={cn(procurementUi.table, "min-w-[980px]")}>
            <thead className={procurementUi.thead}>
              <tr>
                <th className={procurementUi.th}>PO number</th>
                <th className={procurementUi.th}>GRN number</th>
                <th className={procurementUi.th}>Challan number</th>
                <th className={procurementUi.th}>Invoice</th>
                <th className={procurementUi.th}>Delivery status</th>
                <th className={procurementUi.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className={procurementUi.empty}>
                    {rows.length === 0
                      ? "No GRNs to track yet."
                      : "No rows match your search."}
                  </td>
                </tr>
              ) : null}
              {filtered.map((row) => {
                const docs = documentNumbers(row);
                return (
                <tr key={row.challanId} className={procurementUi.tr}>
                  <td className={cn(procurementUi.td, "font-medium tabular-nums")}>
                    {formatUniquePoLabels(row.purchaseOrderNumber)}
                  </td>
                  <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                    {row.grnSummary || "-"}
                  </td>
                  <td className={cn(procurementUi.tdNumeric, "tabular-nums")}>
                    {docs.challan || "-"}
                  </td>
                  <td className={cn(procurementUi.tdNumeric, "tabular-nums")}>
                    {docs.invoice || "-"}
                  </td>
                  <td className={procurementUi.td}>
                    <Badge
                      variant={shipmentStatusBadgeVariant(row.shipmentStatus)}
                      className={procurementUi.statusBadge}
                    >
                      {row.shipmentStatus}
                    </Badge>
                  </td>
                  <td className={procurementUi.td}>
                    <div className="flex flex-wrap items-center gap-1">
                      {row.canUpdateOutcome ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={cn(
                              procurementUi.actionBtn,
                              "cursor-pointer text-[#0369A1] hover:text-[#0369A1]",
                            )}
                            onClick={() => {
                              const challan = getDeliveryChallan(row.challanId);
                              if (!challan) return;
                              setOutcomeChallan(challan);
                            }}
                          >
                            <MapPinned className="mr-1 size-3.5" />
                            Update status
                          </Button>
                          {(() => {
                            const source = getDeliveryChallan(row.challanId);
                            if (!source || source.grnKind === "billing") return null;
                            if (invoiceAlreadyCreatedForChallan(source)) return null;
                            return (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={invoiceBusyId === row.challanId}
                                className={cn(
                                  procurementUi.actionBtn,
                                  "cursor-pointer text-[#0369A1] hover:text-[#0369A1]",
                                )}
                                onClick={() => void generateInvoice(row.challanId)}
                              >
                                <Receipt className="mr-1 size-3.5" />
                                {invoiceBusyId === row.challanId
                                  ? "Sending…"
                                  : "Generate invoice"}
                              </Button>
                            );
                          })()}
                        </>
                      ) : row.directBilling ? null : (
                        <Link
                          href={deliveryStatusUpdateHref(row.challanId)}
                          className={cn(
                            buttonVariants({ size: "sm", variant: "ghost" }),
                            procurementUi.actionBtn,
                            "text-[#0369A1] hover:text-[#0369A1]",
                          )}
                        >
                          Set dispatch
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DeliveryStatusOutcomeDialog
        open={Boolean(outcomeChallan)}
        challan={outcomeChallan}
        onClose={() => setOutcomeChallan(null)}
        onSaved={(message) => {
          setDeliveryStatusFlash({ variant: "success", message });
          load();
        }}
      />
    </div>
  );
}
