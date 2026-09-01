"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { MarketingContentReviewDialog } from "@/components/marketing/marketing-content-review-dialog";
import { MarketingPageHeader } from "@/components/marketing/marketing-page-header";
import { marketingPage, marketingTableShell } from "@/lib/marketing-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import { VERIFIER_ROLE_LABELS } from "@/lib/marketing-verification";
import { usesLinkedInSectionWorkflow } from "@/lib/linkedin-section-approval";
import { usesVideoSectionWorkflow } from "@/lib/video-section-approval";
import { buildChecklistRows, MARKETING_TEAM_ROLE_KEYS, teamRoleHref } from "@/lib/marketing-team-queue";
import { cn } from "@/lib/utils";
import {
  ApiClientError,
  formatMarketingStatus,
  getHeadVerificationDashboard,
  listContentItems,
  marketingContentStatusForDisplay,
  type MarketingContentItem,
} from "@/services/marketing-service";

const POLL_MS = 10_000;

type HeadApprovalRow = ReturnType<typeof buildChecklistRows>[number];

function HeadApprovalTable({
  title,
  rows,
  queueHref,
}: {
  title: string;
  rows: HeadApprovalRow[];
  queueHref?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {queueHref ? (
          <Link href={queueHref} className="text-xs font-medium text-primary hover:underline">
            View full queue
          </Link>
        ) : null}
      </div>
      <div className={marketingTableShell}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Content</th>
              <th className="px-3 py-2">Submitted by</th>
              <th className="px-3 py-2">Awaiting review</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.contentId}-${row.verifierRole}`} className="border-b border-border/50">
                <td className="px-3 py-2">
                  <div className="font-medium">{row.title}</div>
                  <div className="font-mono text-xs text-muted-foreground">{row.contentNumber}</div>
                </td>
                <td className="px-3 py-2 text-xs">{row.submitterName}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{row.pendingLabels.join(" · ")}</td>
                <td className="px-3 py-2">
                  <FinanceStatusBadge status={marketingContentStatusForDisplay(row.status)} />
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Nothing waiting for your approval.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApprovalTable({
  title,
  items,
  onReview,
}: {
  title: string;
  items: MarketingContentItem[];
  onReview: (item: MarketingContentItem) => void;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className={marketingTableShell}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Content</th>
              <th className="px-3 py-2">Post preview</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border/50">
                <td className="px-3 py-2">
                  <div className="font-medium">{item.title}</div>
                  <div className="font-mono text-xs text-muted-foreground">{item.content_number}</div>
                </td>
                <td className="max-w-[180px] truncate px-3 py-2 text-xs text-muted-foreground">
                  {item.body ? (item.body.length > 60 ? `${item.body.slice(0, 60)}…` : item.body) : "—"}
                </td>
                <td className="px-3 py-2">
                  <FinanceStatusBadge status={marketingContentStatusForDisplay(item.status)} />
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => onReview(item)}>
                    Open & verify
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Nothing in this queue.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MarketingApprovalsPage() {
  const perms = useMarketingPermissions();
  const [mediaQueue, setMediaQueue] = useState<MarketingContentItem[]>([]);
  const [headRows, setHeadRows] = useState<HeadApprovalRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewItem, setReviewItem] = useState<MarketingContentItem | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mediaPromise = perms.canApproveMedia
        ? listContentItems({ status: "in_review", page_size: 200 })
        : Promise.resolve([] as MarketingContentItem[]);
      const dashboardPromise = perms.canApprove
        ? getHeadVerificationDashboard()
        : Promise.resolve(null);

      const [media, dashboard] = await Promise.all([mediaPromise, dashboardPromise]);
      setMediaQueue(
        (media ?? []).filter(
          (item) => !usesLinkedInSectionWorkflow(item) && !usesVideoSectionWorkflow(item),
        ),
      );

      if (dashboard) {
        const rows = buildChecklistRows(dashboard.items);
        setHeadRows(rows);
        setPendingCount(dashboard.summary.pending_head_reviews ?? rows.length);
      } else {
        setHeadRows([]);
        setPendingCount(0);
      }
    } catch (err) {
      setMediaQueue([]);
      setHeadRows([]);
      setPendingCount(0);
      setError(err instanceof ApiClientError ? err.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, [perms.canApproveMedia, perms.canApprove]);

  useEffect(() => {
    if (perms.loading) return;
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, perms.loading]);

  const groupedHeadRows = useMemo(() => {
    const groups = new Map<string, HeadApprovalRow[]>();
    for (const row of headRows) {
      const list = groups.get(row.verifierRole) ?? [];
      list.push(row);
      groups.set(row.verifierRole, list);
    }
    return MARKETING_TEAM_ROLE_KEYS.filter((role) => groups.has(role)).map((role) => ({
      role,
      label: VERIFIER_ROLE_LABELS[role] ?? formatMarketingStatus(role),
      href: teamRoleHref(role),
      rows: groups.get(role) ?? [],
    }));
  }, [headRows]);

  const openReview = (item: MarketingContentItem) => {
    setReviewItem(item);
    setReviewOpen(true);
  };

  return (
    <div className={marketingPage}>
      <MarketingPageHeader
        title="Approvals"
        description="Review submissions from your team and approve or send feedback."
        actions={
          <div className="flex gap-2">
            <Link
              href="/marketing/pipeline"
              className="inline-flex h-7 items-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              Full pipeline
            </Link>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!perms.canApproveMedia && !perms.canApprove && !perms.loading ? (
        <p className="rounded-lg border border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
          Your role does not include approval permissions. Use{" "}
          <Link href="/marketing/pipeline" className="text-primary hover:underline">
            My pipeline
          </Link>{" "}
          to see your assigned work queues.
        </p>
      ) : null}

      {perms.canApprove ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {pendingCount > 0
              ? `${pendingCount} submission${pendingCount === 1 ? "" : "s"} from your team waiting for review.`
              : "No pending submissions from creators, campaign handler, LinkedIn handler, or video editor."}
          </p>
          {groupedHeadRows.map((group) => (
            <HeadApprovalTable
              key={group.role}
              title={group.label}
              rows={group.rows}
              queueHref={group.href}
            />
          ))}
          {groupedHeadRows.length === 0 && !loading ? (
            <div className="rounded-xl border border-border/80 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              When team members submit LinkedIn posts or other content for verification, they appear here grouped by role.
            </div>
          ) : null}
        </div>
      ) : null}

      {perms.canApproveMedia ? (
        <ApprovalTable title="Media / banner review" items={mediaQueue} onReview={openReview} />
      ) : null}

      {perms.canApproveMedia ? (
        <MarketingContentReviewDialog
          item={reviewItem}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          onDone={(updated) => {
            void load();
            if (updated) setReviewItem(updated);
          }}
        />
      ) : null}
    </div>
  );
}
