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
  MapPinned,
  Package,
  Server,
  Users,
} from "lucide-react";

import { deliveryIsRackOnly } from "@/components/projects/projects-domain";
import { buildSiteTrackingCheckpointRows } from "@/utils/project-tracking-checkpoints";
import {
  ProjectsErrorBanner,
  ProjectsSection,
} from "@/components/projects/projects-ui";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import { loadIntakeSummaryLookups } from "@/components/projects/site-intake-summary";
import {
  assigneeFieldForStage,
  assignWaitingHint,
  canAssignStageFromTracking,
  type AssignableStage,
} from "@/components/projects/site-stage-assignments";
import { stageProgressLabel } from "@/components/projects/site-stage-attachment";
import {
  advanceSiteInstallation,
  getSiteInstallationBlueprint,
  getSiteInstallationByProject,
  followUpSiteStage,
  getProject,
  listEmployeeOptions,
  listSiteStageFollowUps,
  updateSiteInstallationByProject,
  type SiteInstallation,
  type SiteInstallationBlueprint,
  type SiteInstallationFormInput,
  type SiteStageFollowUp,
} from "@/services/projects-portal-service";
import { parseAuthMe } from "@/lib/auth-user";
import { resolveSessionEmployeeId } from "@/lib/crm/session-employee";
import { canAdminViewStageForm, canOpenCurrentStageForm, isStageWorkDone, type SiteStageFormKey } from "@/lib/projects/site-stage-form-access";
import { authService } from "@/services/api-client";

type StageKey =
  | "intake"
  | "assignment"
  | "survey"
  | "scm"
  | "onsite_delivery"
  | "material_handover"
  | "onsite"
  | "installation"
  | "acceptance"
  | "completed";

const STAGE_ICONS: Record<string, typeof MapPin> = {
  intake: ClipboardCheck,
  assignment: Users,
  survey: MapPin,
  scm: Package,
  onsite_delivery: MapPinned,
  material_handover: Package,
  onsite: MapPinned,
  installation: Server,
  acceptance: CloudUpload,
  completed: Check,
};

const STAGE_FORM_LINKS: Partial<
  Record<StageKey, { href: (projectId: string) => string; label: string }>
> = {
  survey: {
    href: (id) => `/projects/projects/${id}/survey`,
    label: "Open Survey form",
  },
  scm: {
    href: (id) => `/projects/projects/${id}/scm`,
    label: "Open SCM form",
  },
  onsite_delivery: {
    href: (id) => `/projects/projects/${id}/onsite-delivery`,
    label: "Open Onsite Delivery form",
  },
  material_handover: {
    href: (id) => `/projects/projects/${id}/material-handover`,
    label: "Open Material Handover form",
  },
  onsite: {
    href: (id) => `/projects/projects/${id}/onsite-delivery`,
    label: "Open Onsite Delivery form",
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

/** Show person name only - drop trailing employee code like " (EMP-000057)". */
function employeeNameOnly(label: string): string {
  const stripped = label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return stripped || label;
}

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
  const [assignDrafts, setAssignDrafts] = useState<Record<string, string>>({});
  const [assignBusyStage, setAssignBusyStage] = useState<string | null>(null);

  const refreshFollowUpsOnly = useCallback(async () => {
    const rows = await listSiteStageFollowUps(projectId).catch(() => []);
    setFollowUps(Array.isArray(rows) ? rows : []);
  }, [projectId]);

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
      const drafts: Record<string, string> = {};
      for (const sa of bp.stage_assignments ?? []) {
        drafts[sa.stage] = sa.assignee_employee_id ?? "";
      }
      setAssignDrafts(drafts);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load stage owner tracking",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const onAssignStage = useCallback(
    async (stage: string) => {
      const field = assigneeFieldForStage(stage as AssignableStage);
      const employeeId = (assignDrafts[stage] ?? "").trim();
      if (!employeeId) {
        setError(`Select a person for ${field.label} before assigning.`);
        return;
      }
      setAssignBusyStage(stage);
      setError(null);
      setFollowUpFeedback(null);
      try {
        const payload: SiteInstallationFormInput = {
          [field.name]: employeeId,
        };
        await updateSiteInstallationByProject(projectId, payload);

        // Survey assign after create advances Intake (or legacy Assignment) → Survey.
        if (stage === "survey") {
          let current = await getSiteInstallationByProject(projectId);
          if (current.workflow_stage === "intake") {
            current = await advanceSiteInstallation(projectId, "complete_intake");
          }
          if (current.workflow_stage === "assignment") {
            await advanceSiteInstallation(projectId, "complete_assignment");
          }
        }

        await load();
        setFollowUpFeedback(
          `Assigned ${field.label.replace(/ assignee$/i, "")} owner. Notification email sent.`,
        )
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to assign stage owner");
      } finally {
        setAssignBusyStage(null);
      }
    },
    [assignDrafts, load, projectId],
  );

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

  const statusText = (
    workStatus: string,
    progressStatus?: string | null,
  ) => {
    const progress = stageProgressLabel(progressStatus);
    if (progress !== "-") return progress;
    if (workStatus === "done") return "Done";
    if (workStatus === "in_progress") return "In progress";
    if (workStatus === "skipped") return "Skipped";
    return "Pending";
  };

  const displayDate = (value: string | null | undefined) => {
    if (!value) return "-";
    return String(value).slice(0, 10);
  };

  const displayDateTime = (value: string | null | undefined) => {
    if (!value) return "-";
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
    const label = employeeOptions.find((e) => e.id === employeeId)?.label;
    return label ? employeeNameOnly(label) : "Assigned";
  };

  const employeeNames = Object.fromEntries(
    employeeOptions.map((e) => [e.id, e.label]),
  );
  const stageDates = buildSiteTrackingCheckpointRows({
    site,
    employeeNames,
  });

  return (
    <ProjectsSection title="Project Tracking" icon={Users}>
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
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Status</th>
                {projectModuleAdmin ? (
                  <th className="px-3 py-2 font-medium">Follow up</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {(blueprint.stage_assignments ?? []).map((sa) => {
                const assigneeLabel = sa.assignee_employee_id
                  ? employeeName(sa.assignee_employee_id)
                  : "Unassigned";
                const stageWorkDone = isStageWorkDone(sa.progress_status, sa.work_status);
                const adminCanViewStage =
                  Boolean(projectModuleAdmin) &&
                  site != null &&
                  canAdminViewStageForm(
                    site,
                    sa.stage as Exclude<SiteStageFormKey, "assignment">,
                    sa.progress_status,
                    sa.work_status,
                  );
                const canFollowUp =
                  Boolean(sa.assignee_employee_id) && !stageWorkDone;
                const stageViewHref =
                  adminCanViewStage && STAGE_FORM_LINKS[sa.stage as StageKey]
                    ? STAGE_FORM_LINKS[sa.stage as StageKey]!.href(projectId)
                    : null;
                const canAssign = canAssignStageFromTracking(
                  sa.stage,
                  blueprint.stage_assignments ?? [],
                  Boolean(projectModuleAdmin),
                );
                const waitingHint = assignWaitingHint(
                  sa.stage,
                  blueprint.stage_assignments ?? [],
                );
                const draftValue = assignDrafts[sa.stage] ?? sa.assignee_employee_id ?? "";
                const assignBusy = assignBusyStage === sa.stage;

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
                    <td className="px-3 py-2 text-muted-foreground">
                      {canAssign ? (
                        <div className="flex min-w-[220px] flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <FinanceSelect
                              value={draftValue}
                              className="h-8 min-w-0 flex-1"
                              aria-label={`Assign ${sa.label}`}
                              disabled={assignBusy}
                              onChange={(e) =>
                                setAssignDrafts((prev) => ({
                                  ...prev,
                                  [sa.stage]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Select person…</option>
                              {employeeOptions.map((emp) => {
                                const name = employeeNameOnly(emp.label) || emp.label;
                                return (
                                  <option key={emp.id} value={emp.id}>
                                    {name || emp.id}
                                  </option>
                                );
                              })}
                              {draftValue &&
                                !employeeOptions.some((emp) => emp.id === draftValue) ? (
                                <option value={draftValue}>
                                  {employeeName(draftValue)}
                                </option>
                              ) : null}
                            </FinanceSelect>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              className="h-8 shrink-0 cursor-pointer"
                              disabled={assignBusy || !draftValue.trim()}
                              onClick={() => void onAssignStage(sa.stage)}
                            >
                              {assignBusy ? "Saving…" : sa.assignee_employee_id ? "Update" : "Assign"}
                            </Button>
                          </div>
                        </div>
                      ) : waitingHint && !sa.assignee_employee_id ? (
                        <span className="text-xs italic text-muted-foreground">{waitingHint}</span>
                      ) : (
                        assigneeLabel
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {displayDate(sa.assigned_date)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {displayDate(sa.completed_date)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {statusText(sa.work_status, sa.progress_status)}
                    </td>
                    {projectModuleAdmin ? (
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
                        {fu.stage_label || fu.stage || "-"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {employeeName(fu.recipient_employee_id)}
                      </td>
                      <td className="max-w-48 px-3 py-2 text-muted-foreground">
                        {fu.note?.trim() ? (
                          <span className="line-clamp-3 whitespace-pre-wrap">{fu.note}</span>
                        ) : (
                          "-"
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
                        {fu.has_reply ? "Replied" : fu.delivery_status || fu.status || "-"}
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
                <th className="px-3 py-2 font-medium">Yes / No</th>
                <th className="px-3 py-2 font-medium">Completed By</th>
                <th className="px-3 py-2 font-medium">Yes clicked</th>
              </tr>
            </thead>
            <tbody>
              {stageDates.length > 0 ? (
                stageDates.map((row) => (
                  <tr
                    key={`${row.stageKey}-${row.checkpoint}`}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-3 py-2 font-medium text-foreground">
                      {row.step}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
                          row.answer === "yes"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-red-200 bg-red-50 text-red-800",
                        )}
                      >
                        {row.checkpoint}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex min-w-10 justify-center rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                          row.answer === "yes"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-red-200 bg-red-50 text-red-800",
                        )}
                      >
                        {row.answer === "yes" ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.completedBy}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {row.yesClicked}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-xs text-muted-foreground">
                    No checkpoints for this delivery type.
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

/** Overview only - stage details are filled on dedicated form pages. */
export function SiteInstallationWorkflow({ projectId }: { projectId: string }) {
  const { projectModuleAdmin } = useAuthUser();
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
  const completedStageLinks = useMemo(() => {
    if (!row || !blueprint || !locked) return [];
    return (blueprint.stage_assignments ?? [])
      .filter((sa) =>
        canAdminViewStageForm(
          row,
          sa.stage as Exclude<SiteStageFormKey, "assignment">,
          sa.progress_status,
          sa.work_status,
        ),
      )
      .map((sa) => {
        const link = STAGE_FORM_LINKS[sa.stage as StageKey];
        if (!link) return null;
        const label =
          sa.stage === "installation" && deliveryIsRackOnly(row.delivery_type)
            ? "View Installation"
            : `View ${sa.label}`;
        return { key: sa.stage, href: link.href(projectId), label };
      })
      .filter((entry): entry is { key: string; href: string; label: string } => entry != null);
  }, [blueprint, locked, projectId, row]);
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
        {locked && projectModuleAdmin && completedStageLinks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {completedStageLinks.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-border/80 bg-card px-3 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
          </div>
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
    </ProjectsSection>
  );
}
