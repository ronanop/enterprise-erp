"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
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
  deliveryIncludesBios,
  deliveryIncludesOs,
  deliveryIncludesRack,
  deliveryIncludesServer,
  deliveryIsRackOnly,
  siteDeliveryTypeLabel,
  siteWorkflowStageLabel,
} from "@/components/projects/projects-domain";
import {
  ProjectsErrorBanner,
  ProjectsSection,
} from "@/components/projects/projects-ui";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import { loadIntakeSummaryLookups } from "@/components/projects/site-intake-summary";
import {
  getSiteInstallationBlueprint,
  getSiteInstallationByProject,
  followUpSiteStage,
  getProject,
  listEmployeeOptions,
  listSiteStageFollowUps,
  type SiteInstallation,
  type SiteInstallationBlueprint,
  type SiteStageFollowUp,
} from "@/services/projects-portal-service";
import { parseAuthMe } from "@/lib/auth-user";
import { resolveSessionEmployeeId } from "@/lib/crm/session-employee";
import { canOpenCurrentStageForm } from "@/lib/projects/site-stage-form-access";
import { authService } from "@/services/api-client";

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
  const { projectModuleAdmin } = useAuthUser();
  const [blueprint, setBlueprint] = useState<SiteInstallationBlueprint | null>(null);
  const [site, setSite] = useState<SiteInstallation | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followUpTarget, setFollowUpTarget] = useState<{
    stage: string;
    label: string;
    assigneeName: string;
  } | null>(null);
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [followUpFeedback, setFollowUpFeedback] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<SiteStageFollowUp[]>([]);

  const refreshFollowUpsOnly = useCallback(async () => {
    const rows = await listSiteStageFollowUps(projectId).catch(() => []);
    setFollowUps(Array.isArray(rows) ? rows : []);
  }, [projectId]);

  const latestFollowUpByStage = useMemo(() => {
    const map = new Map<string, SiteStageFollowUp>();
    for (const fu of followUps) {
      if (fu.stage && !map.has(fu.stage)) {
        map.set(fu.stage, fu);
      }
    }
    return map;
  }, [followUps]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bp, row, employees, followUpRows] = await Promise.all([
        getSiteInstallationBlueprint(projectId),
        getSiteInstallationByProject(projectId),
        listEmployeeOptions().catch(() => []),
        listSiteStageFollowUps(projectId).catch(() => []),
      ]);
      setBlueprint(bp);
      setSite(row);
      setEmployeeOptions(
        Array.isArray(employees) ? (employees as Array<{ id: string; label: string }>) : [],
      );
      setFollowUps(Array.isArray(followUpRows) ? followUpRows : []);
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

  useEffect(() => {
    if (!projectModuleAdmin) return;
    const id = window.setInterval(() => void refreshFollowUpsOnly(), 20_000);
    return () => window.clearInterval(id);
  }, [projectModuleAdmin, refreshFollowUpsOnly]);

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

  const displayDateTime = (value: string | null | undefined) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 16).replace("T", " ");
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const employeeName = (employeeId: string | null | undefined) => {
    if (!employeeId) return "Unassigned";
    return employeeOptions.find((e) => e.id === employeeId)?.label ?? "Assigned";
  };

  const rackOnly = deliveryIsRackOnly(site.delivery_type);
  const hasRack = deliveryIncludesRack(site.delivery_type);
  const hasServer = deliveryIncludesServer(site.delivery_type);
  const hasBios = deliveryIncludesBios(site.delivery_type);
  const hasOs = deliveryIncludesOs(site.delivery_type);
  const installStep = rackOnly ? "Installation" : "Installation & Configuration";

  const completedByForStep = (step: string) => {
    if (step === "Survey") return employeeName(site.survey_assignee_employee_id);
    if (step === "SCM / Logistics") return employeeName(site.scm_assignee_employee_id);
    if (step === "Installation" || step === "Installation & Configuration") {
      return employeeName(site.installation_assignee_employee_id);
    }
    if (step === "Acceptance") return employeeName(site.acceptance_assignee_employee_id);
    return "—";
  };

  const stageDates: Array<{ step: string; item: string; date: string; completedBy: string }> = [
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
      step: "Survey",
      item: "Survey Completed",
      date: displayDate(site.survey_completed_date),
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
    ...(rackOnly
      ? []
      : [
        {
          step: "SCM / Logistics",
          item: "Power-on Material",
          date: displayDate(site.power_on_material_date),
          completedBy: completedByForStep("SCM / Logistics"),
        },
      ]),
    {
      step: "SCM / Logistics",
      item: "Material Handover",
      date: displayDate(site.material_handover_date),
      completedBy: completedByForStep("SCM / Logistics"),
    },
    {
      step: installStep,
      item: rackOnly
        ? "Rack Installation"
        : hasRack
          ? "Rack + Stacking"
          : "Server Stacking",
      date: displayDate(site.rack_server_stacking_date),
      completedBy: completedByForStep(installStep),
    },
    ...(rackOnly || !hasServer
      ? []
      : [
        {
          step: installStep,
          item: hasRack ? "Rack + Server Power On" : "Server Power On",
          date: displayDate(site.rack_server_power_on_date),
          completedBy: completedByForStep(installStep),
        },
        {
          step: installStep,
          item: "DAC / ILO Cabling",
          date: displayDate(site.dac_ilo_cabling_date),
          completedBy: completedByForStep(installStep),
        },
      ]),
    ...(hasBios
      ? [
        {
          step: installStep,
          item: "BIOS Configuration",
          date: displayDate(site.bios_configuration_date),
          completedBy: completedByForStep(installStep),
        },
        {
          step: installStep,
          item: "Firmware / N/W",
          date: displayDate(site.firmware_nw_config_date),
          completedBy: completedByForStep(installStep),
        },
        {
          step: installStep,
          item: "LLD",
          date: displayDate(site.lld_date),
          completedBy: completedByForStep(installStep),
        },
      ]
      : []),
    ...(hasOs
      ? [
        {
          step: installStep,
          item: "OS Installation",
          date: displayDate(site.os_installation_date),
          completedBy: completedByForStep(installStep),
        },
        {
          step: installStep,
          item: "MBSS",
          date: displayDate(site.mbss_date),
          completedBy: completedByForStep(installStep),
        },
        {
          step: installStep,
          item: "VASCAN",
          date: displayDate(site.vascan_date),
          completedBy: completedByForStep(installStep),
        },
      ]
      : []),
    {
      step: "Acceptance",
      item: "Handover to Application Team",
      date: displayDate(site.handover_to_cloud_date),
      completedBy: completedByForStep("Acceptance"),
    },
    ...(rackOnly
      ? []
      : [
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
      ]),
  ].filter((row) => row.date !== "—");

  return (
    <ProjectsSection
      title="Project Tracking"
      subtitle="Stage owners with step-wise assigned and completed dates"
      icon={Users}
    >
      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}
      {followUpFeedback ? (
        <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-foreground">
          {followUpFeedback}
        </p>
      ) : null}

      <div className="space-y-4">
        <div className="erp-scroll overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Step</th>
                <th className="px-3 py-2 font-medium">Assigned To</th>
                <th className="px-3 py-2 font-medium">Date Assigned</th>
                <th className="px-3 py-2 font-medium">Date Completed</th>
                <th className="px-3 py-2 font-medium">Status</th>
                {projectModuleAdmin ? (
                  <>
                    <th className="px-3 py-2 font-medium">Follow-up</th>
                    <th className="px-3 py-2 font-medium">Assignee reply</th>
                    <th className="px-3 py-2 font-medium">Follow up</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {(blueprint.stage_assignments ?? []).map((sa) => {
                const assigneeLabel = sa.assignee_employee_id
                  ? employeeName(sa.assignee_employee_id)
                  : "Unassigned";
                const canFollowUp =
                  Boolean(sa.assignee_employee_id) && sa.work_status !== "done";
                const stageFollowUp = latestFollowUpByStage.get(sa.stage);
                const stageViewHref =
                  projectModuleAdmin &&
                    sa.work_status === "done" &&
                    STAGE_FORM_LINKS[sa.stage as StageKey]
                    ? STAGE_FORM_LINKS[sa.stage as StageKey]!.href(projectId)
                    : null;

                return (
                  <tr key={sa.stage} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {stageViewHref ? (
                          <Link
                            href={stageViewHref}
                            title={`View ${sa.label} progress`}
                            className="cursor-pointer text-foreground transition-colors duration-200 hover:text-primary hover:underline"
                          >
                            {sa.label}
                          </Link>
                        ) : (
                          sa.label
                        )}
                        {stageViewHref ? (
                          <Link
                            href={stageViewHref}
                            title={`View ${sa.label} progress`}
                            aria-label={`View ${sa.label} progress`}
                            className="inline-flex cursor-pointer text-primary transition-colors duration-200 hover:text-primary/80"
                          >
                            <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
                          </Link>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{assigneeLabel}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {displayDate(sa.assigned_date)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {displayDate(sa.completed_date)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{statusText(sa.work_status)}</td>
                    {projectModuleAdmin ? (
                      <>
                        <td className="px-3 py-2 text-muted-foreground">
                          {stageFollowUp ? (
                            stageFollowUp.has_reply ? (
                              <span className="font-medium text-foreground">Replied</span>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-500">Awaiting reply</span>
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="max-w-52 px-3 py-2 text-muted-foreground">
                          {stageFollowUp?.latest_reply?.trim() ? (
                            <span
                              className="line-clamp-2 text-sm text-foreground"
                              title={stageFollowUp.latest_reply}
                            >
                              {stageFollowUp.latest_reply}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            className="cursor-pointer gap-1 transition-colors duration-200"
                            disabled={!canFollowUp}
                            onClick={() => {
                              setFollowUpFeedback(null);
                              setFollowUpNote("");
                              setFollowUpTarget({
                                stage: sa.stage,
                                label: sa.label,
                                assigneeName: assigneeLabel,
                              });
                            }}
                          >
                            <Bell className="size-3" />
                            Follow up
                          </Button>
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {projectModuleAdmin ? (
          <div className="erp-scroll overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full min-w-180 text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Follow-up date</th>
                  <th className="px-3 py-2 font-medium">Step</th>
                  <th className="px-3 py-2 font-medium">Assigned To</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="px-3 py-2 font-medium">Reply</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {followUps.length > 0 ? (
                  followUps.map((fu) => (
                    <tr key={fu.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">
                        {displayDateTime(fu.created_at)}
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">
                        {fu.stage_label || fu.stage || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {employeeName(fu.recipient_employee_id)}
                      </td>
                      <td className="max-w-48 px-3 py-2 text-muted-foreground">
                        {fu.note?.trim() ? (
                          <span className="line-clamp-3 whitespace-pre-wrap">{fu.note}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-56 px-3 py-2 text-muted-foreground">
                        {fu.latest_reply?.trim() ? (
                          <span className="line-clamp-2" title={fu.latest_reply}>
                            {fu.latest_reply}
                          </span>
                        ) : (
                          <span className="text-xs italic">Awaiting reply</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground capitalize">
                        {fu.has_reply ? "Replied" : fu.delivery_status || fu.status || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-xs text-muted-foreground">
                      No follow-ups sent yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}

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

      {projectModuleAdmin ? (
        <ConfirmDialog
          open={Boolean(followUpTarget)}
          title="Send stage follow-up"
          description={
            followUpTarget
              ? `Notify ${followUpTarget.assigneeName} about ${followUpTarget.label}.`
              : undefined
          }
          confirmLabel="Send follow-up"
          cancelLabel="Cancel"
          busy={followUpBusy}
          onCancel={() => {
            if (followUpBusy) return;
            setFollowUpTarget(null);
            setFollowUpNote("");
          }}
          onConfirm={() => {
            if (!followUpTarget) return;
            setFollowUpBusy(true);
            void followUpSiteStage(projectId, followUpTarget.stage, followUpNote)
              .then(async (result) => {
                setFollowUpFeedback(result.message);
                setFollowUpTarget(null);
                setFollowUpNote("");
                await refreshFollowUpsOnly();
              })
              .catch((err) => {
                setFollowUpFeedback(
                  err instanceof ApiClientError
                    ? err.message
                    : err instanceof Error
                      ? err.message
                      : "Failed to send follow-up",
                );
              })
              .finally(() => setFollowUpBusy(false));
          }}
        >
          <label className="mt-3 block space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Note (optional)
            </span>
            <textarea
              value={followUpNote}
              onChange={(e) => setFollowUpNote(e.target.value)}
              rows={3}
              placeholder="Add a short follow-up note…"
              className="w-full rounded-md border border-border/80 bg-background px-2.5 py-2 text-sm text-foreground outline-none transition-colors duration-200 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              disabled={followUpBusy}
            />
          </label>
        </ConfirmDialog>
      ) : null}
    </ProjectsSection>
  );
}

/** Overview only — stage details are filled on dedicated form pages. */
export function SiteInstallationWorkflow({ projectId }: { projectId: string }) {
  const [row, setRow] = useState<SiteInstallation | null>(null);
  const [blueprint, setBlueprint] = useState<SiteInstallationBlueprint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canOpenForm, setCanOpenForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [site, bp, project, lookups, meRes] = await Promise.all([
        getSiteInstallationByProject(projectId),
        getSiteInstallationBlueprint(projectId),
        getProject(projectId),
        loadIntakeSummaryLookups(),
        authService.me(),
      ]);
      setRow(site);
      setBlueprint(bp);
      const parsed = parseAuthMe(meRes.data);
      const employeeId = resolveSessionEmployeeId(lookups.employees, parsed.user);
      setCanOpenForm(
        canOpenCurrentStageForm(project, site, employeeId, parsed.projectModuleAdmin),
      );
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
  const formLinkLabel =
    stage === "installation" && deliveryIsRackOnly(row.delivery_type)
      ? "Open Installation form"
      : formLink?.label;

  return (
    <ProjectsSection
      title="Site Installation Workflow"
      subtitle={`${row.document_number} · ${siteDeliveryTypeLabel(row.delivery_type)} · ${siteWorkflowStageLabel(stage)}`}
      icon={Cable}
      bodyClassName="space-y-4"
    >
      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}

      <div className="flex flex-wrap items-center gap-2">
        {formLink && !locked && canOpenForm ? (
          <Link
            href={formLink.href(projectId)}
            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
          >
            {formLinkLabel}
          </Link>
        ) : null}
        {stage === "intake" && !locked ? (
          <p className="text-xs text-muted-foreground">
            Intake fields are edited from Edit Project. Use Assign owners after intake is complete.
          </p>
        ) : null}
        {formLink && !locked && !canOpenForm && stage !== "intake" ? (
          <p className="text-xs text-muted-foreground">
            This step is assigned to a stage owner. Track progress below; only the assignee can open
            the workflow form.
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
