"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw, ShieldCheck } from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth";
import { ApiClientError, resourceService } from "@/services/api-client";
import {
  asStatus,
  loadGrcOverviewApi,
  refreshComplianceMonitor,
  type GrcOverviewApi,
  type GrcRow,
} from "@/services/grc-service";

function normalizeRows(data: unknown): GrcRow[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is GrcRow => !!row && typeof row === "object");
  }
  return [];
}

const MIX_LABELS: Record<string, string> = {
  compliant: "Compliant",
  partially_compliant: "Partial",
  non_compliant: "Non-compliant",
  unknown: "Unknown",
};

const MIX_BAR: Record<string, string> = {
  compliant: "bg-emerald-600",
  partially_compliant: "bg-amber-500",
  non_compliant: "bg-red-600",
  unknown: "bg-slate-400",
};

export function GrcCompliancePage() {
  const [overview, setOverview] = useState<GrcOverviewApi | null>(null);
  const [frameworks, setFrameworks] = useState<GrcRow[]>([]);
  const [requirements, setRequirements] = useState<GrcRow[]>([]);
  const [assessments, setAssessments] = useState<GrcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, fw, req, asm] = await Promise.all([
        loadGrcOverviewApi(),
        resourceService.list("/grc/compliance-frameworks"),
        resourceService.list("/grc/compliance-requirements"),
        resourceService.list("/grc/compliance-assessments"),
      ]);
      setOverview(ov);
      setFrameworks(normalizeRows(fw.data));
      setRequirements(normalizeRows(req.data));
      setAssessments(normalizeRows(asm.data));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load compliance data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefreshSignals = async () => {
    setRefreshing(true);
    setMessage(null);
    setError(null);
    try {
      const result = await refreshComplianceMonitor();
      setMessage(
        `Updated ${result.assessments_updated} assessment(s) from automated signals.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Compliance refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const mixRows = useMemo(() => {
    const mix = overview?.compliance_status_mix ?? {};
    const total =
      Object.values(mix).reduce((a: number, b) => a + (typeof b === "number" ? b : 0), 0) || 1;
    return Object.entries(mix).map(([key, count]) => ({
      key,
      label: MIX_LABELS[key] ?? key,
      count: typeof count === "number" ? count : 0,
      pct: Math.round(((typeof count === "number" ? count : 0) / total) * 100),
      barClass: MIX_BAR[key] ?? "bg-slate-400",
    }));
  }, [overview]);

  const recentAssessments = useMemo(
    () =>
      [...assessments]
        .sort((a, b) =>
          String(b.assessment_number ?? "").localeCompare(String(a.assessment_number ?? "")),
        )
        .slice(0, 8),
    [assessments],
  );

  const authBlocked = !isAuthenticated() && !loading && Boolean(error);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Compliance"
        description="Frameworks, obligations, assessments, and automated ERP signals (GST, DPDP audit trail)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${loading ? "animate-spin" : ""}`} />
              Reload
            </Button>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              disabled={refreshing || authBlocked}
              onClick={() => void onRefreshSignals()}
            >
              <ShieldCheck className="mr-1.5 size-3.5" />
              Run signal refresh
            </Button>
            <Link
              href="/grc/compliance-frameworks"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Frameworks
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to manage compliance.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-950">
          {message}
        </div>
      ) : null}
      {error && !authBlocked ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-950">
          {error}
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Frameworks"
          value={loading ? "—" : String(overview?.kpis.total_frameworks ?? frameworks.length)}
          hint="Regulatory & standards catalog"
          icon={ShieldCheck}
          tone="default"
        />
        <FinanceKpiCard
          label="Requirements"
          value={loading ? "—" : String(overview?.kpis.total_requirements ?? requirements.length)}
          hint={`${overview?.automated_signal_codes.length ?? 0} automated signals`}
          icon={ShieldCheck}
          tone="default"
        />
        <FinanceKpiCard
          label="Assessments"
          value={loading ? "—" : String(overview?.kpis.total_assessments ?? assessments.length)}
          hint="Evidence & status evaluations"
          icon={ShieldCheck}
          tone="default"
        />
        <FinanceKpiCard
          label="Non-compliant"
          value={
            loading
              ? "—"
              : String(overview?.compliance_status_mix.non_compliant ?? 0)
          }
          hint="Requires remediation"
          icon={ShieldCheck}
          tone={
            (overview?.compliance_status_mix.non_compliant ?? 0) > 0 ? "danger" : "success"
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <h2 className="text-sm font-medium tracking-tight">Compliance status mix</h2>
          <p className="mb-3 text-[11px] text-muted-foreground">Latest assessment outcomes</p>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {mixRows.map((s) => (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{s.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {s.count} · {s.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${s.barClass}`}
                      style={{ width: `${Math.max(4, s.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {overview?.automated_signal_codes.length ? (
            <p className="mt-4 text-[11px] text-muted-foreground">
              Automated: {overview.automated_signal_codes.join(", ")}
            </p>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Active frameworks</h2>
              <p className="text-[11px] text-muted-foreground">India pack & custom</p>
            </div>
            <Badge variant="secondary">{frameworks.length}</Badge>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : frameworks.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No frameworks. Run{" "}
                <code className="text-xs">python -m scripts.seed_grc_india_compliance</code> on the API.
              </li>
            ) : (
              frameworks.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {String(row.framework_name ?? row.framework_code ?? "—")}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {String(row.jurisdiction ?? "")} · {String(row.framework_type ?? "")}
                    </p>
                  </div>
                  <FinanceStatusBadge status={asStatus(row.status) || String(row.status ?? "")} />
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
          <div>
            <h2 className="text-sm font-medium tracking-tight">Recent assessments</h2>
            <p className="text-[11px] text-muted-foreground">Manual and signal-driven</p>
          </div>
          <Link
            href="/grc/compliance-assessments"
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
          >
            View all
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5 font-medium">Assessment</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Compliance</th>
                <th className="px-4 py-2.5 font-medium">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : recentAssessments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    No assessments yet. Use Run signal refresh after seeding requirements.
                  </td>
                </tr>
              ) : (
                recentAssessments.map((row, idx) => (
                  <tr
                    key={String(row.id ?? idx)}
                    className="border-b border-border/50 last:border-0 hover:bg-accent/30"
                  >
                    <td className="px-4 py-2.5 font-medium">
                      {String(row.assessment_number ?? "—")}
                    </td>
                    <td className="px-4 py-2.5">
                      <FinanceStatusBadge
                        status={asStatus(row.status) || String(row.status ?? "")}
                      />
                    </td>
                    <td className="px-4 py-2.5 capitalize">
                      {String(row.compliance_status ?? "—").replaceAll("_", " ")}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2.5 text-xs text-muted-foreground">
                      {String(row.evidence_summary ?? "—")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
