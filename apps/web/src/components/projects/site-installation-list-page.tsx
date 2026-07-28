"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { Cable } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import {
  siteDeliveryTypeLabel,
  siteWorkflowStageLabel,
} from "@/components/projects/projects-domain";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import {
  listSiteInstallations,
  type SiteInstallation,
} from "@/services/projects-portal-service";

const STAGE_META: Record<
  string,
  { title: string; description: string; empty: string }
> = {
  intake: {
    title: "Intake & RFAI",
    description: "Site requests awaiting RFAI capture — requestor, circle, cloud, and site.",
    empty: "No sites in Intake. Create a project to start the delivery workflow.",
  },
  survey: {
    title: "Survey",
    description: "Sites in survey — space, power, tile details, and survey completion.",
    empty: "No sites in Survey.",
  },
  scm: {
    title: "SCM / Logistics",
    description: "Material movement — MO request, IM material, and WH / on-site delivery dates.",
    empty: "No sites in SCM / Logistics.",
  },
  installation: {
    title: "Installation",
    description: "Rack stacking, power-on, and DAC/ILO cabling at site.",
    empty: "No sites in Installation.",
  },
  configuration: {
    title: "Configuration",
    description: "BIOS / firmware and LLD configuration before acceptance.",
    empty: "No sites in Configuration.",
  },
  acceptance: {
    title: "Acceptance",
    description: "Handover to Cloud and HW AT / circle sign-off.",
    empty: "No sites in Acceptance.",
  },
  completed: {
    title: "Completed",
    description: "Site installations that have completed handover.",
    empty: "No completed site installations yet.",
  },
};

export function SiteInstallationListPage({ stage }: { stage?: string }) {
  const meta = stage
    ? STAGE_META[stage] ?? {
      title: siteWorkflowStageLabel(stage),
      description: "Site installations in this delivery stage.",
      empty: "No site installations in this stage.",
    }
    : {
      title: "All Sites",
      description:
        "Site installation register across Intake → Survey → SCM → Installation → Configuration → Acceptance.",
      empty: "No site installations yet. Create a project to seed the workflow.",
    };

  const load = useCallback(async () => {
    const rows = await listSiteInstallations();
    if (!stage) return rows;
    return rows.filter((r) => r.workflow_stage === stage);
  }, [stage]);

  const columns = useMemo<RecordColumn<SiteInstallation>[]>(
    () => [
      {
        key: "document_number",
        label: "Site ID",
        sort: (r) => r.document_number,
        className: "font-mono text-xs text-muted-foreground",
        cell: (r) => (
          <Link
            href={`/projects/projects/${r.project_id}`}
            className="cursor-pointer font-medium text-foreground hover:underline"
          >
            {r.document_number}
          </Link>
        ),
      },
      {
        key: "site_name",
        label: "Site Name",
        sort: (r) => r.site_name,
        className: "font-medium text-foreground",
        cell: (r) => r.site_name || "—",
      },
      {
        key: "rfai_number",
        label: "RFAI",
        sort: (r) => r.rfai_number,
        cell: (r) => r.rfai_number || "—",
      },
      {
        key: "circle",
        label: "Circle",
        sort: (r) => r.circle,
        cell: (r) => r.circle || "—",
      },
      {
        key: "cloud_name",
        label: "Cloud",
        sort: (r) => r.cloud_name,
        cell: (r) => r.cloud_name || "—",
      },
      {
        key: "requestor_name",
        label: "Requestor",
        sort: (r) => r.requestor_name,
        cell: (r) => r.requestor_name || "—",
      },
      {
        key: "delivery_type",
        label: "Type",
        sort: (r) => r.delivery_type,
        cell: (r) => siteDeliveryTypeLabel(r.delivery_type),
      },
      {
        key: "workflow_stage",
        label: "Stage",
        sort: (r) => r.workflow_stage,
        cell: (r) => siteWorkflowStageLabel(r.workflow_stage),
      },
      {
        key: "status",
        label: "Status",
        sort: (r) => r.status,
        cell: (r) => <FinanceStatusBadge status={r.status} />,
      },
    ],
    [],
  );

  return (
    <ProjectsRecordList
      title={meta.title}
      description={meta.description}
      panelTitle="Site installations"
      panelSubtitle={stage ? siteWorkflowStageLabel(stage) : "All stages"}
      icon={Cable}
      newHref="/projects/projects/new"
      newLabel="New Project"
      searchPlaceholder="Search sites, RFAI, circle…"
      loadingMessage="Loading site installations…"
      emptyMessage={meta.empty}
      errorMessage="Failed to load site installations"
      minWidth={1100}
      columns={columns}
      defaultSortKey="document_number"
      load={load}
      matches={(r, q) =>
        (r.document_number ?? "").toLowerCase().includes(q) ||
        (r.site_name ?? "").toLowerCase().includes(q) ||
        (r.rfai_number ?? "").toLowerCase().includes(q) ||
        (r.circle ?? "").toLowerCase().includes(q) ||
        (r.cloud_name ?? "").toLowerCase().includes(q) ||
        (r.requestor_name ?? "").toLowerCase().includes(q) ||
        (r.fabric_partner ?? "").toLowerCase().includes(q)
      }
    />
  );
}
