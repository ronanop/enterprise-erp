"use client";

import { ChevronRight, Inbox } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { MarketingReviewSectionHeader } from "@/components/marketing/marketing-review-section-header";
import { Button } from "@/components/ui/button";
import { linkedInPublishStatusLabel } from "@/lib/linkedin-section-approval";
import { videoPublishStatusLabel } from "@/lib/video-section-approval";
import { marketingCard, marketingCardInteractive } from "@/lib/marketing-ui";
import { cn } from "@/lib/utils";
import {
  formatMarketingStatus,
  type MarketingContentItem,
  type MarketingPipelineCampaign,
} from "@/services/marketing-service";

const STAGE_HINTS: Record<string, string> = {
  my_drafts: "Drafts you can edit and send for review",
  needs_fixes: "Items sent back with marketing head feedback",
  my_in_review: "Waiting in the review pipeline",
  ready_to_post: "Approved — post and confirm back to head",
  report_posting_to_head: "Tell marketing head once you have posted",
  media_queue: "Media review queue for marketing head",
  head_queue: "Awaiting marketing head approval",
};

function formatPipelineTimestamp(iso: string): { primary: string; secondary: string } {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return { primary: "Today", secondary: time };
  if (isYesterday) return { primary: "Yesterday", secondary: time };
  return {
    primary: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    secondary: time,
  };
}

function contentPreview(item: MarketingContentItem): string | null {
  const text = item.body?.trim() || item.summary?.trim() || item.theme?.trim();
  if (!text) return null;
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

function actionLabel(
  isPostingQueue: boolean | undefined,
  stageKey: string | undefined,
): string {
  if (isPostingQueue) return "Tell head: Posted?";
  if (stageKey === "linkedin_send_final_draft_to_head") return "Send final draft to head";
  if (stageKey === "video_send_final_draft_to_head") return "Send final draft to head";
  if (stageKey === "head_final_draft_review") return "Approve final draft";
  if (stageKey === "linkedin_send_to_publisher") return "Send to publisher";
  if (stageKey === "video_send_to_publisher") return "Send to publisher";
  if (stageKey === "linkedin_publisher_queue") return "Mark as published";
  if (stageKey === "video_publisher_queue") return "Mark as published";
  if (stageKey === "head_awaiting_publisher") return "Follow up";
  if (stageKey === "media_queue") return "Review & feedback";
  if (stageKey === "ready_to_post") return "Post & confirm";
  if (stageKey === "head_queue") return "Review & feedback";
  return "Open & verify";
}

function isPrimaryAction(isPostingQueue: boolean | undefined, stageKey: string | undefined): boolean {
  return Boolean(
    isPostingQueue ||
      stageKey === "ready_to_post" ||
      stageKey === "linkedin_send_to_publisher" ||
      stageKey === "video_send_to_publisher" ||
      stageKey === "linkedin_publisher_queue" ||
      stageKey === "video_publisher_queue" ||
      stageKey === "linkedin_send_final_draft_to_head" ||
      stageKey === "video_send_final_draft_to_head" ||
      stageKey === "head_final_draft_review",
  );
}

export function MarketingPipelineStageTable({
  title,
  description,
  items,
  onReview,
  compact,
  isPostingQueue,
  stageKey,
}: {
  title: string;
  description?: string;
  items: MarketingContentItem[];
  onReview: (item: MarketingContentItem) => void;
  compact?: boolean;
  isPostingQueue?: boolean;
  stageKey?: string;
}) {
  const hint = description ?? (stageKey ? STAGE_HINTS[stageKey] : undefined);

  return (
    <section className={cn(marketingCard, marketingCardInteractive)}>
      {!compact && title ? (
        <MarketingReviewSectionHeader
          tone="pipeline"
          title={title}
          description={hint}
          count={items.length}
        />
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-full border border-dashed border-border/70 bg-muted/30">
            <Inbox className="size-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nothing in this queue</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            New items will show up here when they reach this stage.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border/60 bg-muted/20 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th className="w-14 px-4 py-2.5">#</th>
                <th className="px-4 py-2.5">Content</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Updated</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const preview = contentPreview(item);
                const updatedAt = item.submitted_at ?? item.created_at;
                const { primary, secondary } = formatPipelineTimestamp(updatedAt);
                const primaryAction = isPrimaryAction(isPostingQueue, stageKey);

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-b border-border/40 transition-colors last:border-b-0 hover:bg-muted/25",
                      isPostingQueue && "bg-violet-500/[0.04] hover:bg-violet-500/[0.07]",
                    )}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex size-7 items-center justify-center rounded-md bg-muted/50 text-xs font-semibold tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{item.title}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{item.content_number}</div>
                      {preview ? (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{preview}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        <FinanceStatusBadge status={item.status} />
                        {item.posting_report_status && item.posting_report_status !== "pending" ? (
                          <p className="text-[11px] text-muted-foreground">
                            Report: {formatMarketingStatus(item.posting_report_status)}
                          </p>
                        ) : item.posting_report_status === "pending" ? (
                          <p className="text-[11px] font-medium text-amber-700">Awaiting post report</p>
                        ) : null}
                        {linkedInPublishStatusLabel(item) || videoPublishStatusLabel(item) ? (
                          <p className="text-[11px] text-primary">
                            {linkedInPublishStatusLabel(item) || videoPublishStatusLabel(item)}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        <p className="font-medium text-foreground">{primary}</p>
                        <p className="text-muted-foreground">{secondary}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant={primaryAction ? "default" : "outline"}
                        className={cn(!primaryAction && "bg-background")}
                        onClick={() => onReview(item)}
                      >
                        {actionLabel(isPostingQueue, stageKey)}
                        <ChevronRight className="size-3.5 opacity-70" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function MarketingPipelineCampaignStageTable({
  title,
  campaigns,
  onReview,
  isHeadQueue,
}: {
  title: string;
  campaigns: MarketingPipelineCampaign[];
  onReview: (campaign: MarketingPipelineCampaign) => void;
  isHeadQueue?: boolean;
}) {
  return (
    <section className={cn(marketingCard, marketingCardInteractive)}>
      <MarketingReviewSectionHeader tone="pipeline" title={title} count={campaigns.length} />

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-full border border-dashed border-border/70 bg-muted/30">
            <Inbox className="size-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nothing in this queue</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Campaigns will appear here when they reach this stage.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border/60 bg-muted/20 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th className="w-14 px-4 py-2.5">#</th>
                <th className="px-4 py-2.5">Campaign</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign, index) => (
                <tr
                  key={campaign.id}
                  className="border-b border-border/40 transition-colors last:border-b-0 hover:bg-muted/25"
                >
                  <td className="px-4 py-3">
                    <span className="inline-flex size-7 items-center justify-center rounded-md bg-muted/50 text-xs font-semibold tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{campaign.name}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {campaign.campaign_number}
                    </div>
                    {campaign.description ? (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {campaign.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <FinanceStatusBadge status={campaign.status} />
                    {campaign.rejection_reason ? (
                      <p className="mt-1.5 text-[11px] font-medium text-amber-700">Has head feedback</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant={isHeadQueue ? "default" : "outline"}
                      className={cn(!isHeadQueue && "bg-background")}
                      onClick={() => onReview(campaign)}
                    >
                      {isHeadQueue
                        ? "Review & feedback"
                        : campaign.status === "changes_required"
                          ? "Edit & resubmit"
                          : "Open campaign"}
                      <ChevronRight className="size-3.5 opacity-70" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
