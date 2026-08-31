"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { FileDown, FolderPlus, ShoppingCart } from "lucide-react";

import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { ProjectsErrorBanner } from "@/components/projects/projects-ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  formatDate,
  getProjectPoPrefill,
  listProjectPoQueue,
  type ProjectPoQueueItem,
} from "@/services/projects-portal-service";
import {
  getPurchaseOrder,
  listVendorOptions,
} from "@/services/procurement-service";
import { downloadOrderPdf } from "@/utils/purchase-order-pdf";
import {
  listProjectPoQueueHandoffs,
  removeProjectPoQueueHandoff,
} from "@/utils/project-po-queue-handoff";

type PoQueueRow = ProjectPoQueueItem & {
  id: string;
  fromInstallation: true;
  shared_at?: string | null;
};

function matchesPo(row: PoQueueRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.customer_po_number,
    row.company_po_number,
    row.document_number,
    row.customer_name,
    row.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function handoffToQueueRow(
  handoff: ReturnType<typeof listProjectPoQueueHandoffs>[number],
): PoQueueRow {
  return {
    id: handoff.orderId,
    order_id: handoff.orderId,
    company_po_number: handoff.companyPoNumber,
    document_number: handoff.documentNumber,
    document_date: handoff.documentDate,
    customer_name: handoff.customerName,
    customer_po_number: handoff.customerPoNumber,
    vendor_id: handoff.vendorId,
    total_amount: handoff.totalAmount,
    customer_total: handoff.customerTotal,
    status: handoff.status,
    ovf_id: handoff.ovfId,
    branch_id: handoff.branchId,
    company_id: handoff.companyId,
    created_at: handoff.sharedAt,
    shared_at: handoff.sharedAt,
    fromInstallation: true,
  };
}

export function ProjectPoQueuePage() {
  const [error, setError] = useState<string | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Record<string, { label: string; address?: string }>>(
    {},
  );

  const load = useCallback(async (): Promise<PoQueueRow[]> => {
    const [apiQueue, vendorOptions] = await Promise.all([
      listProjectPoQueue(),
      listVendorOptions().catch(() => []),
    ]);
    const vendorMap: Record<string, { label: string; address?: string }> = {};
    for (const vendor of vendorOptions) {
      vendorMap[vendor.id] = { label: vendor.label, address: vendor.address };
    }
    setVendors(vendorMap);

    /** Unlinked finalized POs — used only to drop handoffs already linked to a project. */
    const unlinkedOrderIds = new Set(apiQueue.map((row) => row.order_id));
    const apiByOrderId = new Map(apiQueue.map((row) => [row.order_id, row]));

    /**
     * Only POs shared via Installation → Share to PO Queue appear here.
     * Not on vendor PO create, and not when Delivery Status is marked Delivered.
     */
    const rows: PoQueueRow[] = [];
    for (const handoff of listProjectPoQueueHandoffs()) {
      if (!unlinkedOrderIds.has(handoff.orderId)) {
        removeProjectPoQueueHandoff(handoff.orderId);
        continue;
      }

      const apiRow = apiByOrderId.get(handoff.orderId);
      let customerPo =
        (handoff.customerPoNumber || "").trim() ||
        (apiRow?.customer_po_number || "").trim() ||
        "";
      let customerName =
        (handoff.customerName || "").trim() ||
        (apiRow?.customer_name || "").trim() ||
        "";

      try {
        const [order, prefill] = await Promise.all([
          getPurchaseOrder(handoff.orderId).catch(() => null),
          (!customerPo || !customerName
            ? getProjectPoPrefill(handoff.orderId, { installationHandoff: true })
            : Promise.resolve(null)
          ).catch(() => null),
        ]);
        customerPo =
          customerPo ||
          (order?.customer_po_number || "").trim() ||
          (prefill?.customer_po_number || "").trim() ||
          "";
        customerName =
          customerName ||
          (order?.customer_name || "").trim() ||
          (prefill?.customer_name || "").trim() ||
          "";

        rows.push(
          handoffToQueueRow({
            ...handoff,
            companyPoNumber:
              order?.company_po_number ||
              apiRow?.company_po_number ||
              handoff.companyPoNumber,
            documentNumber:
              order?.document_number || apiRow?.document_number || handoff.documentNumber,
            documentDate:
              order?.document_date || apiRow?.document_date || handoff.documentDate,
            customerName: customerName || null,
            customerPoNumber: customerPo || null,
            vendorId: order?.vendor_id || apiRow?.vendor_id || handoff.vendorId,
            totalAmount: Number(
              order?.total_amount ?? apiRow?.total_amount ?? handoff.totalAmount,
            ),
            customerTotal: Number(
              order?.customer_total ?? apiRow?.customer_total ?? handoff.customerTotal,
            ),
            status: order?.status || apiRow?.status || handoff.status,
            ovfId:
              (order?.source_module === "crm" ? order.source_document_id : null) ||
              apiRow?.ovf_id ||
              handoff.ovfId,
            branchId: order?.branch_id || apiRow?.branch_id || handoff.branchId,
            companyId: order?.company_id || apiRow?.company_id || handoff.companyId,
          }),
        );
      } catch {
        rows.push(
          handoffToQueueRow({
            ...handoff,
            customerName: customerName || handoff.customerName,
            customerPoNumber: customerPo || handoff.customerPoNumber,
          }),
        );
      }
    }

    return rows.sort((a, b) =>
      (b.shared_at || b.created_at || "").localeCompare(a.shared_at || a.created_at || ""),
    );
  }, []);

  const onDownloadPdf = useCallback(
    async (orderId: string) => {
      setPdfBusyId(orderId);
      setError(null);
      try {
        const order = await getPurchaseOrder(orderId);
        const vendor = vendors[order.vendor_id];
        await downloadOrderPdf(order, {
          name: vendor?.label || order.vendor_id,
          address: vendor?.address || "",
        });
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to download PO PDF");
      } finally {
        setPdfBusyId(null);
      }
    },
    [vendors],
  );

  const columns = useMemo<RecordColumn<PoQueueRow>[]>(
    () => [
      {
        key: "customer_po_number",
        label: "Customer PO",
        sort: (r) => r.customer_po_number || "",
        className: "font-mono text-xs font-medium tabular-nums text-foreground",
        cell: (r) => r.customer_po_number || "—",
      },
      {
        key: "company_po_number",
        label: "Company PO",
        sort: (r) => r.company_po_number || r.document_number,
        className: "font-mono text-xs font-medium text-foreground",
        cell: (r) => (
          <button
            type="button"
            onClick={() => onDownloadPdf(r.order_id)}
            disabled={pdfBusyId === r.order_id}
            className="inline-flex cursor-pointer items-center gap-1.5 text-left font-mono text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            title="Download company PO PDF"
          >
            <FileDown className="size-3.5 shrink-0" aria-hidden />
            {r.company_po_number || r.document_number}
          </button>
        ),
      },
      {
        key: "document_date",
        label: "PO Date",
        sort: (r) => r.document_date,
        cell: (r) => formatDate(r.document_date),
      },
      {
        key: "customer_name",
        label: "Customer",
        sort: (r) => r.customer_name || "",
        className: "max-w-[220px] truncate",
        cell: (r) => r.customer_name || "—",
      },
      {
        key: "created_at",
        label: "Date shared",
        sort: (r) => r.shared_at || r.created_at || r.document_date || "",
        cell: (r) => formatDate(r.shared_at || r.created_at || r.document_date),
      },
      {
        key: "actions",
        label: "Action",
        sort: () => "",
        align: "right",
        cell: (r) => (
          <Link
            href={`/projects/projects/new?po_id=${r.order_id}&from_installation=1`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-8 cursor-pointer")}
          >
            <FolderPlus className="mr-1.5 size-3.5" aria-hidden />
            Create Project
          </Link>
        ),
      },
    ],
    [onDownloadPdf, pdfBusyId],
  );

  return (
    <>
      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}
      <ProjectsRecordList
        title="PO Queue"
        description="Customer POs appear here only after Procurement → Installation → Share to PO Queue. Not when a vendor PO is created, and not when delivery is marked Delivered."
        panelTitle="Awaiting project"
        panelSubtitle="Shared installation POs without a linked project"
        icon={ShoppingCart}
        searchPlaceholder="Search customer PO, company PO, customer…"
        emptyMessage="No purchase orders awaiting project creation. Share from Installation when ready."
        loadingMessage="Loading purchase orders…"
        errorMessage="Failed to load purchase orders"
        minWidth={1040}
        columns={columns}
        defaultSortKey="created_at"
        defaultSortDir="desc"
        load={load}
        matches={matchesPo}
      />
    </>
  );
}
