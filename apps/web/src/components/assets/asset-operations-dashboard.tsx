"use client";

import { useRouter } from "next/navigation";
import {
  Archive,
  Bell,
  Boxes,
  Globe,
  PackagePlus,
  QrCode,
  ScanSearch,
  Trash2,
  Truck,
  Undo2,
  User,
  UserCheck,
  UserPlus,
  Clock,
  AlertCircle,
} from "lucide-react";

import {
  BRANCH_ALL_VALUE,
  BranchSelector,
  QueueCard,
  QuickActionCard,
  StatCard,
  type BranchOption,
  type QueueCardRow,
  type StatCardTrend,
} from "@/components/assets/shared";
import type {
  AssetOperationsKpiModel,
  AssetOperationsKpiTrends,
  AssetOperationsQueueTotals,
  BranchBreakdownRow,
} from "@/components/assets/dashboard.mapper";
import {
  navigateDashboardQuickAction,
  navigateDashboardViewAll,
} from "@/components/assets/navigation/dashboard-navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const READY_QUEUE_COLUMNS = ["Asset Tag", "Name", "Branch"];
const DISPOSAL_QUEUE_COLUMNS = ["Asset Tag", "Name", "Branch", "Operational Status"];
const ASSIGNMENT_COLUMNS = ["Assignment Status", "Assignment", "When"];

export type AssetOperationsDashboardProps = {
  branchId: string;
  branches: BranchOption[];
  onBranchChange: (branchId: string) => void;
  kpisLoading?: boolean;
  queuesLoading?: boolean;
  kpis?: AssetOperationsKpiModel | null;
  kpiTrends?: AssetOperationsKpiTrends | null;
  queueTotals?: AssetOperationsQueueTotals | null;
  byBranchRows?: BranchBreakdownRow[];
  readyQueueRows?: QueueCardRow[];
  disposalQueueRows?: QueueCardRow[];
  assignmentRows?: QueueCardRow[];
  errorMessage?: string | null;
  onRetry?: () => void;
  queueErrors?: {
    ready?: string;
    disposal?: string;
    assignments?: string;
  };
  className?: string;
};

function formatKpiValue(value: number | undefined): string {
  if (value === undefined) return "—";
  return String(value);
}

function BranchBreakdownSection({
  rows,
  loading,
}: {
  rows: BranchBreakdownRow[];
  loading?: boolean;
}) {
  if (loading || rows.length === 0) return null;

  return (
    <Card
      className="border-border/80 shadow-sm"
      data-testid="asset-ops-branch-breakdown"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className="text-sm font-medium tracking-tight">By branch</CardTitle>
        <span className="text-[11px] text-muted-foreground">{rows.length} branches</span>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] text-muted-foreground">
                <th className="pb-1.5 pr-2 font-medium">Branch</th>
                <th className="pb-1.5 pr-2 font-medium text-right">Total</th>
                <th className="pb-1.5 pr-2 font-medium text-right">Ready</th>
                <th className="pb-1.5 pr-2 font-medium text-right">Assigned</th>
                <th className="pb-1.5 pr-2 font-medium text-right">Retired</th>
                <th className="pb-1.5 pr-2 font-medium text-right">Pending</th>
                <th className="pb-1.5 font-medium text-right">Disposed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.branchId}
                  className="border-b border-border/40 transition-colors duration-150 last:border-0 hover:bg-muted/30"
                >
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

export function AssetOperationsDashboard({
  branchId,
  branches,
  onBranchChange,
  kpisLoading = false,
  queuesLoading = false,
  kpis = null,
  kpiTrends = null,
  queueTotals = null,
  byBranchRows = [],
  readyQueueRows = [],
  disposalQueueRows = [],
  assignmentRows = [],
  errorMessage,
  onRetry,
  queueErrors,
  className,
}: AssetOperationsDashboardProps) {
  const router = useRouter();
  const kpiEmpty = !kpisLoading && !kpis;
  const showBranchBreakdown = branchId === BRANCH_ALL_VALUE && byBranchRows.length > 0;
  const push = (href: string) => {
    router.push(href);
  };

  const trend = (key: keyof AssetOperationsKpiTrends): StatCardTrend | undefined =>
    kpiTrends?.[key];

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-5 px-1 py-2 sm:px-2 md:px-0 md:py-3",
        className,
      )}
      data-testid="asset-operations-dashboard"
    >
      <PageHeader
        title="Asset Operations"
        description="Manage enterprise IT assets and daily operations"
        actions={
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0 cursor-pointer"
                aria-label="Notifications (placeholder)"
              >
                <Bell className="size-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0 cursor-pointer"
                aria-label="Profile (placeholder)"
              >
                <User className="size-3.5" aria-hidden />
              </Button>
            </div>
            <BranchSelector
              value={branchId}
              onChange={onBranchChange}
              branches={branches}
              aria-label="Branch"
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

      <section aria-labelledby="asset-ops-kpi-heading">
        <h2 id="asset-ops-kpi-heading" className="sr-only">
          Operational status indicators
        </h2>
        <p className="mb-2 text-[11px] text-muted-foreground" data-testid="asset-ops-kpi-ops-note">
          Counts by Operational Status
        </p>
        <div
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6"
          data-testid="asset-ops-kpi-grid"
        >
          <StatCard
            title="Total Assets"
            icon={Boxes}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.totalAssets) : undefined}
            empty={kpiEmpty}
            className="shadow-sm"
          />
          <StatCard
            title="Ready to Move"
            icon={Truck}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.readyToMove) : undefined}
            trend={trend("readyToMove")}
            empty={kpiEmpty}
          />
          <StatCard
            title="Assigned"
            icon={UserCheck}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.assigned) : undefined}
            trend={trend("assigned")}
            empty={kpiEmpty}
          />
          <StatCard
            title="Retired"
            icon={Archive}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.retired) : undefined}
            trend={trend("retired")}
            empty={kpiEmpty}
          />
          <StatCard
            title="Pending Disposal"
            icon={Clock}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.pendingDisposal) : undefined}
            trend={trend("pendingDisposal")}
            empty={kpiEmpty}
          />
          <StatCard
            title="Disposed"
            icon={Trash2}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.disposed) : undefined}
            trend={trend("disposed")}
            empty={kpiEmpty}
          />
        </div>
      </section>

      {showBranchBreakdown ? (
        <BranchBreakdownSection rows={byBranchRows} loading={kpisLoading} />
      ) : null}

      <section aria-labelledby="asset-ops-operations-heading">
        <div className="mb-2 flex items-end justify-between gap-2">
          <h2
            id="asset-ops-operations-heading"
            className="text-sm font-medium tracking-tight text-foreground"
          >
            Operations
          </h2>
        </div>
        <div className="flex flex-col gap-3" data-testid="asset-ops-operations">
          <div
            className="grid grid-cols-1 gap-3 lg:grid-cols-2"
            data-testid="asset-ops-operations-grid"
          >
            <QueueCard
              title="Ready to Move Queue"
              count={queueErrors?.ready ? undefined : queueTotals?.ready}
              columnLabels={READY_QUEUE_COLUMNS}
              rows={queueErrors?.ready ? [] : readyQueueRows}
              loading={queuesLoading}
              dense
              emptyTitle={queueErrors?.ready ? "Could not load queue" : "No ready assets"}
              emptyDescription={
                queueErrors?.ready ??
                "Assets with Operational Status Ready to Move will appear here."
              }
              action={{
                label: "View all ready",
                onClick: () => navigateDashboardViewAll(push, "ready", branchId),
              }}
            />
            <QueueCard
              title="Pending Disposal Queue"
              count={queueErrors?.disposal ? undefined : queueTotals?.disposal}
              columnLabels={DISPOSAL_QUEUE_COLUMNS}
              rows={queueErrors?.disposal ? [] : disposalQueueRows}
              loading={queuesLoading}
              dense
              emptyTitle={queueErrors?.disposal ? "Could not load queue" : "No pending disposal"}
              emptyDescription={
                queueErrors?.disposal ?? "Assets awaiting disposal will appear here."
              }
              action={{
                label: "View all pending disposal",
                onClick: () => navigateDashboardViewAll(push, "pendingDisposal", branchId),
              }}
            />
          </div>
          <div data-testid="asset-ops-assignments-row">
            <QueueCard
              title="Recent Assignments"
              count={queueErrors?.assignments ? undefined : queueTotals?.assignments}
              columnLabels={ASSIGNMENT_COLUMNS}
              rows={queueErrors?.assignments ? [] : assignmentRows}
              loading={queuesLoading}
              dense
              emptyTitle={queueErrors?.assignments ? "Could not load assignments" : "No assignments"}
              emptyDescription={
                queueErrors?.assignments ?? "Recent assignment activity will appear here."
              }
              action={{
                label: "View all assignments",
                onClick: () => navigateDashboardViewAll(push, "assignments", branchId),
              }}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="asset-ops-quick-actions-heading">
        <h2
          id="asset-ops-quick-actions-heading"
          className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          Quick actions
        </h2>
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
          data-testid="asset-ops-quick-actions-grid"
        >
          <QuickActionCard
            compact
            title="Register Asset"
            icon={PackagePlus}
            description="Add a new asset to inventory"
            onPress={() => navigateDashboardQuickAction(push, "register", branchId)}
          />
          <QuickActionCard
            compact
            title="Assign Asset"
            icon={UserPlus}
            description="Issue asset to an employee"
            onPress={() => navigateDashboardQuickAction(push, "assign", branchId)}
          />
          <QuickActionCard
            compact
            title="Return Asset"
            icon={Undo2}
            description="Process a return from holder"
            onPress={() => navigateDashboardQuickAction(push, "return", branchId)}
          />
          <QuickActionCard
            compact
            title="Discovery"
            icon={ScanSearch}
            description="Review discovery signals"
            onPress={() => navigateDashboardQuickAction(push, "discovery", branchId)}
          />
          <QuickActionCard
            compact
            title="Information Portal"
            icon={Globe}
            description="Open asset information portal"
            onPress={() => navigateDashboardQuickAction(push, "informationPortal", branchId)}
          />
          <QuickActionCard
            compact
            title="QR / Barcode"
            icon={QrCode}
            description="Scan or print labels"
            onPress={() => navigateDashboardQuickAction(push, "qr", branchId)}
          />
        </div>
      </section>
    </div>
  );
}
