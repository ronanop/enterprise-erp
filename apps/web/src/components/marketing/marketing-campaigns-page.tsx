"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { MarketingCampaignReviewDialog } from "@/components/marketing/marketing-campaign-review-dialog";
import { MarketingPageHeader } from "@/components/marketing/marketing-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  marketingActionBanner,
  marketingPage,
  marketingTableHead,
  marketingTableRow,
  marketingTableShell,
} from "@/lib/marketing-ui";
import {
  ApiClientError,
  createCampaign,
  formatMarketingStatus,
  listCampaigns,
  submitCampaign,
  type MarketingCampaign,
} from "@/services/marketing-service";

export function MarketingCampaignsPage() {
  const perms = useMarketingPermissions();
  const [rows, setRows] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState("");
  const [audience, setAudience] = useState("");
  const [reviewCampaign, setReviewCampaign] = useState<MarketingCampaign | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCampaigns({ q: q || undefined, page_size: 200 }));
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreateAndSubmit = async () => {
    if (!name.trim()) return;
    if (!description.trim() && !goals.trim()) {
      setError("Write about the campaign (description or goals) before submitting.");
      return;
    }
    try {
      const created = await createCampaign({
        name: name.trim(),
        campaign_type: "mixed",
        description: description.trim() || null,
        goals: goals.trim() || null,
        target_audience_summary: audience.trim() || null,
      });
      await submitCampaign(created.id);
      setName("");
      setDescription("");
      setGoals("");
      setAudience("");
      setShowForm(false);
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create campaign");
    }
  };

  const onSaveDraft = async () => {
    if (!name.trim()) return;
    try {
      await createCampaign({
        name: name.trim(),
        campaign_type: "mixed",
        description: description.trim() || null,
        goals: goals.trim() || null,
        target_audience_summary: audience.trim() || null,
      });
      setName("");
      setDescription("");
      setGoals("");
      setAudience("");
      setShowForm(false);
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save draft");
    }
  };

  const openReview = (row: MarketingCampaign) => {
    setReviewCampaign(row);
    setReviewOpen(true);
  };

  if (!perms.canAccessCampaigns && !perms.loading) {
    return (
      <div className={marketingPage}>
        <MarketingPageHeader title="Campaigns" />
        <p className="text-sm text-muted-foreground">Campaign planning is for the campaign handler and marketing head.</p>
      </div>
    );
  }

  return (
    <div className={marketingPage}>
      <MarketingPageHeader
        title="Campaigns"
        description="Plan campaigns, submit for head approval, and track status in one place."
        actions={
          perms.canCampaignCreate ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button type="button" size="sm" onClick={() => setShowForm((v) => !v)}>
                <Plus className="size-3.5" />
                New campaign
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )
        }
      />

      {showForm ? (
        <div className={marketingActionBanner}>
          <p className="text-sm font-medium">New campaign — write about it, then submit for head approval</p>
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Campaign name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q1 LinkedIn push" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Write about this campaign *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What is this campaign about? Channels, timeline, key message…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Goals</label>
              <textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                rows={2}
                placeholder="e.g. 200 sign-ups, brand awareness…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Target audience</label>
              <Input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. B2B buyers in manufacturing"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" onClick={() => void onSaveDraft()}>
                Save as draft
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void onCreateAndSubmit()}
                disabled={!name.trim() || (!description.trim() && !goals.trim())}
              >
                Submit for head approval
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search campaigns…"
          className="max-w-xs rounded-xl border-border/60 bg-background/80 shadow-sm"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className={`${marketingTableShell} overflow-x-auto`}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className={marketingTableHead}>
            <tr>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Dates</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows(rows).map((row) => (
              <tr key={row.id} className={marketingTableRow}>
                <td className="px-3 py-2 font-mono text-xs">{row.campaign_number}</td>
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2">{formatMarketingStatus(row.campaign_type)}</td>
                <td className="px-3 py-2">
                  <FinanceStatusBadge status={row.status} />
                  {row.rejection_reason ? (
                    <p className="mt-1 max-w-[200px] truncate text-[10px] text-amber-600" title={row.rejection_reason}>
                      Head feedback
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {row.start_date ?? "—"} → {row.end_date ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openReview(row)}>
                    {row.status === "in_review" && perms.canApprove
                      ? "Review & feedback"
                      : row.status === "draft" || row.status === "changes_required"
                        ? "Edit & submit"
                        : "Open"}
                  </Button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No campaigns yet. Create your first campaign above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <MarketingCampaignReviewDialog
        campaign={reviewCampaign}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onDone={() => void load()}
      />
    </div>
  );
}

function sortedRows(rows: MarketingCampaign[]) {
  return [...rows].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}
