"use client";

import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Boxes,
  ChevronRight,
  Package,
  PackagePlus,
  Plus,
  Trash2,
  Truck,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { AssetReportsWorkspace } from "@/components/assets/asset-reports-workspace";
import {
  BRANCH_ALL_VALUE,
  ASSETS_ACCENT_BTN,
  AssetsPremiumPage,
} from "@/components/assets/shared";
import type {
  AssetOperationsKpiModel,
  AssetOperationsKpiTrends,
} from "@/components/assets/dashboard.mapper";
import {
  navigateDashboardKpi,
  navigateDashboardQuickAction,
  type DashboardKpiId,
  type DashboardQuickActionId,
} from "@/components/assets/navigation/dashboard-navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AssetOperationsDashboardProps = {
  kpisLoading?: boolean;
  kpis?: AssetOperationsKpiModel | null;
  kpiTrends?: AssetOperationsKpiTrends | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  className?: string;
};

type KpiTone = "default" | "success" | "warning" | "danger";

type OpsKpiDef = {
  id: DashboardKpiId;
  label: string;
  ariaLabel: string;
  icon: LucideIcon;
  tone: KpiTone;
  valueKey: keyof AssetOperationsKpiModel;
  trendKey?: keyof AssetOperationsKpiTrends;
};

const KPI_DEFS: OpsKpiDef[] = [
  {
    id: "total",
    label: "Total Assets",
    ariaLabel: "Open All Assets",
    icon: Boxes,
    tone: "default",
    valueKey: "totalAssets",
  },
  {
    id: "ready",
    label: "In Stock",
    ariaLabel: "Open In Stock assets",
    icon: Truck,
    tone: "warning",
    valueKey: "readyToMove",
    trendKey: "readyToMove",
  },
  {
    id: "assigned",
    label: "Assigned",
    ariaLabel: "Open Assigned assets",
    icon: UserCheck,
    tone: "success",
    valueKey: "assigned",
    trendKey: "assigned",
  },
  {
    id: "disposed",
    label: "Disposed",
    ariaLabel: "Open Disposed assets",
    icon: Trash2,
    tone: "danger",
    valueKey: "disposed",
    trendKey: "disposed",
  },
];

const HERO_TONE_RING: Record<KpiTone, string> = {
  default: "",
  success: "ring-1 ring-inset ring-emerald-300/25",
  warning: "ring-1 ring-inset ring-amber-300/30",
  danger: "ring-1 ring-inset ring-red-300/30",
};

const QUICK_ACTIONS: {
  id: DashboardQuickActionId;
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
    {
      id: "register",
      title: "Register Asset",
      description: "Add a new asset to inventory",
      icon: PackagePlus,
    },
    {
      id: "assign",
      title: "Assign Asset",
      description: "Issue asset to an employee",
      icon: UserPlus,
    },
  ];

function formatKpiValue(value: number | undefined): string {
  if (value === undefined) return "—";
  return String(value);
}

function OpsKpiTile({
  label,
  value,
  icon: Icon,
  tone,
  loading,
  empty,
  ariaLabel,
  onClick,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: KpiTone;
  loading?: boolean;
  empty?: boolean;
  ariaLabel: string;
  onClick: () => void;
}) {
  if (loading) {
    return (
      <div
        className="flex h-full min-h-[108px] flex-col overflow-hidden rounded-xl border border-white/10 p-3.5 shadow-sm bg-[linear-gradient(135deg,var(--kpi-hero-from)_0%,var(--kpi-hero-via)_45%,var(--kpi-hero-to)_100%)]"
        aria-busy="true"
        aria-label="Loading statistic"
      >
        <div className="h-3 w-20 animate-pulse rounded bg-white/20 motion-reduce:animate-none" />
        <div className="mt-3 h-8 w-14 animate-pulse rounded bg-white/20 motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "group relative flex h-full min-h-[108px] w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-white/10 p-3.5 text-left text-white shadow-sm",
        "bg-[linear-gradient(135deg,var(--kpi-hero-from)_0%,var(--kpi-hero-via)_45%,var(--kpi-hero-to)_100%)]",
        HERO_TONE_RING[tone],
        "transition-[box-shadow,filter] duration-200 hover:brightness-[1.06] hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "motion-reduce:transition-none",
      )}
    >
      <span
        className="pointer-events-none absolute -top-12 -right-10 size-32 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/15 to-transparent"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.08em] text-white/80 uppercase">
          {label}
        </p>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/10">
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <p className="relative mt-auto pt-3 text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums text-white">
        {empty ? "—" : value}
      </p>
    </button>
  );
}

export function AssetOperationsDashboard({
  kpisLoading = false,
  kpis = null,
  kpiTrends: _kpiTrends = null,
  errorMessage,
  onRetry,
  className,
}: AssetOperationsDashboardProps) {
  void _kpiTrends;
  const router = useRouter();
  const kpiEmpty = !kpisLoading && !kpis;
  const push = (href: string) => {
    router.push(href);
  };

  const openKpi = (kpi: DashboardKpiId) => {
    navigateDashboardKpi(push, kpi, BRANCH_ALL_VALUE);
  };

  return (
    <AssetsPremiumPage
      className={cn("space-y-5", className)}
      testId="asset-operations-dashboard"
    >
      <PageHeader
        title="Dashboard"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer gap-1.5 rounded-lg px-3 text-sm transition-colors duration-200"
              onClick={() => openKpi("total")}
            >
              <Package className="size-3.5" aria-hidden />
              All assets
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn(ASSETS_ACCENT_BTN, "h-8 rounded-lg px-3 text-sm")}
              onClick={() => push("/assets/assets/new")}
            >
              <Plus className="size-3.5" aria-hidden />
              Add asset
            </Button>
          </div>
        }
      />

      {errorMessage ? (
        <Card
          className="rounded-xl border-destructive/30 bg-destructive/5 shadow-sm"
          role="alert"
          data-testid="asset-ops-error-card"
        >
          <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
              <div>
                <p className="text-sm font-medium text-foreground">Unable to load dashboard data</p>
                <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
              </div>
            </div>
            {onRetry ? (
              <Button type="button" variant="outline" className="cursor-pointer" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <section aria-label="Operational status">
        <div
          className="grid auto-rows-fr grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-4"
          data-testid="asset-ops-kpi-grid"
        >
          {KPI_DEFS.map((def) => (
            <OpsKpiTile
              key={def.id}
              label={def.label}
              icon={def.icon}
              tone={def.tone}
              loading={kpisLoading}
              empty={kpiEmpty}
              value={kpis ? formatKpiValue(kpis[def.valueKey]) : "—"}
              ariaLabel={def.ariaLabel}
              onClick={() => openKpi(def.id)}
            />
          ))}
        </div>
      </section>

      <section aria-label="Reports" className="min-w-0">
        <AssetReportsWorkspace
          embedded
          fleetKpis={
            kpis
              ? {
                totalAssets: kpis.totalAssets,
                inStock: kpis.readyToMove,
                assigned: kpis.assigned,
              }
              : null
          }
          fleetKpisLoading={kpisLoading}
        />
      </section>

      <section
        aria-labelledby="asset-ops-quick-actions-heading"
        className="overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-sm"
      >
        <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(3,105,161,0.1)] text-[#0369A1]">
            <PackagePlus className="size-3.5" aria-hidden />
          </span>
          <h2
            id="asset-ops-quick-actions-heading"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            Quick actions
          </h2>
        </div>
        <div
          className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:p-4"
          data-testid="asset-ops-quick-actions-grid"
        >
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => navigateDashboardQuickAction(push, action.id)}
                className={cn(
                  "group flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3 text-left",
                  "transition-[border-color,background-color,box-shadow] duration-200",
                  "hover:border-primary/35 hover:bg-accent/40 hover:shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "motion-reduce:transition-none",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[rgba(3,105,161,0.1)] text-[#0369A1]">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {action.title}
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground/40 transition-colors duration-200 group-hover:text-primary"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] leading-snug text-muted-foreground">
                    {action.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </AssetsPremiumPage>
  );
}
