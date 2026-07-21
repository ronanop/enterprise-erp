"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardCheck,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { GrcPipelineFunnel } from "@/components/grc/grc-pipeline-funnel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  grcQuickLinks,
  grcWorkspaceGroups,
  resolveGrcGroupResources,
} from "@/config/grc";
import { isAuthenticated } from "@/lib/auth";
import {
  asStatus,
  countByStatus,
  countOpenDocs,
  loadGrcOverview,
  type GrcOverview,
  type GrcRow,
} from "@/services/grc-service";

function recentRisks(rows: GrcRow[], limit = 6): GrcRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.risk_number ?? b.risk_title ?? "").localeCompare(
        String(a.risk_number ?? a.risk_title ?? ""),
      ),
    )
    .slice(0, limit);
}

function riskLevelOf(row: GrcRow): string {
  const raw = row.risk_level ?? row.inherent_risk_level ?? "";
  return typeof raw === "string" ? raw.toLowerCase() : "";
}

export function GrcDashboard() {
  const [data, setData] = useState<GrcOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadGrcOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    if (!data) {
      return {
        openRisks: 0,
        activeControls: 0,
        plannedAudits: 0,
        openCapas: 0,
      };
    }
    return {
      openRisks: countOpenDocs(data.risks, ["closed", "mitigated", "accepted", "cancelled"]),
      activeControls: countByStatus(data.controls, ["active", "approved"]),
      plannedAudits: countByStatus(data.audits, ["planned", "in_progress", "scheduled"]),
      openCapas: countOpenDocs(data.correctiveActions, [
        "closed",
        "completed",
        "cancelled",
      ]),
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      "risk-registers": data?.risks.length ?? 0,
      "risk-assessments": data?.riskAssessments.length ?? 0,
      controls: data?.controls.length ?? 0,
      "compliance-assessments": data?.complianceAssessments.length ?? 0,
      audits: data?.audits.length ?? 0,
      "corrective-actions": data?.correctiveActions.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(() => recentRisks(data?.risks ?? []), [data]);

  const capaWatch = useMemo(() => {
    const rows = data?.correctiveActions ?? [];
    return [...rows]
      .sort((a, b) =>
        String(b.capa_number ?? b.document_number ?? "").localeCompare(
          String(a.capa_number ?? a.document_number ?? ""),
        ),
      )
      .slice(0, 5);
  }, [data]);

  const riskLevelMix = useMemo(() => {
    const rows = data?.risks ?? [];
    const stages = [
      { key: "low", label: "Low", barClass: "bg-slate-400" },
      { key: "medium", label: "Medium", barClass: "bg-sky-600" },
      { key: "high", label: "High", barClass: "bg-amber-500" },
      { key: "critical", label: "Critical", barClass: "bg-red-600" },
    ] as const;
    const total = rows.length || 1;
    return stages.map((s) => {
      const count = rows.filter((row) => riskLevelOf(row) === s.key).length;
      return { ...s, count, pct: Math.round((count / total) * 100) };
    });
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="GRC"
        description="Governance, risk & compliance — policies, controls, risk register, compliance, audits, CAPA, and incidents."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/grc/risk-registers"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <ShieldAlert className="size-3.5" />
              Risks
            </Link>
            <Link
              href="/grc/audits"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Audits
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live GRC data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some GRC endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Open risks"
          value={loading ? "—" : String(kpis.openRisks)}
          hint={`${data?.risks.length ?? 0} risks · ${data?.riskCategories.length ?? 0} categories`}
          icon={ShieldAlert}
          tone={kpis.openRisks > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Active controls"
          value={loading ? "—" : String(kpis.activeControls)}
          hint={`${data?.controls.length ?? 0} controls · ${data?.controlTests.length ?? 0} tests`}
          icon={ShieldCheck}
          tone={kpis.activeControls > 0 ? "success" : "default"}
        />
        <FinanceKpiCard
          label="Planned audits"
          value={loading ? "—" : String(kpis.plannedAudits)}
          hint={`${data?.audits.length ?? 0} audits · ${data?.auditPlans.length ?? 0} plans`}
          icon={ClipboardCheck}
          tone={kpis.plannedAudits > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Open CAPAs"
          value={loading ? "—" : String(kpis.openCapas)}
          hint={`${data?.correctiveActions.length ?? 0} CAPA · ${data?.incidents.length ?? 0} incidents`}
          icon={TriangleAlert}
          tone={kpis.openCapas > 0 ? "danger" : "success"}
        />
      </div>

      <GrcPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {grcQuickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-card px-3.5 py-3 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-md"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium tracking-tight">
                  {link.title}
                  <ArrowUpRight className="size-3 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {link.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-tight">Workspace</h2>
          <Badge variant="secondary">{grcWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {grcWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveGrcGroupResources(group);
            return (
              <div
                key={group.key}
                className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium tracking-tight">{group.title}</h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {resources.map((resource) => (
                    <li key={resource.key}>
                      <Link
                        href={`/grc/${resource.key}`}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-200 hover:bg-accent/50"
                      >
                        <span className="font-medium text-foreground">{resource.title}</span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {resource.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Recent risks</h2>
              <p className="text-[11px] text-muted-foreground">Risk register</p>
            </div>
            <Link
              href="/grc/risk-registers"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Risk</th>
                  <th className="px-4 py-2.5 font-medium">Level</th>
                  <th className="px-4 py-2.5 font-medium">Owner</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No risks yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-[220px] truncate px-4 py-2.5">
                        <p className="font-medium text-foreground">
                          {String(row.risk_title ?? row.risk_number ?? "—")}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {String(row.risk_number ?? "")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">
                        {String(row.risk_level ?? "—").replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {String(row.owner_employee_id ?? "—").slice(0, 8)}
                      </td>
                      <td className="px-4 py-2.5">
                        <FinanceStatusBadge
                          status={asStatus(row.status) || String(row.status ?? "")}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">CAPA watch</h2>
              <p className="text-[11px] text-muted-foreground">Corrective actions</p>
            </div>
            <Link
              href="/grc/corrective-actions"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : capaWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No corrective actions yet.
              </li>
            ) : (
              capaWatch.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {String(row.capa_number ?? row.document_number ?? "—")}
                    </p>
                    <FinanceStatusBadge
                      status={asStatus(row.status) || String(row.status ?? "")}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {String(row.title ?? "CAPA").replaceAll("_", " ")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">Risk level mix</h2>
            <p className="text-[11px] text-muted-foreground">Inherent severity</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {riskLevelMix.map((s) => (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{s.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {s.count} · {s.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${s.barClass}`}
                      style={{ width: `${Math.max(4, s.pct)}%` }}
                      role="presentation"
                    />
                  </div>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">
                Policies {data?.policies.length ?? 0} · Frameworks{" "}
                {data?.frameworks.length ?? 0} · Findings {data?.findings.length ?? 0}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
