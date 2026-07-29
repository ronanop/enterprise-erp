"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Cable,
  ClipboardCheck,
  CloudUpload,
  MapPin,
  Package,
  Server,
  Users,
} from "lucide-react";

import {
  siteDeliveryTypeLabel,
  siteWorkflowStageLabel,
} from "@/components/projects/projects-domain";
import {
  ProjectsErrorBanner,
  ProjectsSection,
} from "@/components/projects/projects-ui";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  getSiteInstallationBlueprint,
  getSiteInstallationByProject,
  listEmployeeOptions,
  type SiteInstallation,
  type SiteInstallationBlueprint,
} from "@/services/projects-portal-service";

type StageKey =
  | "intake"
  | "assignment"
  | "survey"
  | "scm"
  | "installation"
  | "acceptance"
  | "completed";

const STAGE_ICONS: Record<string, typeof MapPin> = {
  intake: ClipboardCheck,
  assignment: Users,
  survey: MapPin,
  scm: Package,
  installation: Server,
  acceptance: CloudUpload,
  completed: Check,
};

const STAGE_FORM_LINKS: Partial<
  Record<StageKey, { href: (projectId: string) => string; label: string }>
> = {
  assignment: {
    href: (id) => `/projects/projects/${id}/assign`,
    label: "Open Assign owners form",
  },
  survey: {
    href: (id) => `/projects/projects/${id}/survey`,
    label: "Open Survey form",
  },
  scm: {
    href: (id) => `/projects/projects/${id}/scm`,
    label: "Open SCM form",
  },
  installation: {
    href: (id) => `/projects/projects/${id}/installation`,
    label: "Open Installation & Configuration form",
  },
  acceptance: {
    href: (id) => `/projects/projects/${id}/acceptance`,
    label: "Open Acceptance form",
  },
};

export function SiteInstallationTrackingSummary({ projectId }: { projectId: string }) {
  const [blueprint, setBlueprint] = useState<SiteInstallationBlueprint | null>(null);
  const [site, setSite] = useState<SiteInstallation | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bp, row, employees] = await Promise.all([
        getSiteInstallationBlueprint(projectId),
        getSiteInstallationByProject(projectId),
        listEmployeeOptions().catch(() => []),
      ]);
      setBlueprint(bp);
      setSite(row);
      setEmployeeOptions(
        Array.isArray(employees) ? (employees as Array<{ id: string; label: string }>) : [],
      );
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load stage owner tracking",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !blueprint) {
    return <div className="h-28 animate-pulse rounded-xl bg-muted/60" />;
  }

  if (!blueprint || !site) {
    return <ProjectsErrorBanner>{error ?? "Tracking unavailable."}</ProjectsErrorBanner>;
  }

  const statusText = (status: string) =>
    status === "done"
      ? "Done"
      : status === "in_progress"
        ? "In progress"
        : status === "skipped"
          ? "Skipped"
          : "Pending";

  const displayDate = (value: string | null | undefined) => {
    if (!value) return "—";
    return String(value).slice(0, 10);
  };

  const employeeName = (employeeId: string | null | undefined) => {
    if (!employeeId) return "Unassigned";
    return employeeOptions.find((e) => e.id === employeeId)?.label ?? employeeId;
  };

  const completedByForStep = (step: string) => {
    if (step === "Survey") return employeeName(site.survey_assignee_employee_id);
    if (step === "SCM / Logistics") return employeeName(site.scm_assignee_employee_id);
    if (step === "Installation & Configuration") {
      return employeeName(site.installation_assignee_employee_id);
    }
    if (step === "Acceptance") return employeeName(site.acceptance_assignee_employee_id);
    return "—";
  };

  const stageDates: Array<{ step: string; item: string; date: string; completedBy: string }> = [
    {
      step: "Survey",
      item: "Power-on Material",
      date: displayDate(site.power_on_material_date),
      completedBy: completedByForStep("Survey"),
    },
    {
      step: "Survey",
      item: "Survey Completed",
      date: displayDate(site.survey_completed_date),
      completedBy: completedByForStep("Survey"),
    },
    {
      step: "Survey",
      item: "Space Available",
      date: displayDate(site.space_available_date),
      completedBy: completedByForStep("Survey"),
    },
    {
      step: "Survey",
      item: "Power Available",
      date: displayDate(site.power_available_date),
      completedBy: completedByForStep("Survey"),
    },
    {
      step: "SCM / Logistics",
      item: "MO Request",
      date: displayDate(site.mo_request_date),
      completedBy: completedByForStep("SCM / Logistics"),
    },
    {
      step: "SCM / Logistics",
      item: "IM Material",
      date: displayDate(site.im_material_date),
      completedBy: completedByForStep("SCM / Logistics"),
    },
    {
      step: "SCM / Logistics",
      item: "Material Handover",
      date: displayDate(site.material_handover_date),
      completedBy: completedByForStep("SCM / Logistics"),
    },
    {
      step: "Installation & Configuration",
      item: "Rack + Stacking",
      date: displayDate(site.rack_server_stacking_date),
      completedBy: completedByForStep("Installation & Configuration"),
    },
    {
      step: "Installation & Configuration",
      item: "Power On",
      date: displayDate(site.rack_server_power_on_date),
      completedBy: completedByForStep("Installation & Configuration"),
    },
    {
      step: "Installation & Configuration",
      item: "DAC / ILO Cabling",
      date: displayDate(site.dac_ilo_cabling_date),
      completedBy: completedByForStep("Installation & Configuration"),
    },
    {
      step: "Installation & Configuration",
      item: "BIOS Configuration",
      date: displayDate(site.bios_configuration_date),
      completedBy: completedByForStep("Installation & Configuration"),
    },
    {
      step: "Installation & Configuration",
      item: "Firmware / N/W",
      date: displayDate(site.firmware_nw_config_date),
      completedBy: completedByForStep("Installation & Configuration"),
    },
    {
      step: "Installation & Configuration",
      item: "LLD",
      date: displayDate(site.lld_date),
      completedBy: completedByForStep("Installation & Configuration"),
    },
    {
      step: "Installation & Configuration",
      item: "OS Installation",
      date: displayDate(site.os_installation_date),
      completedBy: completedByForStep("Installation & Configuration"),
    },
    {
      step: "Installation & Configuration",
      item: "MBSS",
      date: displayDate(site.mbss_date),
      completedBy: completedByForStep("Installation & Configuration"),
    },
    {
      step: "Acceptance",
      item: "Handover to Application Team",
      date: displayDate(site.handover_to_cloud_date),
      completedBy: completedByForStep("Acceptance"),
    },
    {
      step: "Acceptance",
      item: "HWAT Request",
      date: displayDate(site.hwat_request_date),
      completedBy: completedByForStep("Acceptance"),
    },
    {
      step: "Acceptance",
      item: "HWAT Sign-off",
      date: displayDate(site.hwat_signoff_date),
      completedBy: completedByForStep("Acceptance"),
    },
  ].filter((row) => row.date !== "—");

  return (
    <ProjectsSection
      title="Project Tracking"
      subtitle="Assigned person, completion status, and completed dates by delivery step"
      icon={Users}
    >
      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}

      <div className="space-y-4">
        <div className="erp-scroll overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Step</th>
                <th className="px-3 py-2 font-medium">Assigned To</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(blueprint.stage_assignments ?? []).map((sa) => {
                const assigneeLabel =
                  employeeOptions.find((e) => e.id === sa.assignee_employee_id)?.label ??
                  (sa.assignee_employee_id ? sa.assignee_employee_id : "Unassigned");

                return (
                  <tr key={sa.stage} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{sa.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">{assigneeLabel}</td>
                    <td className="px-3 py-2 text-muted-foreground">{statusText(sa.work_status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="erp-scroll overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Step</th>
                <th className="px-3 py-2 font-medium">Checkpoint</th>
                <th className="px-3 py-2 font-medium">Completed By</th>
                <th className="px-3 py-2 font-medium">Date Completed</th>
              </tr>
            </thead>
            <tbody>
              {stageDates.length > 0 ? (
                stageDates.map((row) => (
                  <tr
                    key={`${row.step}-${row.item}`}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-3 py-2 font-medium text-foreground">{row.step}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.item}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.completedBy}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.date}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-xs text-muted-foreground">
                    No step dates filled yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ProjectsSection>
  );
}

/** Overview only — stage details are filled on dedicated form pages. */
export function SiteInstallationWorkflow({ projectId }: { projectId: string }) {
  const [row, setRow] = useState<SiteInstallation | null>(null);
  const [blueprint, setBlueprint] = useState<SiteInstallationBlueprint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [site, bp] = await Promise.all([
        getSiteInstallationByProject(projectId),
        getSiteInstallationBlueprint(projectId),
      ]);
      setRow(site);
      setBlueprint(bp);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load site installation workflow",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const locked = row?.status === "completed" || blueprint?.terminal === true;
  const stage = (blueprint?.state ?? row?.workflow_stage ?? "intake") as StageKey;
  const currentIdx = useMemo(() => {
    const stages = blueprint?.stages ?? [];
    return stages.findIndex((s) => s.key === stage);
  }, [blueprint, stage]);

  if (loading && !row) {
    return <div className="h-36 animate-pulse rounded-xl bg-muted/60" />;
  }

  if (!row || !blueprint) {
    return <ProjectsErrorBanner>{error ?? "Site workflow unavailable."}</ProjectsErrorBanner>;
  }

  const formLink = STAGE_FORM_LINKS[stage];

  return (
    <ProjectsSection
      title="Site Installation Workflow"
      subtitle={`${row.document_number} · ${siteDeliveryTypeLabel(row.delivery_type)} · ${siteWorkflowStageLabel(stage)}`}
      icon={Cable}
      bodyClassName="space-y-4"
    >
      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}

      <div className="flex flex-wrap items-center gap-2">
        {formLink && !locked ? (
          <Link
            href={formLink.href(projectId)}
            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
          >
            {formLink.label}
          </Link>
        ) : null}
        {stage === "intake" && !locked ? (
          <p className="text-xs text-muted-foreground">
            Intake fields are edited from Edit Project. Use Assign owners after intake is complete.
          </p>
        ) : null}
        {locked ? (
          <p className="text-xs text-muted-foreground">Workflow completed — forms are read-only.</p>
        ) : null}
      </div>

      <div className="erp-scroll flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-muted/20 px-2 py-2">
        {blueprint.stages.map((s, idx) => {
          const Icon = STAGE_ICONS[s.key] ?? ClipboardCheck;
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div key={s.key} className="flex items-center">
              <div
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                  isCurrent && "bg-primary/10 text-primary",
                  isDone && "text-emerald-700",
                  !isCurrent && !isDone && "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border",
                    isCurrent && "border-primary bg-primary text-primary-foreground",
                    isDone && "border-emerald-600 bg-emerald-600 text-white",
                    !isCurrent && !isDone && "border-border/80 bg-background",
                  )}
                >
                  {isDone ? <Check className="size-3" /> : <Icon className="size-3" />}
                </span>
                {s.label}
              </div>
              {idx < blueprint.stages.length - 1 ? (
                <span className="mx-0.5 text-muted-foreground/50">›</span>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Open the stage form to enter details and complete the step. Fields are not edited on this
        overview.
      </p>
    </ProjectsSection>
  );
}
