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
  fromInstallation?: boolean;
};

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
    const [queue, vendorOptions] = await Promise.all([
      listProjectPoQueue(),
      listVendorOptions().catch(() => []),
    ]);
    const vendorMap: Record<string, { label: string; address?: string }> = {};
    for (const vendor of vendorOptions) {
      vendorMap[vendor.id] = { label: vendor.label, address: vendor.address };
    }
    setVendors(vendorMap);

    const manualRows: PoQueueRow[] = queue
      .filter((row) => !row.ovf_id)
      .map((row) => ({ ...row, id: row.order_id, fromInstallation: false }));

    const linkedIds = new Set(manualRows.map((row) => row.order_id));
    const handoffs = listProjectPoQueueHandoffs();
    const installationRows: PoQueueRow[] = [];

    for (const handoff of handoffs) {
      if (linkedIds.has(handoff.orderId)) {
        removeProjectPoQueueHandoff(handoff.orderId);
        continue;
      }
      try {
        // Drop handoffs that already have a project (create would fail).
        const order = await getPurchaseOrder(handoff.orderId).catch(() => null);
        if (!order) {
          installationRows.push(handoffToQueueRow(handoff));
          continue;
        }
        installationRows.push(
          handoffToQueueRow({
            ...handoff,
            companyPoNumber: order.company_po_number || handoff.companyPoNumber,
            documentNumber: order.document_number || handoff.documentNumber,
            documentDate: order.document_date || handoff.documentDate,
            customerName: order.customer_name || handoff.customerName,
            customerPoNumber: order.customer_po_number || handoff.customerPoNumber,
            vendorId: order.vendor_id || handoff.vendorId,
            totalAmount: Number(order.total_amount || handoff.totalAmount),
            customerTotal: Number(order.customer_total || handoff.customerTotal),
            status: order.status || handoff.status,
            ovfId: order.source_document_id || handoff.ovfId,
            branchId: order.branch_id || handoff.branchId,
            companyId: order.company_id || handoff.companyId,
          }),
        );
        linkedIds.add(handoff.orderId);
      } catch {
        installationRows.push(handoffToQueueRow(handoff));
        linkedIds.add(handoff.orderId);
      }
    }

    return [...installationRows, ...manualRows];
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
        key: "created_at",
        label: "Date Created",
        sort: (r) => r.document_date,
        cell: (r) => formatDate(r.document_date),
      },
      {
        key: "actions",
        label: "Action",
        sort: () => "",
        align: "right",
        cell: (r) => (
          <Link
            href={
              r.fromInstallation
                ? `/projects/projects/new?po_id=${r.order_id}&from_installation=1`
                : `/projects/projects/new?po_id=${r.order_id}`
            }
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
        description="Create projects from purchase orders. SCM / OVF POs appear here only after Procurement → Installation → Share to Project."
        panelTitle="Awaiting project"
        panelSubtitle="Shared installation POs and manual POs without a linked project"
        icon={ShoppingCart}
        searchPlaceholder="Search PO, customer, status…"
        emptyMessage="No purchase orders awaiting project creation. Share from Installation when ready."
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
