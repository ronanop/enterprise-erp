"use client";

import type { ReactNode } from "react";
import {
  Archive,
  Boxes,
  Clock,
  Trash2,
  Truck,
  UserCheck,
  AlertCircle,
} from "lucide-react";

import type { AssetOperationsKpiModel, RecentActivityItem } from "@/components/assets/dashboard.mapper";
import { OperationsHealthSummary } from "@/components/assets/operations-health-summary";
import { OperationsPendingActions, type PendingActionItem } from "@/components/assets/operations-pending-actions";
import { OperationsQuickActions } from "@/components/assets/operations-quick-actions";
import { OperationsRecentActivity } from "@/components/assets/operations-recent-activity";
import { OperationsStickyToolbar } from "@/components/assets/operations-sticky-toolbar";
import {
  QueueCard,
  StatCard,
  type BranchOption,
  type QueueCardRow,
} from "@/components/assets/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AssetOperationsDashboardProps = {
  branchId: string;
  branches: BranchOption[];
  onBranchChange: (branchId: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  kpisLoading?: boolean;
  activityLoading?: boolean;
  pendingLoading?: boolean;
  queuesLoading?: boolean;
  kpis?: AssetOperationsKpiModel | null;
  recentActivity?: RecentActivityItem[];
  pendingActions?: PendingActionItem[];
  readyRows?: QueueCardRow[];
  disposalRows?: QueueCardRow[];
  errorMessage?: string | null;
  onRefresh?: () => void;
  onAddAsset?: () => void;
  onAllocate?: () => void;
  onReturn?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onReadyQueueOpen?: (assetId?: string) => void;
  onDisposalQueueOpen?: (assetId?: string) => void;
  /** Embedded Asset Register (AssetInventoryContainer). */
  register?: ReactNode;
  className?: string;
};

function formatKpiValue(value: number | undefined): string {
  if (value === undefined) return "—";
  return String(value);
}

export function AssetOperationsDashboard({
  branchId,
  branches,
  onBranchChange,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  kpisLoading = false,
  activityLoading = false,
  pendingLoading = false,
  queuesLoading = false,
  kpis = null,
  recentActivity = [],
  pendingActions = [],
  readyRows = [],
  disposalRows = [],
  errorMessage,
  onRefresh,
  onAddAsset,
  onAllocate,
  onReturn,
  onImport,
  onExport,
  onReadyQueueOpen,
  onDisposalQueueOpen,
  register,
  className,
}: AssetOperationsDashboardProps) {
  const kpiEmpty = !kpisLoading && !kpis;

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-5 md:gap-6 md:px-6 md:py-6",
        className,
      )}
      data-testid="asset-operations-dashboard"
    >
      <PageHeader
        title="Asset Operations"
        description="Manage all company assets from one workspace."
      />

      <OperationsStickyToolbar
        branchId={branchId}
        branches={branches}
        onBranchChange={onBranchChange}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        onAddAsset={onAddAsset}
        onAllocate={onAllocate}
        onReturn={onReturn}
        onImport={onImport}
        onExport={onExport}
        onRefresh={onRefresh}
      />

      <OperationsQuickActions
        onAddAsset={onAddAsset}
        onAllocate={onAllocate}
        onReturn={onReturn}
        onImport={onImport}
        onExport={onExport}
      />

      {errorMessage ? (
        <Card
          className="border-destructive/30 bg-destructive/5 shadow-sm"
          role="alert"
          data-testid="asset-ops-error-card"
        >
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
              <div>
                <p className="text-sm font-medium text-foreground">Unable to load dashboard data</p>
                <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
              </div>
            </div>
            {onRefresh ? (
              <Button type="button" variant="outline" className="cursor-pointer" onClick={onRefresh}>
                Retry
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="asset-ops-kpi-heading">
        <h2 id="asset-ops-kpi-heading" className="sr-only">
          Key performance indicators
        </h2>
        <div
          className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-6"
          data-testid="asset-ops-kpi-grid"
        >
          <StatCard
            title="Total Assets"
            icon={Boxes}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.totalAssets) : undefined}
            empty={kpiEmpty}
          />
          <StatCard
            title="Ready To Move"
            icon={Truck}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.readyToMove) : undefined}
            empty={kpiEmpty}
          />
          <StatCard
            title="Assigned"
            icon={UserCheck}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.assigned) : undefined}
            empty={kpiEmpty}
          />
          <StatCard
            title="Pending Disposal"
            icon={Clock}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.pendingDisposal) : undefined}
            empty={kpiEmpty}
          />
          <StatCard
            title="Retired"
            icon={Archive}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.retired) : undefined}
            empty={kpiEmpty}
          />
          <StatCard
            title="Disposed"
            icon={Trash2}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.disposed) : undefined}
            empty={kpiEmpty}
          />
        </div>
      </section>

      <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5"
        data-testid="asset-ops-productivity-row"
      >
        <OperationsHealthSummary kpis={kpis} loading={kpisLoading} />
        <OperationsPendingActions items={pendingActions} loading={pendingLoading} />
      </div>

      <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5"
        data-testid="asset-ops-queues-row"
      >
        <QueueCard
          title="Ready To Move Queue"
          rows={readyRows}
          columnLabels={["Asset", "Name", "Branch"]}
          loading={queuesLoading}
          emptyTitle="No ready assets"
          emptyDescription="Mark assets Ready To Move from the register status dropdown."
          action={
            onAllocate
              ? {
                  label: "Allocate",
                  onClick: () => onReadyQueueOpen?.() ?? onAllocate(),
                }
              : undefined
          }
        />
        <QueueCard
          title="Pending Disposal Queue"
          rows={disposalRows}
          columnLabels={["Asset", "Name", "Branch"]}
          loading={queuesLoading}
          emptyTitle="No disposal queue"
          emptyDescription="Assets pending disposal will appear here."
          action={
            onDisposalQueueOpen
              ? {
                  label: "Open disposal",
                  onClick: () => onDisposalQueueOpen(),
                }
              : undefined
          }
        />
      </div>

      <section
        aria-labelledby="asset-ops-register-heading"
        className="min-h-0 flex-1"
        data-testid="asset-ops-register-section"
      >
        <h2 id="asset-ops-register-heading" className="sr-only">
          Asset Register
        </h2>
        {register}
      </section>

      <OperationsRecentActivity items={recentActivity} loading={activityLoading} />
    </div>
  );
}
