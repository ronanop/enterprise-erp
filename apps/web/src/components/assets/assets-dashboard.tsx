"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Package, RefreshCw, UserCheck, Wrench } from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { assetsQuickLinks } from "@/config/assets";
import {
  buildRecentActivity,
  mapAssetToPrdStatus,
  prdStatusLabel,
  type PrdAssetStatus,
} from "@/domain/asset-prd";
import { isAuthenticated } from "@/lib/auth";
import {
  countOpenDocs,
  loadAssetManagementDashboard,
  type AssetManagementDashboard,
} from "@/services/assets-service";

const PRD_STATUSES: PrdAssetStatus[] = [
  "available",
  "assigned",
  "reserved",
  "under_maintenance",
  "lost",
  "disposed",
];

export function AssetsDashboard() {
  const [data, setData] = useState<AssetManagementDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadAssetManagementDashboard());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    const assets = data?.assets ?? [];
    const assignments = data?.assignments ?? [];
    const counts: Record<PrdAssetStatus, number> = {
      available: 0,
      assigned: 0,
      reserved: 0,
      under_maintenance: 0,
      lost: 0,
      disposed: 0,
    };
    for (const a of assets) {
      const prd = mapAssetToPrdStatus(a, assignments);
      counts[prd] += 1;
    }
    return {
      total: assets.length,
      ...counts,
      openMaintenance: countOpenDocs(data?.maintenances ?? [], ["completed", "cancelled"]),
    };
  }, [data]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    const cats = data?.categories ?? [];
    const catName = new Map(cats.map((c) => [String(c.id), String(c.category_name ?? "—")]));
    for (const a of data?.assets ?? []) {
      const label = catName.get(String(a.asset_category_id)) ?? "Uncategorized";
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [data]);

  const byDepartment = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of data?.assets ?? []) {
      const id = String(a.department_id ?? "unassigned");
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return [...map.entries()].slice(0, 6);
  }, [data]);

  const activity = useMemo(
    () =>
      buildRecentActivity(
        data?.assets ?? [],
        data?.assignments ?? [],
        data?.maintenances ?? [],
        8,
      ),
    [data],
  );

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Asset Management — registration, custody, maintenance, and QR tracking."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
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
          Some endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <FinanceKpiCard
          label="Total assets"
          value={loading ? "—" : String(kpis.total)}
          hint="Register count"
          icon={Package}
        />
        <FinanceKpiCard
          label="Available"
          value={loading ? "—" : String(kpis.available)}
          hint="Ready to assign"
          icon={Package}
          tone="success"
        />
        <FinanceKpiCard
          label="Assigned"
          value={loading ? "—" : String(kpis.assigned)}
          hint="Active custody"
          icon={UserCheck}
        />
        <FinanceKpiCard
          label="Under maintenance"
          value={loading ? "—" : String(kpis.under_maintenance)}
          hint={`${kpis.openMaintenance} open jobs`}
          icon={Wrench}
          tone={kpis.openMaintenance > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Reserved"
          value={loading ? "—" : String(kpis.reserved)}
          hint="Draft / submitted"
          icon={Package}
        />
        <FinanceKpiCard
          label="Lost"
          value={loading ? "—" : String(kpis.lost)}
          hint="Mapped from cancelled"
          icon={Package}
          tone={kpis.lost > 0 ? "danger" : "success"}
        />
        <FinanceKpiCard
          label="Disposed"
          value={loading ? "—" : String(kpis.disposed)}
          hint="End of life"
          icon={Package}
        />
      </div>

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
                <span className="block text-[11px] text-muted-foreground">{link.description}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <ChartCard title="Assets by category" loading={loading}>
          {byCategory.map(([label, count]) => (
            <BarRow key={label} label={label} count={count} total={kpis.total || 1} />
          ))}
        </ChartCard>
        <ChartCard title="Assets by status (PRD)" loading={loading}>
          {PRD_STATUSES.map((s) => (
            <BarRow
              key={s}
              label={prdStatusLabel(s)}
              count={kpis[s]}
              total={kpis.total || 1}
            />
          ))}
        </ChartCard>
        <ChartCard title="Assets by department" loading={loading}>
          {byDepartment.map(([id, count]) => (
            <BarRow
              key={id}
              label={id === "unassigned" ? "Unassigned" : `Dept ${id.slice(0, 8)}…`}
              count={count}
              total={kpis.total || 1}
            />
          ))}
        </ChartCard>
      </div>

      <div className="rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-medium tracking-tight">Recent activity</h2>
        </div>
        <ul className="divide-y divide-border/60">
          {loading ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
          ) : activity.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">No activity yet.</li>
          ) : (
            activity.map((item) => (
              <li key={item.id} className="px-4 py-2.5 text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.assetLabel ? `${item.assetLabel} · ` : ""}
                  {item.at}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-medium tracking-tight">{title}</h2>
      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

function BarRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = Math.round((count / total) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="truncate font-medium">{label}</span>
        <span className="text-muted-foreground">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/70 transition-[width] duration-300"
          style={{ width: `${Math.max(count ? 4 : 0, pct)}%` }}
        />
      </div>
    </div>
  );
}
