"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  ApiClientError,
  activateCampaign,
  approveCampaign,
  requestCampaignChanges,
  submitCampaign,
  updateCampaign,
  type MarketingCampaign,
  type MarketingPipelineCampaign,
} from "@/services/marketing-service";

type CampaignLike = MarketingCampaign | MarketingPipelineCampaign;

type MarketingCampaignReviewDialogProps = {
  campaign: CampaignLike | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

export function MarketingCampaignReviewDialog({
  campaign,
  open,
  onOpenChange,
  onDone,
}: MarketingCampaignReviewDialogProps) {
  const perms = useMarketingPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState("");
  const [audience, setAudience] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!campaign || !open) return;
    setName(campaign.name);
    setDescription(campaign.description ?? "");
    setGoals(campaign.goals ?? "");
    setAudience(campaign.target_audience_summary ?? "");
    setFeedback("");
    setError(null);
  }, [campaign, open]);

  if (!open || !campaign) return null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const canEdit =
    perms.canCampaignUpdate &&
    (campaign.status === "draft" || campaign.status === "changes_required");

  const isHeadReview = perms.canApprove && campaign.status === "in_review";
  const canSubmit = canEdit && (description.trim() || goals.trim());
  const canActivate = perms.canCampaignActivate && campaign.status === "approved";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close campaign review"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{campaign.name}</h2>
            <p className="font-mono text-xs text-muted-foreground">{campaign.campaign_number}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <FinanceStatusBadge status={campaign.status} />

          {campaign.rejection_reason ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="text-xs font-medium uppercase text-amber-800 dark:text-amber-200">
                Marketing head feedback
              </p>
              <p className="mt-1 whitespace-pre-wrap">{campaign.rejection_reason}</p>
            </div>
          ) : null}

          {canEdit ? (
            <div className="space-y-3 rounded-lg border border-border/80 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Campaign details</p>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Campaign name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Write about this campaign *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="What is this campaign about? Key message, channels, timeline…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Goals</label>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={3}
                  placeholder="e.g. 500 leads, brand awareness in Q1…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Target audience</label>
                <Input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="e.g. B2B decision makers in manufacturing"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                * Add a description or goals, then submit for marketing head approval.
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3 text-sm">
              {campaign.description ? (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">About this campaign</p>
                  <p className="mt-1 whitespace-pre-wrap">{campaign.description}</p>
                </div>
              ) : null}
              {campaign.goals ? (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Goals</p>
                  <p className="mt-1 whitespace-pre-wrap">{campaign.goals}</p>
                </div>
              ) : null}
              {campaign.target_audience_summary ? (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Target audience</p>
                  <p className="mt-1">{campaign.target_audience_summary}</p>
                </div>
              ) : null}
            </div>
          )}

          {isHeadReview ? (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Feedback if changes needed</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="e.g. Add budget breakdown, clarify target region, extend timeline…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {canEdit ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    updateCampaign(campaign.id, {
                      name: name.trim(),
                      description: description.trim() || null,
                      goals: goals.trim() || null,
                      target_audience_summary: audience.trim() || null,
                    }),
                  )
                }
              >
                Save draft
              </Button>
              {canSubmit ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await updateCampaign(campaign.id, {
                        name: name.trim(),
                        description: description.trim() || null,
                        goals: goals.trim() || null,
                        target_audience_summary: audience.trim() || null,
                      });
                      await submitCampaign(campaign.id);
                    })
                  }
                >
                  {campaign.status === "changes_required" ? "Resubmit for head approval" : "Submit for head approval"}
                </Button>
              ) : null}
            </>
          ) : null}

          {isHeadReview ? (
            <>
              <Button type="button" disabled={busy} onClick={() => void run(() => approveCampaign(campaign.id))}>
                Approve campaign
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => requestCampaignChanges(campaign.id, feedback || undefined))}
              >
                Send back with feedback
              </Button>
            </>
          ) : null}

          {canActivate ? (
            <Button type="button" disabled={busy} onClick={() => void run(() => activateCampaign(campaign.id))}>
              Activate campaign
            </Button>
          ) : null}

          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
