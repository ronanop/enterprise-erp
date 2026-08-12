"use client";

import { useCallback, useEffect, useState } from "react";

import { MarketingContentReviewDialog } from "@/components/marketing/marketing-content-review-dialog";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import { VERIFIER_ROLE_LABELS, WORKFLOW_STAGE_LABELS } from "@/lib/marketing-verification";
import {
  getContentWorkflow,
  getHeadVerificationDashboard,
  getMarketingPipeline,
  type MarketingContentItem,
  type MarketingContentWorkflow,
  type MarketingHeadVerificationDashboard,
} from "@/services/marketing-service";

export function MarketingWorkflowPage() {
  const perms = useMarketingPermissions();
  const [items, setItems] = useState<MarketingContentItem[]>([]);
  const [headDash, setHeadDash] = useState<MarketingHeadVerificationDashboard | null>(null);
  const [workflows, setWorkflows] = useState<Record<string, MarketingContentWorkflow>>({});
  const [selected, setSelected] = useState<MarketingContentItem | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const pipeline = await getMarketingPipeline();
      const seenIds = new Set<string>();
      const inWorkflow = pipeline.stages
        .flatMap((s) => s.items)
        .filter((i) => i.workflow_stage && i.workflow_stage !== "published" && i.workflow_stage !== "draft")
        .filter((i) => {
          if (seenIds.has(i.id)) return false;
          seenIds.add(i.id);
          return true;
        });
      setItems(inWorkflow);

      const wfEntries = await Promise.all(
        inWorkflow.slice(0, 20).map(async (item) => {
          try {
            const wf = await getContentWorkflow(item.id);
            return [item.id, wf] as const;
          } catch {
            return null;
          }
        }),
      );
      const map: Record<string, MarketingContentWorkflow> = {};
      wfEntries.forEach((entry) => {
        if (entry) map[entry[0]] = entry[1];
      });
      setWorkflows(map);

      if (perms.canApprove) {
        const dash = await getHeadVerificationDashboard();
        setHeadDash(dash);
      }
    } finally {
      setLoading(false);
    }
  }, [perms.canApprove]);

  useEffect(() => {
    if (!perms.loading) void refresh();
  }, [perms.loading, refresh]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Workflow Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Each team member submits items to marketing head separately. Head sees who requested approval.
        </p>
      </div>

      {perms.canApprove && headDash ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs uppercase text-muted-foreground">In pipeline</p>
            <p className="text-2xl font-semibold">{headDash.summary.total_in_pipeline}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs uppercase text-muted-foreground">Pending your review</p>
            <p className="text-2xl font-semibold">{headDash.summary.pending_head_reviews ?? headDash.summary.awaiting_head}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs uppercase text-muted-foreground">With publisher</p>
            <p className="text-2xl font-semibold">{headDash.summary.awaiting_publisher ?? 0}</p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading workflow…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No content in the verification workflow yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const wf = workflows[item.id];
            return (
              <div key={item.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">{item.content_number}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FinanceStatusBadge status={item.status} />
                    {item.workflow_stage ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {WORKFLOW_STAGE_LABELS[item.workflow_stage] ?? item.workflow_stage}
                      </span>
                    ) : null}
                  </div>
                </div>

                {wf ? (
                  <div className="mt-3 space-y-1">
                    {wf.verifications.map((v) => (
                      <div key={v.id} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {VERIFIER_ROLE_LABELS[v.verifier_role] ?? v.verifier_role}
                        </span>
                        {v.requested_by_name ? ` — ${v.requested_by_name}` : ""}:{" "}
                        <span className="capitalize">{v.overall_status.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelected(item);
                      setOpen(true);
                    }}
                  >
                    Open verification
                  </Button>
                  {wf?.can_publish ? (
                    <span className="text-xs font-medium text-emerald-600">Final approval complete — ready to publish</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MarketingContentReviewDialog
        item={selected}
        open={open}
        onOpenChange={setOpen}
        onDone={(updated) => {
          void refresh();
          if (updated) setSelected(updated);
        }}
      />
    </div>
  );
}
