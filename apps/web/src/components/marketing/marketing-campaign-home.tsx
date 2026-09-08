"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatApiError } from "@/services/api-client";
import {
  approveGeneratedContent,
  createWeekSlots,
  loadCampaignHome,
  reviseGeneratedContent,
  submitGeneratedContent,
  type CampaignHome,
} from "@/services/marketing-service";

function linesFor(row: CampaignHome["content"][number]): string[] {
  const fromPipeline = row.pipeline_result?.lines_to_change;
  if (Array.isArray(fromPipeline) && fromPipeline.length) return fromPipeline;
  const raw = row.scores?.lines_to_change;
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

export function MarketingCampaignHome({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<CampaignHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadCampaignHome(campaignId));
    } catch (err) {
      setError(formatApiError(err, "Could not load this campaign"));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, kind: "submit" | "approve" | "revise" | "week") {
    setBusyId(id);
    setError(null);
    try {
      if (kind === "submit") await submitGeneratedContent(id);
      if (kind === "approve") await approveGeneratedContent(id);
      if (kind === "week") {
        const start = new Date();
        start.setDate(start.getDate() + 1);
        start.setHours(10, 0, 0, 0);
        await createWeekSlots({
          content_id: id,
          start_at: start.toISOString(),
          campaign_id: campaignId,
        });
      }
      if (kind === "revise") {
        if (!note.trim()) {
          setError("Write the revision on the caption first.");
          return;
        }
        await reviseGeneratedContent(id, note.trim());
        setNote("");
      }
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not update the caption"));
    } finally {
      setBusyId(null);
    }
  }

  const campaign = data?.campaign;
  const metrics = campaign?.success_metrics;

  return (
    <div className="space-y-4">
      <PageHeader
        title={campaign?.campaign_name ?? "Campaign"}
        description="Brief, work in flight, approvals, calendar, and assets for this campaign only."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => void load()}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </Button>
        }
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Loading campaign
        </p>
      ) : null}

      {campaign ? (
        <section className="grid gap-3 rounded-md border border-border/70 bg-card p-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Brief</p>
            <p className="mt-1 text-sm text-foreground">{campaign.objective || "No objective yet."}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Dates</p>
            <p className="mt-1 text-sm text-foreground">
              {campaign.start_date ?? "Open"} — {campaign.end_date ?? "Open"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Budget</p>
            <p className="mt-1 text-sm text-foreground">
              {campaign.budget_amount ?? "—"} {campaign.currency_code ?? ""}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Target</p>
            <p className="mt-1 text-sm text-foreground">
              {metrics ? JSON.stringify(metrics) : "No success metric set."}
            </p>
          </div>
        </section>
      ) : null}

      {data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FinanceKpiCard label="In flight" value={String(data.health.content_in_flight ?? 0)} />
          <FinanceKpiCard label="Approved" value={String(data.health.content_approved ?? 0)} />
          <FinanceKpiCard label="Open tasks" value={String(data.health.open_tasks ?? 0)} />
          <FinanceKpiCard label="Inbox" value={String(data.health.inbox_open ?? 0)} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        <Link className="cursor-pointer text-primary underline-offset-2 hover:underline" href={`/marketing/calendar?campaign=${campaignId}`}>
          Calendar
        </Link>
        <Link className="cursor-pointer text-primary underline-offset-2 hover:underline" href={`/marketing/tasks?campaign=${campaignId}`}>
          Tasks
        </Link>
        <Link className="cursor-pointer text-primary underline-offset-2 hover:underline" href={`/marketing/content-requests?campaign=${campaignId}`}>
          Requests
        </Link>
        <Link className="cursor-pointer text-primary underline-offset-2 hover:underline" href={`/marketing/m365?campaign=${campaignId}`}>
          SharePoint assets
        </Link>
        <Link className="cursor-pointer text-primary underline-offset-2 hover:underline" href={`/marketing/inbox?campaign=${campaignId}`}>
          Inbox
        </Link>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Captions</h2>
        <label className="block text-xs text-muted-foreground" htmlFor="revision-note">
          Revision note (written on the caption, not a side form)
        </label>
        <textarea
          id="revision-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-16 w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors duration-200"
        />
        {(data?.content ?? []).map((row) => (
          <article key={row.id} className="rounded-md border border-border/70 bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{row.headline || "Untitled"}</p>
              <Badge variant="outline" className="text-[10px] uppercase">
                {row.pipeline_result?.variant || "draft"}
              </Badge>
              <FinanceStatusBadge status={row.status} />
            </div>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{row.body}</p>
            {linesFor(row).length ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {linesFor(row).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {row.status === "draft" || row.status === "rejected" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={busyId === row.id}
                  onClick={() => void act(row.id, "submit")}
                >
                  Send for review
                </Button>
              ) : null}
              {row.status === "in_review" ? (
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={busyId === row.id}
                  onClick={() => void act(row.id, "approve")}
                >
                  Approve caption
                </Button>
              ) : null}
              {row.status === "approved" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={busyId === row.id}
                  onClick={() => void act(row.id, "week")}
                >
                  Fill a week
                </Button>
              ) : null}
              {row.status === "in_review" || row.status === "approved" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={busyId === row.id}
                  onClick={() => void act(row.id, "revise")}
                >
                  Request revision
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-border/70 bg-card p-3">
          <h2 className="mb-2 text-sm font-semibold">Calendar</h2>
          {(data?.calendar ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No slots. Approve a caption first.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {data?.calendar.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2">
                  <span>{row.title}</span>
                  <span className="text-muted-foreground">{row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-md border border-border/70 bg-card p-3">
          <h2 className="mb-2 text-sm font-semibold">Tasks</h2>
          {(data?.tasks ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No tasks on this campaign.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {data?.tasks.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2">
                  <span>{row.title}</span>
                  <span className="text-muted-foreground">{row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-md border border-border/70 bg-card p-3">
          <h2 className="mb-2 text-sm font-semibold">SharePoint / OneDrive</h2>
          {(data?.assets ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No assets linked to this campaign.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {data?.assets.map((row) => (
                <li key={row.id}>
                  {row.web_url ? (
                    <a className="cursor-pointer text-primary underline-offset-2 hover:underline" href={row.web_url}>
                      {row.file_name}
                    </a>
                  ) : (
                    row.file_name
                  )}
                  <span className="text-muted-foreground"> · {row.folder_path}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-md border border-border/70 bg-card p-3">
          <h2 className="mb-2 text-sm font-semibold">Open approvals</h2>
          {(data?.approvals ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No approval history yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {data?.approvals.map((row) => (
                <li key={row.id}>
                  <span className="font-medium">{row.action}</span>
                  {row.comment ? ` — ${row.comment}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
