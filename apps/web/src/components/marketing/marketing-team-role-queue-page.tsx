"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { MarketingContentReviewDialog } from "@/components/marketing/marketing-content-review-dialog";
import { MarketingPipelineStageTable } from "@/components/marketing/marketing-pipeline-stage-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMarketingHeadTeamNav } from "@/hooks/use-marketing-head-team-nav";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  findTeamRoleQueue,
  isMarketingTeamRoleKey,
  teamRoleLabel,
  type MarketingTeamRoleKey,
} from "@/lib/marketing-team-queue";
import { cn } from "@/lib/utils";
import { ApiClientError, type MarketingContentItem } from "@/services/marketing-service";

const ROLE_DESCRIPTIONS: Record<MarketingTeamRoleKey, string> = {
  creator: "Posts and copy submitted by content creators for your review.",
  campaign_handler: "Campaign and social content from the campaign handler queue.",
  linkedin_handler: "LinkedIn posts — section approval, final draft, and publishing steps.",
  video_editor: "Video content and editor checklist items awaiting your sign-off.",
};

type MarketingTeamRoleQueuePageProps = {
  roleKey: string;
};

export function MarketingTeamRoleQueuePage({ roleKey }: MarketingTeamRoleQueuePageProps) {
  const router = useRouter();
  const perms = useMarketingPermissions();
  const { roleQueues, loading, refresh } = useMarketingHeadTeamNav(perms.canApprove);
  const [reviewItem, setReviewItem] = useState<MarketingContentItem | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queue = useMemo(() => findTeamRoleQueue(roleQueues, roleKey), [roleQueues, roleKey]);
  const validRole = isMarketingTeamRoleKey(roleKey);

  useEffect(() => {
    if (perms.loading) return;
    if (!perms.canApprove) {
      router.replace("/marketing/pipeline");
    }
  }, [perms.loading, perms.canApprove, router]);

  const load = useCallback(async () => {
    setError(null);
    try {
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load team queue");
    }
  }, [refresh]);

  if (!perms.canApprove && !perms.loading) {
    return null;
  }

  if (!validRole) {
    return (
      <div className="space-y-4">
        <PageHeader title="Team queue" />
        <p className="text-sm text-muted-foreground">Unknown team role.</p>
      </div>
    );
  }

  const title = teamRoleLabel(roleKey);

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={ROLE_DESCRIPTIONS[roleKey]}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {queue && queue.checklistRows.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Checklist approvals</h2>
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-12 px-3 py-2">Sr.</th>
                  <th className="px-3 py-2">Content</th>
                  <th className="px-3 py-2">Submitted by</th>
                  <th className="px-3 py-2">Awaiting review</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.checklistRows.map((row, index) => (
                  <tr key={`${row.contentId}-${row.verifierRole}`} className="border-b border-border/50">
                    <td className="px-3 py-2 text-center text-xs font-medium tabular-nums text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.title}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.contentNumber}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{row.submitterName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{row.pendingLabels.join(" · ")}</td>
                    <td className="px-3 py-2">
                      <FinanceStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/marketing/approvals/${row.contentId}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Review post
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {queue && queue.pipelineItems.length > 0 ? (
        <MarketingPipelineStageTable
          title={queue.checklistRows.length > 0 ? "Posts in pipeline" : "Pending review"}
          items={queue.pipelineItems}
          onReview={(item) => {
            setReviewItem(item);
            setReviewOpen(true);
          }}
          stageKey="head_queue"
        />
      ) : null}

      {!loading && queue && queue.pendingCount === 0 ? (
        <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing waiting for your approval from {title.toLowerCase()} right now.
        </p>
      ) : null}

      <MarketingContentReviewDialog
        item={reviewItem}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onDone={(updated) => {
          void load();
          if (updated) setReviewItem(updated);
        }}
      />
    </div>
  );
}
