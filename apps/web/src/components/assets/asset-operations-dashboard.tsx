"use client";

import { useRouter } from "next/navigation";
import {
  Archive,
  AlertCircle,
  ArrowLeftRight,
  Boxes,
  Clock,
  Globe,
  Package,
  PackagePlus,
  Plus,
  QrCode,
  ScanSearch,
  Trash2,
  Truck,
  Undo2,
  UserCheck,
  UserPlus,
} from "lucide-react";

import {
  BRANCH_ALL_VALUE,
  BranchSelector,
  QuickActionCard,
  StatCard,
  StatusBadge,
  type BranchOption,
  type StatCardTrend,
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableRowSerialFromIndex,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import {
  ASSETS_ACCENT_BTN,
  ASSETS_SURFACE_CARD,
  AssetsPremiumPage,
} from "@/components/assets/shared/premium-surface";
import type {
  AssetOperationsKpiModel,
  AssetOperationsKpiTrends,
  DashboardTransferRow,
  LocationBreakdownRow,
} from "@/components/assets/dashboard.mapper";
import {
  navigateDashboardKpi,
  navigateDashboardQuickAction,
  type DashboardKpiId,
} from "@/components/assets/navigation/dashboard-navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AssetOperationsDashboardProps = {
  locationId: string;
  locations: BranchOption[];
  onLocationChange: (locationId: string) => void;
  kpisLoading?: boolean;
  transfersLoading?: boolean;
  kpis?: AssetOperationsKpiModel | null;
  kpiTrends?: AssetOperationsKpiTrends | null;
  byLocationRows?: LocationBreakdownRow[];
  transferRows?: DashboardTransferRow[];
  transferTotal?: number;
  transferError?: string | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  branchLookup?: Record<string, string>;
  className?: string;
};

function formatKpiValue(value: number | undefined): string {
  if (value === undefined) return "—";
  return String(value);
}

function resolveBranchLabel(
  branchId: string | null,
  lookup: Record<string, string>,
): string {
  if (!branchId) return "—";
  return lookup[branchId] ?? branchId.slice(0, 8);
}

function LocationBreakdownSection({
  rows,
  loading,
}: {
  rows: LocationBreakdownRow[];
  loading?: boolean;
}) {
  if (loading || rows.length === 0) return null;

  return (
    <Card
      className={cn(ASSETS_SURFACE_CARD, "overflow-hidden")}
      data-testid="asset-ops-location-breakdown"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/50 bg-muted/15 pb-3 pt-4">
        <CardTitle className="text-sm font-semibold tracking-tight">By Location</CardTitle>
        <span className="rounded-md border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {rows.length} locations
        </span>
      </CardHeader>
      <CardContent className="pt-3 pb-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="pb-1.5 pr-2 font-semibold">Location</th>
                <th className="pb-1.5 pr-2 font-semibold text-right">Total</th>
                <th className="pb-1.5 pr-2 font-semibold text-right">Ready</th>
                <th className="pb-1.5 pr-2 font-semibold text-right">Assigned</th>
                <th className="pb-1.5 pr-2 font-semibold text-right">Retired</th>
                <th className="pb-1.5 pr-2 font-semibold text-right">Pending</th>
                <th className="pb-1.5 font-semibold text-right">Disposed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.locationId}
                  className="border-b border-border/40 transition-colors duration-150 last:border-0 hover:bg-muted/30"
                >
                  <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
                  <td className="py-1.5 pr-2 text-[13px] font-medium text-foreground">{row.label}</td>
                  <td className="py-1.5 pr-2 text-right font-mono text-[13px] tabular-nums">
                    {row.totalAssets}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                    {row.readyToMove}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                    {row.assigned}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                    {row.retired}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                    {row.pendingDisposal}
                  </td>
                  <td className="py-1.5 text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                    {row.disposed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function TransferListSection({
  rows,
  total,
  loading,
  error,
  branchLookup,
  onViewAll,
}: {
  rows: DashboardTransferRow[];
  total: number;
  loading?: boolean;
  error?: string | null;
  branchLookup: Record<string, string>;
  onViewAll: () => void;
}) {
  return (
    <section aria-labelledby="asset-ops-transfers-heading" data-testid="asset-ops-transfers">
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="asset-ops-transfers-heading"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Transfer list
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Recent asset transfers with document, asset, locations, and status
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer gap-1.5 transition-colors duration-200"
          onClick={onViewAll}
        >
          <ArrowLeftRight className="size-3.5" aria-hidden />
          View all transfers
        </Button>
      </div>

      <Card className={cn(ASSETS_SURFACE_CARD, "overflow-hidden border-l-[3px] border-l-[#0369A1]/70")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/50 bg-muted/15 pb-3 pt-4">
          <CardTitle className="text-sm font-semibold tracking-tight">Transfers</CardTitle>
          <span
            className="rounded-md border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            aria-label={`${total} total`}
            data-testid="asset-ops-transfer-count"
          >
            {total} total
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="px-3 py-2 font-semibold">Document</th>
                  <th className="px-3 py-2 font-semibold">Asset</th>
                  <th className="px-3 py-2 font-semibold">From location</th>
                  <th className="px-3 py-2 font-semibold">To location</th>
                  <th className="px-3 py-2 font-semibold">From branch</th>
                  <th className="px-3 py-2 font-semibold">To branch</th>
                  <th className="px-3 py-2 font-semibold">Effective</th>
                  <th className="px-3 py-2 font-semibold">Reason</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      Loading transfers…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-sm text-destructive">
                      {error}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      No transfers found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/40 transition-colors duration-150 last:border-0 hover:bg-muted/30"
                    >
                      <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-foreground">{row.documentNumber}</td>
                      <td className="px-3 py-2">
                        <div className="text-[13px] font-medium text-foreground">{row.assetName}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{row.assetCode}</div>
                      </td>
                      <td className="px-3 py-2 text-[13px] text-muted-foreground">{row.fromLocation}</td>
                      <td className="px-3 py-2 text-[13px] text-muted-foreground">{row.toLocation}</td>
                      <td className="px-3 py-2 text-[13px] text-muted-foreground">
                        {resolveBranchLabel(row.fromBranchId, branchLookup)}
                      </td>
                      <td className="px-3 py-2 text-[13px] text-muted-foreground">
                        {resolveBranchLabel(row.toBranchId, branchLookup)}
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] tabular-nums text-muted-foreground">
                        {row.effectiveDate ?? "—"}
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-2 text-[13px] text-muted-foreground">
                        {row.reason ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge kind="lifecycle" status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function AssetOperationsDashboard({
  locationId,
  locations,
  onLocationChange,
  kpisLoading = false,
  transfersLoading = false,
  kpis = null,
  kpiTrends = null,
  byLocationRows = [],
  transferRows = [],
  transferTotal = 0,
  transferError = null,
  errorMessage,
  onRetry,
  branchLookup = {},
  className,
}: AssetOperationsDashboardProps) {
  const router = useRouter();
  const kpiEmpty = !kpisLoading && !kpis;
  const showLocationBreakdown = locationId === BRANCH_ALL_VALUE && byLocationRows.length > 0;
  const push = (href: string) => {
    router.push(href);
  };

  const trend = (key: keyof AssetOperationsKpiTrends): StatCardTrend | undefined =>
    kpiTrends?.[key];

  const openKpi = (kpi: DashboardKpiId) => {
    navigateDashboardKpi(push, kpi, locationId);
  };

  return (
    <AssetsPremiumPage
      className={cn("px-1 py-2 sm:px-2 md:px-0 md:py-3", className)}
      testId="asset-operations-dashboard"
    >
      <PageHeader
        title="IT Asset Operations"
        description="Operational status, location mix, and transfer activity — click a KPI to open All Assets filtered."
        actions={
          <div className="flex flex-col items-stretch gap-2.5 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer gap-2 transition-colors duration-200"
                onClick={() => openKpi("total")}
              >
                <Package className="size-4" aria-hidden />
                All assets
              </Button>
              <Button
                type="button"
                className={ASSETS_ACCENT_BTN}
                onClick={() => push("/assets/assets/new")}
              >
                <Plus className="size-4" aria-hidden />
                Add asset
              </Button>
            </div>
            <BranchSelector
              value={locationId}
              onChange={onLocationChange}
              branches={locations}
              aria-label="Location"
              allLabel="All"
            />
          </div>
        }
      />

      {errorMessage ? (
        <Card
          className="border-destructive/30 bg-destructive/5 shadow-sm"
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

      <section aria-labelledby="asset-ops-kpi-heading" className="space-y-2.5">
        <div>
          <h2
            id="asset-ops-kpi-heading"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Counts by operational status
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground" data-testid="asset-ops-kpi-ops-note">
            Click any card to open All Assets with that status filter applied
          </p>
        </div>
        <div
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-7"
          data-testid="asset-ops-kpi-grid"
        >
          <StatCard
            title="Total Assets"
            icon={Boxes}
            tone="default"
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.totalAssets) : undefined}
            empty={kpiEmpty}
            aria-label="Open All Assets"
            onClick={() => openKpi("total")}
          />
          <StatCard
            title="Ready to Move"
            icon={Truck}
            tone="sky"
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.readyToMove) : undefined}
            trend={trend("readyToMove")}
            empty={kpiEmpty}
            aria-label="Open Ready to Move assets"
            onClick={() => openKpi("ready")}
          />
          <StatCard
            title="Assigned"
            icon={UserCheck}
            tone="emerald"
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.assigned) : undefined}
            trend={trend("assigned")}
            empty={kpiEmpty}
            aria-label="Open Assigned assets"
            onClick={() => openKpi("assigned")}
          />
          <StatCard
            title="In Use as Component"
            icon={Boxes}
            tone="slate"
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.inUseAsComponent) : undefined}
            trend={trend("inUseAsComponent")}
            empty={kpiEmpty}
            aria-label="Open In Use as Component assets"
            onClick={() => openKpi("inUseAsComponent")}
          />
          <StatCard
            title="Retired"
            icon={Archive}
            tone="slate"
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.retired) : undefined}
            trend={trend("retired")}
            empty={kpiEmpty}
            aria-label="Open Retired assets"
            onClick={() => openKpi("retired")}
          />
          <StatCard
            title="Pending Disposal"
            icon={Clock}
            tone="amber"
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.pendingDisposal) : undefined}
            trend={trend("pendingDisposal")}
            empty={kpiEmpty}
            aria-label="Open Pending Disposal assets"
            onClick={() => openKpi("pendingDisposal")}
          />
          <StatCard
            title="Disposed"
            icon={Trash2}
            tone="rose"
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.disposed) : undefined}
            trend={trend("disposed")}
            empty={kpiEmpty}
            aria-label="Open Disposed assets"
            onClick={() => openKpi("disposed")}
          />
        </div>
      </section>

      {showLocationBreakdown ? (
        <LocationBreakdownSection rows={byLocationRows} loading={kpisLoading} />
      ) : null}

      <TransferListSection
        rows={transferRows}
        total={transferTotal}
        loading={transfersLoading}
        error={transferError}
        branchLookup={branchLookup}
        onViewAll={() => push("/assets/asset-transfers")}
      />

      <section aria-labelledby="asset-ops-quick-actions-heading">
        <h2
          id="asset-ops-quick-actions-heading"
          className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Quick actions
        </h2>
        <div
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-7"
          data-testid="asset-ops-quick-actions-grid"
        >
          <QuickActionCard
            compact
            title="Register Asset"
            icon={PackagePlus}
            description="Add a new asset to inventory"
            onPress={() => navigateDashboardQuickAction(push, "register", locationId)}
          />
          <QuickActionCard
            compact
            title="Assign Asset"
            icon={UserPlus}
            description="Issue asset to an employee"
            onPress={() => navigateDashboardQuickAction(push, "assign", locationId)}
          />
          <QuickActionCard
            compact
            title="Return Asset"
            icon={Undo2}
            description="Process a return from holder"
            onPress={() => navigateDashboardQuickAction(push, "return", locationId)}
          />
          <QuickActionCard
            compact
            title="Discovery"
            icon={ScanSearch}
            description="Review discovery signals"
            onPress={() => navigateDashboardQuickAction(push, "discovery", locationId)}
          />
          <QuickActionCard
            compact
            title="Information Portal"
            icon={Globe}
            description="Open asset information portal"
            onPress={() =>
              navigateDashboardQuickAction(push, "informationPortal", locationId)
            }
          />
          <QuickActionCard
            compact
            title="QR / Barcode"
            icon={QrCode}
            description="Scan or print labels"
            onPress={() => navigateDashboardQuickAction(push, "qr", locationId)}
          />
        </div>
      </section>
    </AssetsPremiumPage>
  );
}
