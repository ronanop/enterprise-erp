"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { FileDown, FolderPlus, ShoppingCart } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
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
  formatInr,
  listProjectPoQueue,
  type ProjectPoQueueItem,
} from "@/services/projects-portal-service";
import {
  getPurchaseOrder,
  listVendorOptions,
} from "@/services/procurement-service";
import { downloadOrderPdf } from "@/utils/purchase-order-pdf";

type PoQueueRow = ProjectPoQueueItem & { id: string };

function matchesPo(row: PoQueueRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.company_po_number,
    row.document_number,
    row.customer_name,
    row.customer_po_number,
    row.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function ProjectPoQueuePage() {
  const [error, setError] = useState<string | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Record<string, { label: string; address?: string }>>(
    {},
  );

  const load = useCallback(async (): Promise<PoQueueRow[]> => {
    const [queue, vendorOptions] = await Promise.all([
      listProjectPoQueue(),
      listVendorOptions().catch(() => []),
    ]);
    const vendorMap: Record<string, { label: string; address?: string }> = {};
    for (const vendor of vendorOptions) {
      vendorMap[vendor.id] = { label: vendor.label, address: vendor.address };
    }
    setVendors(vendorMap);
    return queue.map((row) => ({ ...row, id: row.order_id }));
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
            title="Download PO PDF"
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
        key: "customer_po_number",
        label: "Customer PO",
        sort: (r) => r.customer_po_number || "",
        className: "font-mono text-xs text-muted-foreground",
        cell: (r) => r.customer_po_number || "—",
      },
      {
        key: "customer_total",
        label: "Sell Value",
        sort: (r) => r.customer_total,
        align: "right",
        cell: (r) => formatInr(r.customer_total || r.total_amount),
      },
      {
        key: "status",
        label: "Status",
        sort: (r) => r.status,
        cell: (r) => <FinanceStatusBadge status={r.status} />,
      },
      {
        key: "actions",
        label: "",
        sort: () => "",
        align: "right",
        cell: (r) => (
          <Link
            href={`/projects/projects/new?po_id=${r.order_id}`}
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
        description="Finalized SCM purchase orders ready for site installation project creation. Click a PO number to download the PDF, then create a project to start the delivery pipeline."
        panelTitle="Awaiting project"
        panelSubtitle="Purchase orders from SCM without a linked project"
        icon={ShoppingCart}
        searchPlaceholder="Search PO, customer, status…"
        emptyMessage="No finalized purchase orders awaiting project creation."
        loadingMessage="Loading purchase orders…"
        errorMessage="Failed to load purchase orders"
        minWidth={960}
        columns={columns}
        defaultSortKey="document_date"
        defaultSortDir="desc"
        load={load}
        matches={matchesPo}
      />
    </>
  );
}
