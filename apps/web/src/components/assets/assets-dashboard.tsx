"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Package,
  RefreshCw,
  Scale,
  Trash2,
  Wrench,
} from "lucide-react";

import { AssetsPipelineFunnel } from "@/components/assets/assets-pipeline-funnel";
import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  assetsQuickLinks,
  assetsWorkspaceGroups,
  resolveAssetsGroupResources,
} from "@/config/assets";
import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  countByStatus,
  countOpenDocs,
  formatInr,
  loadAssetsOverview,
  sumField,
  type AssetsOverview,
  type AssetsRow,
} from "@/services/assets-service";

function recentAssets(rows: AssetsRow[], limit = 6): AssetsRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.asset_code ?? b.document_number ?? "").localeCompare(
        String(a.asset_code ?? a.document_number ?? ""),
      ),
    )
    .slice(0, limit);
}

export function AssetsDashboard() {
  const [data, setData] = useState<AssetsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadAssetsOverview());
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
        activeAssets: 0,
        openMaintenance: 0,
        pendingDepreciation: 0,
        openDisposals: 0,
        bookValue: 0,
        depAmount: 0,
      };
    }
    return {
      activeAssets: countByStatus(data.assets, ["active", "approved", "in_maintenance"]),
      openMaintenance: countOpenDocs(data.maintenances, ["completed", "cancelled"]),
      pendingDepreciation: countByStatus(data.depreciations, [
        "draft",
        "calculated",
        "failed",
      ]),
      openDisposals: countOpenDocs(data.disposals, ["posted", "cancelled"]),
      bookValue: sumField(data.assets, "current_book_value"),
      depAmount: sumField(data.depreciations, "depreciation_amount"),
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      "asset-categories": data?.categories.length ?? 0,
      assets: data?.assets.length ?? 0,
      "asset-assignments": data?.assignments.length ?? 0,
      "asset-maintenances": data?.maintenances.length ?? 0,
      "asset-depreciations": data?.depreciations.length ?? 0,
      "asset-disposals": data?.disposals.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(() => recentAssets(data?.assets ?? []), [data]);

  const maintenanceWatch = useMemo(() => {
    const rows = data?.maintenances ?? [];
    return [...rows]
      .sort((a, b) =>
        String(b.document_number ?? "").localeCompare(String(a.document_number ?? "")),
      )
      .slice(0, 5);
  }, [data]);

  const assetStatusMix = useMemo(() => {
    const rows = data?.assets ?? [];
    const stages = [
      { key: "draft", label: "Draft", barClass: "bg-slate-400" },
      { key: "submitted", label: "Submitted", barClass: "bg-sky-600" },
      { key: "approved", label: "Approved", barClass: "bg-teal-600" },
      { key: "active", label: "Active", barClass: "bg-emerald-600" },
      { key: "in_maintenance", label: "In maintenance", barClass: "bg-amber-500" },
      { key: "disposed", label: "Disposed", barClass: "bg-slate-600" },
    ] as const;
    const total = rows.length || 1;
    return stages.map((s) => {
      const count = countByStatus(rows, [s.key]);
      return { ...s, count, pct: Math.round((count / total) * 100) };
    });
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assets"
        description="Fixed-asset lifecycle — register, custody, warranty, maintenance, depreciation, disposal, and audits."
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
              href="/assets/assets"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <Package className="size-3.5" />
              Assets
            </Link>
            <Link
              href="/assets/asset-maintenances"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Maintenance
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live asset data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some asset endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Active assets"
          value={loading ? "—" : String(kpis.activeAssets)}
          hint={`${formatInr(kpis.bookValue)} book · ${data?.assets.length ?? 0} register`}
          icon={Package}
          tone={kpis.activeAssets > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Open maintenance"
          value={loading ? "—" : String(kpis.openMaintenance)}
          hint={`${countByStatus(data?.maintenances ?? [], ["scheduled", "in_progress"])} in flight · ${data?.maintenances.length ?? 0} jobs`}
          icon={Wrench}
          tone={kpis.openMaintenance > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Pending depreciation"
          value={loading ? "—" : String(kpis.pendingDepreciation)}
          hint={`${formatInr(kpis.depAmount)} amount · ${data?.depreciations.length ?? 0} runs`}
          icon={Scale}
          tone={kpis.pendingDepreciation > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Open disposals"
          value={loading ? "—" : String(kpis.openDisposals)}
          hint={`${countByStatus(data?.assets ?? [], ["disposed", "written_off"])} disposed assets · ${data?.disposals.length ?? 0} docs`}
          icon={Trash2}
          tone={kpis.openDisposals > 0 ? "danger" : "success"}
        />
      </div>

      <AssetsPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {assetsQuickLinks.map((link) => {
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
          <Badge variant="secondary">{assetsWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {assetsWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveAssetsGroupResources(group);
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
                        href={`/assets/${resource.key}`}
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
              <h2 className="text-sm font-medium tracking-tight">Recent assets</h2>
              <p className="text-[11px] text-muted-foreground">Operational register</p>
            </div>
            <Link
              href="/assets/assets"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Asset</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Book value</th>
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
                      No assets yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-[200px] truncate px-4 py-2.5">
                        <p className="font-medium text-foreground">
                          {String(row.asset_name ?? "—")}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {String(row.asset_code ?? row.document_number ?? "")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">
                        {String(row.asset_type ?? "—").replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-foreground">
                        {formatInr(asNumber(row.current_book_value))}
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
              <h2 className="text-sm font-medium tracking-tight">Maintenance watch</h2>
              <p className="text-[11px] text-muted-foreground">Recent jobs</p>
            </div>
            <Link
              href="/assets/asset-maintenances"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : maintenanceWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No maintenance jobs yet.
              </li>
            ) : (
              maintenanceWatch.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {String(row.document_number ?? "—")}
                    </p>
                    <FinanceStatusBadge
                      status={asStatus(row.status) || String(row.status ?? "")}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {String(row.maintenance_type ?? "job").replaceAll("_", " ")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">Asset status mix</h2>
            <p className="text-[11px] text-muted-foreground">Register lifecycle</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {assetStatusMix.map((s) => (
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
                Active warranties {countByStatus(data?.warranties ?? [], ["active"])} · Audits
                open{" "}
                {countOpenDocs(data?.audits ?? [], ["completed", "cancelled"])} · Transfers{" "}
                {countByStatus(data?.transfers ?? [], ["completed"])}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
