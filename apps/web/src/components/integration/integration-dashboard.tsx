"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Cable,
  RefreshCw,
  Server,
  Webhook,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { IntegrationPipelineFunnel } from "@/components/integration/integration-pipeline-funnel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  integrationQuickLinks,
  integrationWorkspaceGroups,
  resolveIntegrationGroupResources,
} from "@/config/integration";
import { isAuthenticated } from "@/lib/auth";
import {
  asStatus,
  countByStatus,
  loadIntegrationOverview,
  type IntegrationOverview,
  type IntegrationRow,
} from "@/services/integration-service";

function recentSystems(rows: IntegrationRow[], limit = 6): IntegrationRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.system_number ?? b.system_name ?? "").localeCompare(
        String(a.system_number ?? a.system_name ?? ""),
      ),
    )
    .slice(0, limit);
}

function systemTypeOf(row: IntegrationRow): string {
  const raw = row.system_type ?? "";
  return typeof raw === "string" ? raw.toLowerCase() : "";
}

export function IntegrationDashboard() {
  const [data, setData] = useState<IntegrationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadIntegrationOverview());
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
        activeSystems: 0,
        activeConnectors: 0,
        activeWebhooks: 0,
        syncJobs: 0,
      };
    }
    return {
      activeSystems: countByStatus(data.systems, ["active", "approved"]),
      activeConnectors: countByStatus(data.connectors, ["active", "approved"]),
      activeWebhooks: countByStatus(data.webhooks, ["active", "approved"]),
      syncJobs: data.syncJobs.length,
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      "external-systems": data?.systems.length ?? 0,
      connectors: data?.connectors.length ?? 0,
      webhooks: data?.webhooks.length ?? 0,
      "event-definitions": data?.events.length ?? 0,
      "message-queues": data?.queues.length ?? 0,
      "sync-jobs": data?.syncJobs.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(() => recentSystems(data?.systems ?? []), [data]);

  const syncWatch = useMemo(() => {
    const rows = data?.syncJobs ?? [];
    return [...rows]
      .sort((a, b) =>
        String(b.sync_number ?? b.started_at ?? "").localeCompare(
          String(a.sync_number ?? a.started_at ?? ""),
        ),
      )
      .slice(0, 5);
  }, [data]);

  const systemTypeMix = useMemo(() => {
    const rows = data?.systems ?? [];
    const stages = [
      { key: "bank", label: "Bank", barClass: "bg-slate-500" },
      { key: "payment", label: "Payment", barClass: "bg-sky-600" },
      { key: "tax", label: "Tax", barClass: "bg-teal-600" },
      { key: "ecommerce", label: "E-commerce", barClass: "bg-amber-500" },
      { key: "other", label: "Other", barClass: "bg-slate-400" },
    ] as const;
    const total = rows.length || 1;
    const known = new Set(["bank", "payment", "tax", "ecommerce"]);
    return stages.map((s) => {
      const count =
        s.key === "other"
          ? rows.filter((row) => !known.has(systemTypeOf(row))).length
          : rows.filter((row) => systemTypeOf(row) === s.key).length;
      return { ...s, count, pct: Math.round((count / total) * 100) };
    });
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integration"
        description="Integration hub — external systems, connectors, webhooks, events, queues, sync jobs, and rate limits."
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
              href="/integration/external-systems"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <Server className="size-3.5" />
              Systems
            </Link>
            <Link
              href="/integration/sync-jobs"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Sync Jobs
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live integration data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some integration endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Active systems"
          value={loading ? "—" : String(kpis.activeSystems)}
          hint={`${data?.systems.length ?? 0} systems · ${data?.credentials.length ?? 0} credentials`}
          icon={Server}
          tone={kpis.activeSystems > 0 ? "success" : "default"}
        />
        <FinanceKpiCard
          label="Active connectors"
          value={loading ? "—" : String(kpis.activeConnectors)}
          hint={`${data?.connectors.length ?? 0} connectors · ${data?.oauthClients.length ?? 0} OAuth`}
          icon={Cable}
          tone={kpis.activeConnectors > 0 ? "success" : "default"}
        />
        <FinanceKpiCard
          label="Active webhooks"
          value={loading ? "—" : String(kpis.activeWebhooks)}
          hint={`${data?.webhooks.length ?? 0} webhooks · ${data?.events.length ?? 0} events`}
          icon={Webhook}
          tone={kpis.activeWebhooks > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Sync jobs"
          value={loading ? "—" : String(kpis.syncJobs)}
          hint={`${countByStatus(data?.syncJobs ?? [], ["succeeded"])} succeeded · ${data?.deadLetters.length ?? 0} DLQ`}
          icon={RefreshCw}
          tone={
            data?.deadLetters.length
              ? "danger"
              : kpis.syncJobs > 0
                ? "default"
                : "success"
          }
        />
      </div>

      <IntegrationPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {integrationQuickLinks.map((link) => {
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
          <Badge variant="secondary">{integrationWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {integrationWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveIntegrationGroupResources(group);
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
                        href={`/integration/${resource.key}`}
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
              <h2 className="text-sm font-medium tracking-tight">External systems</h2>
              <p className="text-[11px] text-muted-foreground">Connected endpoints</p>
            </div>
            <Link
              href="/integration/external-systems"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">System</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Code</th>
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
                      No external systems yet.
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
                          {String(row.system_name ?? row.system_number ?? "—")}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {String(row.system_number ?? "")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">
                        {String(row.system_type ?? "—").replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {String(row.system_code ?? "—")}
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
              <h2 className="text-sm font-medium tracking-tight">Sync watch</h2>
              <p className="text-[11px] text-muted-foreground">Recent sync jobs</p>
            </div>
            <Link
              href="/integration/sync-jobs"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : syncWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No sync jobs yet.
              </li>
            ) : (
              syncWatch.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {String(row.sync_number ?? "—")}
                    </p>
                    <FinanceStatusBadge
                      status={asStatus(row.status) || String(row.status ?? "")}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {String(row.sync_mode ?? "sync").replaceAll("_", " ")} ·{" "}
                    {String(row.direction ?? "—")} · {String(row.rows_processed ?? 0)} rows
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">System type mix</h2>
            <p className="text-[11px] text-muted-foreground">FRD-21 §5 integrations</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {systemTypeMix.map((s) => (
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
                Queues {data?.queues.length ?? 0} · Mappings {data?.mappings.length ?? 0} ·
                Rate limits {data?.rateLimits.length ?? 0}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
