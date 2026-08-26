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
  assignment: {
    title: "Assign Survey owner",
    description:
      "Assign the Survey owner after project create. Later stage owners are set from Project Tracking after each step completes.",
    empty: "No sites waiting for Survey assignment.",
  },
  survey: {
    title: "Survey",
    description: "Sites in survey — space, power, tile details, and survey completion.",
    empty: "No sites in Survey.",
  },
  scm: {
    title: "SCM / Logistics",
    description: "Material movement — quantities and warehouse delivery dates.",
    empty: "No sites in SCM / Logistics.",
  },
  onsite_delivery: {
    title: "Onsite Delivery",
    description: "MO request and server / rack / PDU on-site delivery.",
    empty: "No sites in Onsite Delivery.",
  },
  material_handover: {
    title: "Material Handover",
    description: "IM material, power-on material, and WH → site handover.",
    empty: "No sites in Material Handover.",
  },
  installation: {
    title: "Installation & Configuration",
    description:
      "In-scope install work — rack-only sites skip server / OS / configuration; other scopes include stacking, power, cabling, and config as applicable.",
    empty: "No sites in Installation & Configuration.",
  },
  acceptance: {
    title: "Acceptance",
    description: "Handover to Application Team and HW AT / circle sign-off.",
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
        "Site installation register across Intake → Survey → SCM → Onsite Delivery → Material Handover → Installation → Acceptance.",
      empty: "No site installations yet. Create a project to seed the workflow.",
    };

  const load = useCallback(async () => {
    const rows = await listSiteInstallations();
    if (!stage) return rows;
    if (stage === "onsite_delivery") {
      return rows.filter(
        (r) => r.workflow_stage === "onsite_delivery" || r.workflow_stage === "onsite",
      );
    }
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
