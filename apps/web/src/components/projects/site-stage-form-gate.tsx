"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { parseAuthMe } from "@/lib/auth-user";
import { resolveSessionEmployeeId } from "@/lib/crm/session-employee";
import {
  canAdminViewStageForm,
  canEditSiteStageForm,
  canOpenAssignedStageForm,
  isAssigneeForStage,
  isSiteWorkflowTerminal,
  isStageWorkDone,
  type SiteStageFormKey,
  workflowStageNotCompleteMessage,
} from "@/lib/projects/site-stage-form-access";
import { WorkflowStepBlockedDialog } from "@/components/projects/workflow-step-blocked-dialog";
import {
  SiteStageFormReadOnlyProvider,
  type SiteStageFormReadOnlyMeta,
} from "@/components/projects/site-stage-form-read-only-context";
import { authService } from "@/services/api-client";
import {
  getProject,
  getSiteInstallationBlueprint,
  getSiteInstallationByProject,
} from "@/services/projects-portal-service";
import { loadIntakeSummaryLookups } from "@/components/projects/site-intake-summary";

type GateState = "loading" | "allowed" | "denied" | "blocked";

const editableMeta: SiteStageFormReadOnlyMeta = { readOnly: false };

/**
 * Only the project manager (assign step) or the active stage assignee may open workflow forms.
 * Completed steps open read-only for assignees (Completed Jobs) and admins (project tracking).
 */
export function SiteStageFormGate({
  projectId,
  stage,
  children,
}: {
  projectId: string;
  stage: SiteStageFormKey;
  children: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<GateState>("loading");
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [readOnlyMeta, setReadOnlyMeta] = useState<SiteStageFormReadOnlyMeta>(editableMeta);

  useEffect(() => {
    setState("loading");
    let cancelled = false;

    void (async () => {
      try {
        const [project, site, lookups, meRes, blueprint] = await Promise.all([
          getProject(projectId),
          getSiteInstallationByProject(projectId),
          loadIntakeSummaryLookups(),
          authService.me(),
          getSiteInstallationBlueprint(projectId).catch(() => null),
        ]);
        const parsed = parseAuthMe(meRes.data);
        const user = parsed.user;
        const employeeId = resolveSessionEmployeeId(lookups.employees, user);
        const stageRow = blueprint?.stage_assignments?.find((a) => a.stage === stage);
        const stageDone = isStageWorkDone(
          stageRow?.progress_status,
          stageRow?.work_status ?? "",
        );

        if (
          parsed.projectModuleAdmin &&
          canAdminViewStageForm(
            site,
            stage,
            stageRow?.progress_status,
            stageRow?.work_status ?? "",
          )
        ) {
          setReadOnlyMeta({
            readOnly: true,
            backHref: `/projects/projects/${projectId}`,
            backLabel: "Back to project",
          });
          setState("allowed");
          return;
        }

        if (
          isSiteWorkflowTerminal(site) &&
          isAssigneeForStage(site, stage, employeeId)
        ) {
          setReadOnlyMeta({
            readOnly: true,
            backHref: "/projects/completed-jobs",
            backLabel: "Back to Completed Jobs",
          });
          setState("allowed");
          return;
        }

        const allowed = canEditSiteStageForm(
          project,
          site,
          stage,
          employeeId,
          parsed.projectModuleAdmin,
        );
        if (cancelled) return;
        if (allowed) {
          setReadOnlyMeta(editableMeta);
          setState("allowed");
          return;
        }

        if (isAssigneeForStage(site, stage, employeeId) && stageDone) {
          setReadOnlyMeta({
            readOnly: true,
            backHref: "/projects/completed-jobs",
            backLabel: "Back to Completed Jobs",
          });
          setState("allowed");
          return;
        }

        if (
          isAssigneeForStage(site, stage, employeeId) &&
          !canOpenAssignedStageForm(site, stage, site.workflow_stage) &&
          !stageDone
        ) {
          setBlockedMessage(workflowStageNotCompleteMessage(site, stage));
          setState("blocked");
          return;
        }
        setState("denied");
        router.replace(`/projects/projects/${projectId}`);
      } catch {
        if (!cancelled) {
          setState("denied");
          router.replace(`/projects/projects/${projectId}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, stage, router]);

  if (state === "blocked") {
    return (
      <>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This step is not active yet. Use My Jobs when the current stage matches your assignment.
          </p>
        </div>
        <WorkflowStepBlockedDialog
          open={blockedMessage !== null}
          message={blockedMessage ?? ""}
          onClose={() => {
            setBlockedMessage(null);
            router.replace("/projects/my-jobs");
          }}
        />
      </>
    );
  }

  if (state !== "allowed") {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return (
    <SiteStageFormReadOnlyProvider value={readOnlyMeta}>{children}</SiteStageFormReadOnlyProvider>
  );
}
