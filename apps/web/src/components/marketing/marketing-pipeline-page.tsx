"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { MarketingCampaignReviewDialog } from "@/components/marketing/marketing-campaign-review-dialog";
import { MarketingContentReviewDialog } from "@/components/marketing/marketing-content-review-dialog";
import { MarketingPipelineFunnel } from "@/components/marketing/marketing-pipeline-funnel";
import {
  MarketingPipelineCampaignStageTable,
  MarketingPipelineStageTable,
} from "@/components/marketing/marketing-pipeline-stage-table";
import { MarketingPageHeader } from "@/components/marketing/marketing-page-header";
import { marketingActionBanner, marketingPage } from "@/lib/marketing-ui";
import { Button } from "@/components/ui/button";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  ApiClientError,
  getMarketingPipeline,
  type MarketingContentItem,
  type MarketingPipelineCampaign,
  type MarketingPipelineWork,
} from "@/services/marketing-service";

const POLL_MS = 15_000;

const CAMPAIGN_STAGE_KEYS = new Set([
  "campaign_drafts",
  "campaign_submitted",
  "campaign_approved",
  "campaign_head_review",
]);

const HIDDEN_PIPELINE_STAGE_KEYS = new Set(["ready_to_post", "posted_archive"]);

export function MarketingPipelinePage() {
  const perms = useMarketingPermissions();
  const [pipeline, setPipeline] = useState<MarketingPipelineWork | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewItem, setReviewItem] = useState<MarketingContentItem | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewCampaign, setReviewCampaign] = useState<MarketingPipelineCampaign | null>(null);
  const [campaignReviewOpen, setCampaignReviewOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const work = await getMarketingPipeline();
      setPipeline(work);
    } catch (err) {
      setPipeline(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const activeStages = useMemo(() => {
    return (pipeline?.stages ?? []).filter((stage) => {
      if (HIDDEN_PIPELINE_STAGE_KEYS.has(stage.key)) return false;
      if (CAMPAIGN_STAGE_KEYS.has(stage.key)) {
        return (stage.campaigns ?? []).length > 0;
      }
      return stage.items.length > 0;
    });
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
    <div className={marketingPage}>
      <MarketingPageHeader
        title="Dashboard"
        description="Track your drafts, approvals, and publishing queues in one place."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh now
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {postingPendingCount > 0 ? (
        <div className={marketingActionBanner}>
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

      {activeStages.map((stage) =>
        CAMPAIGN_STAGE_KEYS.has(stage.key) ? (
          <MarketingPipelineCampaignStageTable
            key={stage.key}
            title={stage.label}
            campaigns={stage.campaigns ?? []}
            onReview={openCampaignReview}
            isHeadQueue={stage.key === "campaign_head_review"}
          />
        ) : (
          <MarketingPipelineStageTable
            key={stage.key}
            title={stage.label}
            description={stage.description}
            items={stage.items}
            onReview={openReview}
            isPostingQueue={stage.key === "report_posting_to_head"}
            stageKey={stage.key}
          />
        ),
      )}

      <MarketingContentReviewDialog
        item={reviewItem}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onDone={(updated) => {
          void load();
          if (updated) setReviewItem(updated);
        }}
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
