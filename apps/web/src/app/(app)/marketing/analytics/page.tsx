"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileText,
  Megaphone,
  RefreshCw,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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

export default function MarketingAnalyticsPage() {
  const [data, setData] = useState<MarketingOverview>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadMarketingOverview());
    } catch {
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marketing Analytics"
        description="Content performance and workspace usage."
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <FinanceKpiCard
          label="Campaigns"
          value={loading ? "—" : String(data.campaigns_total)}
          icon={Megaphone}
        />
        <FinanceKpiCard
          label="Active"
          value={loading ? "—" : String(data.campaigns_active)}
          icon={CheckCircle2}
        />
        <FinanceKpiCard
          label="Content requests"
          value={loading ? "—" : String(data.content_requests_total)}
          icon={FileText}
        />
        <FinanceKpiCard
          label="Drafts"
          value={loading ? "—" : String(data.content_drafts)}
          icon={FileText}
        />
        <FinanceKpiCard
          label="Approved"
          value={loading ? "—" : String(data.content_approved)}
          icon={CheckCircle2}
        />
        <FinanceKpiCard
          label="Calendar upcoming"
          value={loading ? "—" : String(data.calendar_upcoming)}
          icon={CalendarDays}
        />
        <FinanceKpiCard
          label="Research reports"
          value={loading ? "—" : String(data.research_reports)}
          icon={BarChart3}
        />
      </div>
    </div>
  );
}
