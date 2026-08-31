import type { OnboardingCase, OnboardingCaseStatus } from "@/types/onboarding-management";
import { resolveOnboardingDisplayStatus } from "@/lib/onboarding-display-status";

export type OnboardingWorkflowStep = {
  id: string;
  label: string;
  at?: string;
  state: "done" | "current" | "upcoming";
};

const STATUS_RANK: Record<OnboardingCaseStatus, number> = {
  draft: 0,
  invitation_sent: 1,
  in_progress: 2,
  submitted: 3,
  hr_review: 4,
  overdue: 4,
  ready_to_join: 5,
  pending_join: 6,
  joined: 7,
  cancelled: -1,
};

function formatStepDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Pipeline steps for expandable case rows (no assignee fields). */
export function buildOnboardingWorkflowSteps(c: OnboardingCase): OnboardingWorkflowStep[] {
  if (c.status === "cancelled") {
    return [
      {
        id: "cancelled",
        label: "Cancelled",
        at: formatStepDate(c.updatedAt),
        state: "current",
      },
    ];
  }

  const docs = c.portal.documents;
  const docsVerified =
    docs.length > 0 && docs.every((d) => d.verifyStatus === "verified");
  const formsSubmitted = Boolean(c.portal.submittedAt);
  const inviteSent = Boolean(c.invitation?.sentAt) || STATUS_RANK[c.status] >= 1;
  const hrApproved = ["ready_to_join", "pending_join", "joined"].includes(c.status);
  const mgrDone =
    c.checklist.filter((t) => t.owner === "manager").length === 0 ||
    c.checklist.filter((t) => t.owner === "manager").every((t) => t.status === "done");
  const ready = ["ready_to_join", "pending_join", "joined"].includes(c.status);
  const joined = c.status === "joined";

  const raw: { id: string; label: string; at?: string; done: boolean }[] = [
    {
      id: "invitation",
      label: "Invitation Sent",
      at: formatStepDate(c.invitation?.sentAt ?? (inviteSent ? c.createdAt : undefined)),
      done: inviteSent,
    },
    {
      id: "forms",
      label: "Forms Submitted",
      at: formatStepDate(c.portal.submittedAt),
      done: formsSubmitted || STATUS_RANK[c.status] >= 3,
    },
    {
      id: "docs",
      label: "Documents Verified",
      at: docsVerified ? formatStepDate(c.updatedAt) : undefined,
      done: docsVerified || hrApproved,
    },
    {
      id: "hr",
      label: "HR Approval",
      done: hrApproved,
    },
    {
      id: "ready",
      label: "Ready to Join",
      at: ready ? formatStepDate(c.joiningDate) : undefined,
      done: ready,
    },
    {
      id: "joined",
      label: "Joined",
      at: formatStepDate(c.activatedAt),
      done: joined,
    },
  ];

  // Optional manager step only when checklist exists — still no assignee UI.
  if (c.checklist.some((t) => t.owner === "manager")) {
    raw.splice(4, 0, {
      id: "manager",
      label: "Manager Checklist",
      done: mgrDone && ready,
    });
  }

  let currentIdx = raw.findIndex((s) => !s.done);
  if (currentIdx < 0) currentIdx = raw.length - 1;

  return raw.map((s, i) => ({
    id: s.id,
    label: s.label,
    at: s.at,
    state: s.done ? "done" : i === currentIdx ? "current" : "upcoming",
  }));
}

export function onboardingStageRemark(c: OnboardingCase): string {
  const display = resolveOnboardingDisplayStatus(c.status, c.joiningDate);
  switch (c.status) {
    case "draft":
      return "Case drafted — send an invitation to start the candidate portal.";
    case "invitation_sent":
      return "Invitation sent — waiting for the candidate to open the portal.";
    case "in_progress":
      return "Candidate is filling forms and uploading documents.";
    case "submitted":
      return "Forms submitted — review details and documents.";
    case "hr_review":
      return "Awaiting HR approval for submitted documents and employee details.";
    case "overdue":
      return "Onboarding is overdue — follow up with the candidate or HR owner.";
    case "ready_to_join":
      return "Ready to join — complete activation when the joining date arrives.";
    case "pending_join":
      return `Pending join — employee activates on ${c.joiningDate || "joining date"}.`;
    case "joined":
      return "Employee joined and is active in Workforce.";
    case "cancelled":
      return "This onboarding case was cancelled.";
    default:
      return `Current stage: ${display}.`;
  }
}

export function statusToneClass(statusLabel: string): string {
  const s = statusLabel.toLowerCase();
  if (s.includes("overdue") || s.includes("cancel")) {
    return "bg-hrms-pink text-hrms-danger border-transparent";
  }
  if (s.includes("ready") || s.includes("joined") || s.includes("pending join")) {
    return "bg-hrms-blue text-hrms-info border-transparent";
  }
  if (s.includes("progress") || s.includes("review") || s.includes("submitted") || s.includes("invitation")) {
    return "bg-hrms-peach text-hrms-warning border-transparent";
  }
  return "bg-muted text-muted-foreground border-transparent";
}
