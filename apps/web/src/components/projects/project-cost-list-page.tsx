"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { costSourceLabel } from "@/components/projects/projects-domain";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import {
  formatDate,
  formatInr,
  listProjectCosts,
  type ProjectCost,
} from "@/services/projects-portal-service";

const LOOKUPS = ["projects", "employees"] as const;

export function ProjectCostListPage() {
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listProjectCosts(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<ProjectCost>[]>(
    () => [
      {
        key: "document_number",
        label: "Cost No.",
        sort: (r) => r.document_number,
        className: "font-mono text-xs font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/project-costs/${r.id}/edit`}
            className="cursor-pointer hover:underline"
          >
            {r.document_number}
          </Link>
        ),
      },
      {
        key: "project_id",
        label: "Project",
        sort: (r) => labels.projectName(r.project_id),
        className: "font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/projects/${r.project_id}`}
            className="cursor-pointer hover:underline"
          >
            {labels.projectName(r.project_id)}
          </Link>
        ),
      },
      {
        key: "cost_source",
        label: "Source",
        sort: (r) => r.cost_source,
        cell: (r) => costSourceLabel(r.cost_source),
      },
      {
        key: "cost_amount",
        label: "Amount",
        align: "right",
        sort: (r) => Number(r.cost_amount ?? 0),
        className: "text-right tabular-nums text-foreground",
        cell: (r) => formatInr(r.cost_amount),
      },
      {
        key: "cost_date",
        label: "Cost Date",
        sort: (r) => r.cost_date,
        cell: (r) => formatDate(r.cost_date),
      },
      {
        key: "employee_id",
        label: "Employee",
        sort: (r) => labels.employeeName(r.employee_id),
        cell: (r) => labels.employeeName(r.employee_id),
      },
      {
        key: "finance_journal_id",
        label: "Journal",
        sort: (r) => r.finance_journal_id,
        className: "font-mono text-xs text-muted-foreground",
        cell: (r) => (r.finance_journal_id ? r.finance_journal_id.slice(0, 8) : "—"),
      },
      {
        key: "created_at",
        label: "Date Created",
        sort: (r) => r.created_at,
        cell: (r) => formatDate(r.created_at),
      },
      {
        key: "status",
        label: "Status",
        sort: (r) => r.status,
        className: "",
        cell: (r) => <FinanceStatusBadge status={r.status} />,
      },
    ],
    [labels],
  );

  return (
    <ProjectsRecordList
      title="Costs"
      description="Actual project spend from payroll, procurement, expenses, assets, and vendor bills. Posting a cost writes a Finance journal."
      panelTitle="Project costs"
      panelSubtitle="Actual spend"
      icon={Receipt}
      newHref="/projects/project-costs/new"
      newLabel="New Cost"
      searchPlaceholder="Search costs…"
      loadingMessage="Loading costs…"
      emptyMessage="No costs captured yet. Record actual spend to track project profitability."
      errorMessage="Failed to load project costs"
      minWidth={1250}
      columns={columns}
      defaultSortKey="cost_date"
      defaultSortDir="desc"
      load={load}
      matches={(r, q) =>
        r.document_number.toLowerCase().includes(q) ||
        r.cost_source.toLowerCase().includes(q) ||
        labels.projectName(r.project_id).toLowerCase().includes(q)
      }
    />
  );
}
