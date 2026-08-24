"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, CalendarDays, Megaphone, RefreshCw, Sparkles } from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { marketingQuickLinks } from "@/config/marketing";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  loadMarketingOverview,
  type MarketingOverview,
} from "@/services/marketing-service";

const EMPTY: MarketingOverview = {
  campaigns_total: 0,
  campaigns_active: 0,
  content_requests_total: 0,
  content_drafts: 0,
  content_approved: 0,
  calendar_upcoming: 0,
  publish_pending: 0,
  brand_voices: 0,
  competitors: 0,
  research_reports: 0,
};

export function MarketingDashboard() {
  const [data, setData] = useState<MarketingOverview>(EMPTY);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (authenticated) {
        setData(await loadMarketingOverview());
      } else {
        setData(EMPTY);
      }
    } catch {
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marketing & Social Media"
        description="AI content intelligence, campaigns, brand voice, and publishing calendar."
        actions={
          <div className="flex items-center gap-2">
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
            <Link
              href="/marketing/content-requests"
              className={cn(
                buttonVariants({ size: "sm" }),
                "cursor-pointer transition-colors duration-200",
              )}
            >
              <Sparkles className="size-3.5" aria-hidden />
              New content
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Active campaigns"
          value={loading ? "—" : String(data.campaigns_active)}
          hint={`${data.campaigns_total} total`}
          icon={Megaphone}
        />
        <FinanceKpiCard
          label="Content requests"
          value={loading ? "—" : String(data.content_requests_total)}
          hint={`${data.content_drafts} drafts · ${data.content_approved} approved`}
          icon={Sparkles}
        />
        <FinanceKpiCard
          label="Upcoming calendar"
          value={loading ? "—" : String(data.calendar_upcoming)}
          hint={`${data.publish_pending} publish pending`}
          icon={CalendarDays}
        />
        <FinanceKpiCard
          label="Intelligence"
          value={loading ? "—" : String(data.research_reports)}
          hint={`${data.brand_voices} voices · ${data.competitors} competitors`}
          icon={BarChart3}
        />
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Workspace</h2>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            Content Intelligence
          </Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {marketingQuickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex cursor-pointer items-start gap-3 rounded-md border border-border/70 bg-card p-3 transition-colors duration-200 hover:border-primary/40 hover:bg-muted/40"
              >
                <span className="mt-0.5 rounded-md border border-border/60 bg-background p-1.5 text-muted-foreground transition-colors duration-200 group-hover:text-foreground">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                    {link.title}
                    <ArrowUpRight className="size-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {link.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
