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
    row.project_name,
    row.site_name,
    row.circle_name,
    row.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function createHref(row: PoQueueRow): string {
  if (row.is_seed || !row.order_id) {
    return `/projects/projects/new?handoff_id=${row.handoff_id}&from_installation=1`;
  }
  return `/projects/projects/new?po_id=${row.order_id}&from_installation=1`;
}

export function ProjectPoQueuePage() {
  const load = useCallback(async (): Promise<PoQueueRow[]> => {
    const apiQueue = await listProjectPoQueue();
    return apiQueue
      .map((row) => ({ ...row, id: row.handoff_id || row.order_id || row.document_number }))
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
        cell: (r) => r.customer_po_number || "-",
      },
      {
        key: "document_date",
        label: "PO Date",
        sort: (r) => r.document_date,
        cell: (r) => formatDate(r.document_date),
      },
      {
        key: "site_name",
        label: "Site",
        sort: (r) => r.site_name || r.project_name || "",
        className: "max-w-[180px] truncate",
        cell: (r) => r.site_name || r.project_name || "-",
      },
      {
        key: "circle_name",
        label: "Circle",
        sort: (r) => r.circle_name || "",
        cell: (r) => r.circle_name || "-",
      },
      {
        key: "customer_name",
        label: "Customer",
        sort: (r) => r.customer_name || "",
        className: "max-w-[160px] truncate",
        cell: (r) => r.customer_name || "-",
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
              href={createHref(r)}
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
      description="Awaiting project creation — shared installation POs, plus Projects test seed rows (H-Cloud). Seed rows never appear in SCM."
      panelTitle="Awaiting project"
      panelSubtitle="Queue entries without a linked project"
      icon={ShoppingCart}
      searchPlaceholder="Search PO, site, circle, customer…"
      emptyMessage="No purchase orders awaiting project creation. Share from Installation when ready."
      loadingMessage="Loading purchase orders…"
      errorMessage="Failed to load purchase orders"
      minWidth={980}
      columns={columns}
      defaultSortKey="shared_at"
      defaultSortDir="desc"
      load={load}
      matches={matchesPo}
    />
  );
}
