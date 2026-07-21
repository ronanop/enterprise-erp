"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  FileSpreadsheet,
  Landmark,
  PieChart,
  Receipt,
  RefreshCw,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import { formatInrPrecise } from "@/services/finance-service";
import {
  getReportCatalog,
  getTrialBalanceReport,
  type ReportCatalogItem,
} from "@/services/report-service";

const CATEGORY_LABELS: Record<string, string> = {
  statements: "Financial Statements",
  ledger: "Ledger Reports",
  subledger: "Subledger Reports",
  compliance: "Compliance",
  analytics: "Analytics",
};

const CATEGORY_ICONS: Record<string, typeof FileSpreadsheet> = {
  statements: Scale,
  ledger: BookOpen,
  subledger: Receipt,
  compliance: Landmark,
  analytics: BarChart3,
};

const REPORT_ICONS: Record<string, typeof FileSpreadsheet> = {
  "trial-balance": Scale,
  "balance-sheet": Landmark,
  "profit-loss": TrendingUp,
  "cash-flow": Wallet,
  "general-ledger": BookOpen,
  "journal-register": FileSpreadsheet,
  "ar-aging": Receipt,
  "ap-aging": Receipt,
  "tax-summary": PieChart,
  "cost-center": BarChart3,
};

export function ReportsHubPage() {
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tbDifference, setTbDifference] = useState<number | null>(null);
  const [tbAccounts, setTbAccounts] = useState<number | null>(null);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError("Sign in to view financial reports.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [items, tb] = await Promise.all([
        getReportCatalog(),
        getTrialBalanceReport({ full: true }).catch(() => null),
      ]);
      setCatalog(items);
      if (tb) {
        setTbDifference(tb.difference);
        setTbAccounts(tb.lines.length);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load report catalog");
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, ReportCatalogItem[]>();
    for (const item of catalog) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [catalog]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Financial Reports"
        description="Enterprise statements, ledger registers, aging analysis, and compliance summaries from posted data."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer gap-1.5"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Link
              href="/finance"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border px-2.5 text-sm transition-colors duration-200 hover:bg-muted"
            >
              Finance Home
            </Link>
          </div>
        }
      />

      {error ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" className="h-8 cursor-pointer" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceKpiCard label="Available Reports" value={String(catalog.length || "—")} icon={FileSpreadsheet} />
        <FinanceKpiCard
          label="Trial Balance Accounts"
          value={tbAccounts != null ? String(tbAccounts) : "—"}
          icon={Scale}
        />
        <FinanceKpiCard
          label="TB Difference"
          value={tbDifference != null ? formatInrPrecise(tbDifference) : "—"}
          icon={Scale}
          tone={tbDifference != null && Math.abs(tbDifference) > 0.01 ? "warning" : "success"}
          hint="Should be zero when balanced"
        />
        <FinanceKpiCard label="Report Categories" value={String(grouped.size || "—")} icon={BarChart3} />
      </div>

      {loading && catalog.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-border/80 bg-muted/40" />
          ))}
        </div>
      ) : null}

      {!loading || catalog.length > 0
        ? Array.from(grouped.entries()).map(([category, items]) => {
            const CatIcon = CATEGORY_ICONS[category] ?? FileSpreadsheet;
            return (
              <section key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <CatIcon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium tracking-tight">
                    {CATEGORY_LABELS[category] ?? category}
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((item) => {
                    const Icon = REPORT_ICONS[item.key] ?? FileSpreadsheet;
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        className={cn(
                          "group cursor-pointer rounded-xl border border-border/80 bg-card p-4 shadow-sm",
                          "transition-[box-shadow,border-color] duration-200 hover:border-border hover:shadow-md",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                            <Icon className="size-4" />
                          </span>
                        </div>
                        <h3 className="mt-3 text-sm font-medium tracking-tight group-hover:text-primary">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })
        : null}
    </div>
  );
}
