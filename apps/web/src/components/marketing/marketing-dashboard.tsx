"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  GitBranch,
  Globe,
  Megaphone,
  Newspaper,
  Radio,
  RefreshCw,
} from "lucide-react";

import { MarketingPipelineFunnel } from "@/components/marketing/marketing-pipeline-funnel";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  ApiClientError,
  getDashboardStats,
  getMarketingPipeline,
  type MarketingDashboardStats,
} from "@/services/marketing-service";

const POLL_MS = 15_000;

const STAT_CARDS = [
  { key: "active_campaigns" as const, label: "Active campaigns", href: "/marketing/campaigns", icon: Megaphone },
  { key: "draft_content" as const, label: "Draft content", href: "/marketing/content?status=draft", icon: Newspaper },
  { key: "in_review_content" as const, label: "In review", href: "/marketing/pipeline", icon: CheckCircle2 },
  { key: "scheduled_content" as const, label: "Scheduled", href: "/marketing/calendar", icon: CalendarDays },
  { key: "published_this_month" as const, label: "Published this month", href: "/marketing/publish-log", icon: Globe },
  { key: "active_channels" as const, label: "Active channels", href: "/marketing/channels", icon: Radio },
];

export function MarketingDashboard() {
  const perms = useMarketingPermissions();
  const [stats, setStats] = useState<MarketingDashboardStats | null>(null);
  const [funnelCounts, setFunnelCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setError(null);
    try {
      const [dash, pipeline] = await Promise.all([getDashboardStats(), getMarketingPipeline()]);
      setStats(dash);
      const counts: Record<string, number> = {};
      for (const stage of pipeline.funnel) counts[stage.key] = stage.count;
      setFunnelCounts(counts);
    } catch (err) {
      setStats(null);
      setFunnelCounts({});
      setError(err instanceof ApiClientError ? err.message : "Failed to load dashboard");
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

  const pendingApprovals = useMemo(() => stats?.pending_approvals ?? 0, [stats]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketing"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/marketing/pipeline"
              className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              <GitBranch className="size-3.5" />
              My pipeline
            </Link>
            {perms.canCreate ? (
              <Link
                href="/marketing/content"
                className="inline-flex h-7 items-center rounded-[min(var(--radius-md),12px)] bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground hover:bg-primary/80"
              >
                New content
              </Link>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <MarketingPipelineFunnel counts={funnelCounts} loading={loading} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STAT_CARDS.filter(({ key }) => perms.canShowStat(key)).map(({ key, label, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className="rounded-xl border border-border/80 bg-card p-4 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{stats?.[key] ?? "—"}</p>
                {key === "in_review_content" && pendingApprovals > 0 ? (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{pendingApprovals} pending approval</p>
                ) : null}
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Icon className="size-4" aria-hidden />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
