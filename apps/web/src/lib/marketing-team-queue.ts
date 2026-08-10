import { hasLinkedInSectionApproval, usesLinkedInSectionWorkflow } from "@/lib/linkedin-section-approval";
import { VERIFIER_ROLE_LABELS } from "@/lib/marketing-verification";
import type { MarketingContentItem, MarketingVerification } from "@/services/marketing-service";

export const MARKETING_TEAM_ROLE_KEYS = [
  "creator",
  "campaign_handler",
  "linkedin_handler",
  "video_editor",
] as const;

export type MarketingTeamRoleKey = (typeof MARKETING_TEAM_ROLE_KEYS)[number];

export type MarketingTeamChecklistRow = {
  contentId: string;
  contentNumber: string;
  title: string;
  status: string;
  verifierRole: MarketingTeamRoleKey;
  submitterName: string;
  pendingLabels: string[];
};

export type MarketingTeamRoleQueue = {
  role: MarketingTeamRoleKey;
  label: string;
  href: string;
  checklistRows: MarketingTeamChecklistRow[];
  pipelineItems: MarketingContentItem[];
  pendingCount: number;
};

export function teamRoleHref(role: MarketingTeamRoleKey): string {
  return `/marketing/team/role/${role}`;
}

export function isMarketingTeamRoleKey(value: string): value is MarketingTeamRoleKey {
  return (MARKETING_TEAM_ROLE_KEYS as readonly string[]).includes(value);
}

export function teamRoleLabel(role: MarketingTeamRoleKey): string {
  return VERIFIER_ROLE_LABELS[role] ?? role;
}

export function roleForPipelineItem(item: MarketingContentItem): MarketingTeamRoleKey {
  if (usesLinkedInSectionWorkflow(item) && hasLinkedInSectionApproval(item)) {
    return "linkedin_handler";
  }
  if (item.content_type === "video") {
    return "video_editor";
  }
  if (item.content_type === "social_post") {
    return "campaign_handler";
  }
  return "creator";
}

export function buildChecklistRows(
  items: Array<{
    content_id: string;
    content_number: string;
    title: string;
    status: string;
    pending_head_items: number;
    verifications: MarketingVerification[];
  }>,
): MarketingTeamChecklistRow[] {
  const rows: MarketingTeamChecklistRow[] = [];
  for (const item of items) {
    if (item.pending_head_items <= 0) continue;
    for (const verification of item.verifications) {
      if (!isMarketingTeamRoleKey(verification.verifier_role)) continue;
      const pendingItems = verification.items.filter((i) => i.status === "submitted");
      if (pendingItems.length === 0) continue;
      rows.push({
        contentId: item.content_id,
        contentNumber: item.content_number,
        title: item.title,
        status: item.status,
        verifierRole: verification.verifier_role,
        submitterName:
          verification.requested_by_name ??
          verification.items.find((i) => i.submitted_by_name)?.submitted_by_name ??
          "Team member",
        pendingLabels: pendingItems.map((i) => i.item_label),
      });
    }
  }
  return rows;
}

export function buildMarketingTeamRoleQueues(
  checklistSource: Parameters<typeof buildChecklistRows>[0],
  pipelineItems: MarketingContentItem[],
): MarketingTeamRoleQueue[] {
  const checklistRows = buildChecklistRows(checklistSource);

  return MARKETING_TEAM_ROLE_KEYS.map((role) => {
    const roleChecklist = checklistRows.filter((row) => row.verifierRole === role);
    const rolePipeline = pipelineItems.filter((item) => roleForPipelineItem(item) === role);
    return {
      role,
      label: teamRoleLabel(role),
      href: teamRoleHref(role),
      checklistRows: roleChecklist,
      pipelineItems: rolePipeline,
      pendingCount: roleChecklist.length + rolePipeline.length,
    };
  });
}

export function findTeamRoleQueue(
  queues: MarketingTeamRoleQueue[],
  roleKey: string,
): MarketingTeamRoleQueue | undefined {
  if (!isMarketingTeamRoleKey(roleKey)) return undefined;
  return queues.find((queue) => queue.role === roleKey);
}
