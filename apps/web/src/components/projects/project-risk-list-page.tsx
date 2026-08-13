"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { RiskLevelBadge, SeverityBadge } from "@/components/projects/projects-badges";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import {
  formatDate,
  listProjectRisks,
  type ProjectRisk,
} from "@/services/projects-portal-service";

const LOOKUPS = ["projects", "employees"] as const;

export function ProjectRiskListPage() {
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listProjectRisks(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<ProjectRisk>[]>(
    () => [
      {
        key: "risk_name",
        label: "Risk",
        sort: (r) => r.risk_name,
        className: "font-medium text-foreground",
        cell: (r) => (
          <Link
            href={`/projects/project-risks/${r.id}/edit`}
            className="cursor-pointer hover:underline"
          >
            {r.risk_name}
          </Link>
        ),
      },
      {
        key: "document_number",
        label: "Risk No.",
        sort: (r) => r.document_number,
        className: "font-mono text-xs text-muted-foreground",
        cell: (r) => r.document_number,
      },
      {
        key: "project_id",
        label: "Project",
        sort: (r) => labels.projectName(r.project_id),
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
        key: "impact",
        label: "Impact",
        sort: (r) => r.impact,
        className: "",
        cell: (r) => <SeverityBadge value={r.impact} />,
      },
      {
        key: "probability",
        label: "Probability",
        sort: (r) => r.probability,
        className: "",
        cell: (r) => <SeverityBadge value={r.probability} />,
      },
      {
        key: "risk_level",
        label: "Level",
        sort: (r) => r.risk_level,
        className: "",
        cell: (r) => <RiskLevelBadge value={r.risk_level} />,
      },
      {
        key: "owner_employee_id",
        label: "Owner",
        sort: (r) => labels.employeeName(r.owner_employee_id),
        cell: (r) => labels.employeeName(r.owner_employee_id),
      },
      {
        key: "review_date",
        label: "Review Date",
        sort: (r) => r.review_date,
        cell: (r) => formatDate(r.review_date),
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
      title="Risk Register"
      description="Identified project risks with impact, probability, owner, and mitigation plan — reviewed on a schedule until closed."
      panelTitle="Risk register"
      panelSubtitle="Impact × probability"
      icon={AlertTriangle}
      newHref="/projects/project-risks/new"
      newLabel="New Risk"
      searchPlaceholder="Search risks…"
      loadingMessage="Loading risks…"
      emptyMessage="No risks registered. Log risks early so mitigation can be planned."
      errorMessage="Failed to load project risks"
      minWidth={1250}
      columns={columns}
      defaultSortKey="risk_level"
      defaultSortDir="desc"
      load={load}
      matches={(r, q) =>
        r.risk_name.toLowerCase().includes(q) ||
        r.document_number.toLowerCase().includes(q) ||
        labels.projectName(r.project_id).toLowerCase().includes(q)
      }
    />
  );
}
