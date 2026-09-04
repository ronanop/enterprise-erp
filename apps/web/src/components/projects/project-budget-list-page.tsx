"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { budgetTypeLabel } from "@/components/projects/projects-domain";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import {
  formatDate,
  formatInr,
  listProjectBudgets,
  type ProjectBudget,
} from "@/services/projects-portal-service";

const LOOKUPS = ["projects"] as const;

export function ProjectBudgetListPage() {
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listProjectBudgets(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<ProjectBudget>[]>(
    () => [
      {
        key: "document_number",
        label: "Budget No.",
        sort: (r) => r.document_number,
        className: "font-mono text-xs font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/project-budgets/${r.id}/edit`}
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
        key: "budget_type",
        label: "Type",
        sort: (r) => r.budget_type,
        cell: (r) => budgetTypeLabel(r.budget_type),
      },
      {
        key: "budget_amount",
        label: "Budget Amount",
        align: "right",
        sort: (r) => Number(r.budget_amount ?? 0),
        className: "text-right tabular-nums text-foreground",
        cell: (r) => formatInr(r.budget_amount),
      },
      {
        key: "currency_code",
        label: "Currency",
        sort: (r) => r.currency_code,
        cell: (r) => r.currency_code,
      },
      {
        key: "cost_center_code",
        label: "Cost Center",
        sort: (r) => r.cost_center_code,
        cell: (r) => r.cost_center_code ?? "—",
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
      title="Budgets"
      description="Spending envelopes per project and budget type. Budgets route through Project Manager → Finance for approval."
      panelTitle="Project budgets"
      panelSubtitle="Spending control"
      icon={Scale}
      newHref="/projects/project-budgets/new"
      newLabel="New Budget"
      searchPlaceholder="Search budgets…"
      loadingMessage="Loading budgets…"
      emptyMessage="No budgets yet. Add a budget line to control project spending."
      errorMessage="Failed to load project budgets"
      minWidth={1150}
      columns={columns}
      defaultSortKey="document_number"
      load={load}
      matches={(r, q) =>
        r.document_number.toLowerCase().includes(q) ||
        r.budget_type.toLowerCase().includes(q) ||
        labels.projectName(r.project_id).toLowerCase().includes(q)
      }
    />
  );
}
