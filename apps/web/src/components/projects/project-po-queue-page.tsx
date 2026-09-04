"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { FolderPlus, ShoppingCart } from "lucide-react";

import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatDate,
  listProjectPoQueue,
  type ProjectPoQueueItem,
} from "@/services/projects-portal-service";

type PoQueueRow = ProjectPoQueueItem & { id: string };

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

export function ProjectPoQueuePage() {
  const load = useCallback(async (): Promise<PoQueueRow[]> => {
    const apiQueue = await listProjectPoQueue();
    return apiQueue
      .map((row) => ({ ...row, id: row.order_id }))
      .sort((a, b) =>
        (b.shared_at || b.created_at || b.document_date || "").localeCompare(
          a.shared_at || a.created_at || a.document_date || "",
        ),
      );
  }, []);

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
        key: "shared_at",
        label: "Date shared",
        sort: (r) => r.shared_at || r.created_at || r.document_date || "",
        cell: (r) => formatDate(r.shared_at || r.created_at || r.document_date),
      },
      {
        key: "actions",
        label: "Action",
        sort: () => "",
        sortable: false,
        align: "center",
        className: "text-foreground",
        cell: (r) => (
          <div className="flex justify-center">
            <Link
              href={`/projects/projects/new?po_id=${r.order_id}&from_installation=1`}
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-8 cursor-pointer")}
            >
              <FolderPlus className="mr-1.5 size-3.5" aria-hidden />
              Create Project
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <ProjectsRecordList
      title="PO Queue"
      description="Customer POs appear here only after Procurement → Installation → Share to PO Queue. Not when a vendor PO is created, and not when delivery is marked Delivered."
      panelTitle="Awaiting project"
      panelSubtitle="Shared installation POs without a linked project"
      icon={ShoppingCart}
      searchPlaceholder="Search customer PO, customer…"
      emptyMessage="No purchase orders awaiting project creation. Share from Installation when ready."
      loadingMessage="Loading purchase orders…"
      errorMessage="Failed to load purchase orders"
      minWidth={880}
      columns={columns}
      defaultSortKey="shared_at"
      defaultSortDir="desc"
      load={load}
      matches={matchesPo}
    />
  );
}
