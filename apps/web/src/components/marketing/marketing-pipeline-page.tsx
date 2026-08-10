"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { MarketingCampaignReviewDialog } from "@/components/marketing/marketing-campaign-review-dialog";
import { MarketingContentReviewDialog } from "@/components/marketing/marketing-content-review-dialog";
import { MarketingPipelineFunnel } from "@/components/marketing/marketing-pipeline-funnel";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  ApiClientError,
  formatMarketingStatus,
  getMarketingHeadReview,
  getMarketingPipeline,
  type MarketingContentItem,
  type MarketingPipelineCampaign,
  type MarketingPipelineHeadReview,
  type MarketingPipelineWork,
} from "@/services/marketing-service";

const POLL_MS = 15_000;

const CAMPAIGN_STAGE_KEYS = new Set([
  "campaign_drafts",
  "campaign_submitted",
  "campaign_approved",
  "campaign_head_review",
]);

function StageTable({
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
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Content</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={`border-b border-border/50 ${isPostingQueue ? "bg-violet-500/5" : ""}`}
              >
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
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : new Date(item.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isPostingQueue || stageKey === "ready_to_post" ? "default" : "outline"}
                    onClick={() => onReview(item)}
                  >
                    {isPostingQueue
                      ? "Tell head: Posted?"
                      : stageKey === "media_queue"
                        ? "Review & feedback"
                        : stageKey === "ready_to_post"
                          ? "Post & confirm"
                          : "Open & verify"}
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
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

function CampaignStageTable({
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
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-border/50">
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
                  <Button type="button" size="sm" variant={isHeadQueue ? "default" : "outline"} onClick={() => onReview(c)}>
                    {isHeadQueue ? "Review & feedback" : c.status === "changes_required" ? "Edit & resubmit" : "Open campaign"}
                  </Button>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
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

export function MarketingPipelinePage() {
  const perms = useMarketingPermissions();
  const [pipeline, setPipeline] = useState<MarketingPipelineWork | null>(null);
  const [headReview, setHeadReview] = useState<MarketingPipelineHeadReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewItem, setReviewItem] = useState<MarketingContentItem | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewCampaign, setReviewCampaign] = useState<MarketingPipelineCampaign | null>(null);
  const [campaignReviewOpen, setCampaignReviewOpen] = useState(false);

  const canHeadReview = perms.canApprove;

  const load = useCallback(async () => {
    setError(null);
    try {
      const work = await getMarketingPipeline();
      setPipeline(work);
      if (canHeadReview) {
        try {
          setHeadReview(await getMarketingHeadReview());
        } catch (err) {
          if (err instanceof ApiClientError && err.status === 403) {
            setHeadReview(null);
          } else {
            throw err;
          }
        }
      } else {
        setHeadReview(null);
      }
    } catch (err) {
      setPipeline(null);
      setHeadReview(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, [canHeadReview]);

  useEffect(() => {
    if (perms.loading) return;
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, perms.loading]);

  const funnelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of pipeline?.funnel ?? []) {
      counts[stage.key] = stage.count;
    }
    return counts;
  }, [pipeline]);

  const openReview = (item: MarketingContentItem) => {
    setReviewItem(item);
    setReviewOpen(true);
  };

  const openCampaignReview = (campaign: MarketingPipelineCampaign) => {
    setReviewCampaign(campaign);
    setCampaignReviewOpen(true);
  };

  const postingPendingCount =
    pipeline?.stages.find((s) => s.key === "report_posting_to_head")?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My pipeline"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh now
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {postingPendingCount > 0 ? (
        <div className="rounded-xl border border-violet-500/40 bg-violet-500/10 p-4">
          <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
            Action needed: tell marketing head if you posted ({postingPendingCount} item
            {postingPendingCount === 1 ? "" : "s"})
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Head approved your content. Open each item below and choose{" "}
            <strong>“Yes — I posted it”</strong> or <strong>“Not posted yet”</strong>.
          </p>
        </div>
      ) : null}

      <MarketingPipelineFunnel counts={funnelCounts} loading={loading} />

      {pipeline?.stages.map((stage) =>
        CAMPAIGN_STAGE_KEYS.has(stage.key) ? (
          <CampaignStageTable
            key={stage.key}
            title={`${stage.label} (${stage.count})`}
            campaigns={stage.campaigns ?? []}
            onReview={openCampaignReview}
            isHeadQueue={stage.key === "campaign_head_review"}
          />
        ) : (
          <StageTable
            key={stage.key}
            title={`${stage.label} (${stage.count})`}
            items={stage.items}
            onReview={openReview}
            isPostingQueue={stage.key === "report_posting_to_head"}
            stageKey={stage.key}
          />
        ),
      )}

      {canHeadReview && headReview ? (
        <section className="space-y-4 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
          <div>
            <h2 className="text-sm font-semibold">Marketing head — review by team member</h2>
          </div>
          {headReview.groups.map((group) => (
            <div key={group.user_id ?? group.display_name} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-medium">{group.display_name}</h3>
                {group.email ? <span className="text-xs text-muted-foreground">{group.email}</span> : null}
                <span className="text-xs text-muted-foreground">({group.items.length} items)</span>
              </div>
              <StageTable
                title=""
                items={group.items}
                onReview={openReview}
                compact
                stageKey="head_queue"
              />
            </div>
          ))}
          {headReview.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending submissions from the team.</p>
          ) : null}
        </section>
      ) : null}

      <MarketingContentReviewDialog
        item={reviewItem}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onDone={() => void load()}
      />

      <MarketingCampaignReviewDialog
        campaign={reviewCampaign}
        open={campaignReviewOpen}
        onOpenChange={setCampaignReviewOpen}
        onDone={() => void load()}
      />
    </div>
  );
}
