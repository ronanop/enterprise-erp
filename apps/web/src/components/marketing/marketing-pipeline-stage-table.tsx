"use client";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { linkedInPublishStatusLabel } from "@/lib/linkedin-section-approval";
import { formatMarketingStatus, type MarketingContentItem, type MarketingPipelineCampaign } from "@/services/marketing-service";

export function MarketingPipelineStageTable({
  title,
  items,
  onReview,
  compact,
  isPostingQueue,
  stageKey,
}: {
  title: string;
  items: MarketingContentItem[];
  onReview: (item: MarketingContentItem) => void;
  compact?: boolean;
  isPostingQueue?: boolean;
  stageKey?: string;
}) {
  return (
    <section className="space-y-2">
      {!compact && title ? (
        <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-2">Sr.</th>
              <th className="px-3 py-2">Content</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                key={item.id}
                className={`border-b border-border/50 ${isPostingQueue ? "bg-violet-500/5" : ""}`}
              >
                <td className="px-3 py-2 text-center text-xs font-medium tabular-nums text-muted-foreground">
                  {index + 1}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{item.title}</div>
                  <div className="font-mono text-xs text-muted-foreground">{item.content_number}</div>
                </td>
                <td className="px-3 py-2">
                  <FinanceStatusBadge status={item.status} />
                  {item.posting_report_status && item.posting_report_status !== "pending" ? (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Report: {formatMarketingStatus(item.posting_report_status)}
                    </div>
                  ) : item.posting_report_status === "pending" ? (
                    <div className="mt-1 text-[10px] text-amber-600">Awaiting post report</div>
                  ) : null}
                  {linkedInPublishStatusLabel(item) ? (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {linkedInPublishStatusLabel(item)}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {item.submitted_at
                    ? new Date(item.submitted_at).toLocaleString()
                    : new Date(item.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      isPostingQueue ||
                      stageKey === "ready_to_post" ||
                      stageKey === "linkedin_send_to_publisher" ||
                      stageKey === "linkedin_publisher_queue"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => onReview(item)}
                  >
                    {isPostingQueue
                      ? "Tell head: Posted?"
                      : stageKey === "linkedin_send_final_draft_to_head"
                        ? "Send final draft to head"
                        : stageKey === "head_final_draft_review"
                          ? "Approve final draft"
                          : stageKey === "linkedin_send_to_publisher"
                            ? "Send to publisher"
                            : stageKey === "linkedin_publisher_queue"
                              ? "Mark as published"
                              : stageKey === "head_awaiting_publisher"
                                ? "Follow up"
                                : stageKey === "media_queue"
                                  ? "Review & feedback"
                                  : stageKey === "ready_to_post"
                                    ? "Post & confirm"
                                    : stageKey === "head_queue"
                                      ? "Review & feedback"
                                      : "Open & verify"}
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Nothing in this queue right now.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
    <section className="space-y-2">
      <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-2">Sr.</th>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c, index) => (
              <tr key={c.id} className="border-b border-border/50">
                <td className="px-3 py-2 text-center text-xs font-medium tabular-nums text-muted-foreground">
                  {index + 1}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{c.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{c.campaign_number}</div>
                  {c.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <FinanceStatusBadge status={c.status} />
                  {c.rejection_reason ? (
                    <p className="mt-1 text-[10px] text-amber-600">Has head feedback</p>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isHeadQueue ? "default" : "outline"}
                    onClick={() => onReview(c)}
                  >
                    {isHeadQueue
                      ? "Review & feedback"
                      : c.status === "changes_required"
                        ? "Edit & resubmit"
                        : "Open campaign"}
                  </Button>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  Nothing in this queue right now.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
