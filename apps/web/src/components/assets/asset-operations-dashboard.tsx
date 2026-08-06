"use client";

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
  BranchSelector,
  QueueCard,
  QuickActionCard,
  StatCard,
  type BranchOption,
  type QueueCardRow,
} from "@/components/assets/shared";
import type { AssetOperationsKpiModel } from "@/components/assets/dashboard.mapper";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const READY_QUEUE_COLUMNS = ["Asset Tag", "Name", "Branch"];
const DISPOSAL_QUEUE_COLUMNS = ["Asset Tag", "Name", "Branch", "Lifecycle"];
const ASSIGNMENT_COLUMNS = ["Status", "Assignment", "When"];

export type AssetOperationsDashboardProps = {
  branchId: string;
  branches: BranchOption[];
  onBranchChange: (branchId: string) => void;
  kpisLoading?: boolean;
  queuesLoading?: boolean;
  kpis?: AssetOperationsKpiModel | null;
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

export function AssetOperationsDashboard({
  branchId,
  branches,
  onBranchChange,
  kpisLoading = false,
  queuesLoading = false,
  kpis = null,
  readyQueueRows = [],
  disposalQueueRows = [],
  assignmentRows = [],
  errorMessage,
  onRetry,
  queueErrors,
  className,
}: AssetOperationsDashboardProps) {
  const kpiEmpty = !kpisLoading && !kpis;

  return (
    <div
      className={cn("mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-6 md:px-6", className)}
      data-testid="asset-operations-dashboard"
    >
      <PageHeader
        title="Asset Operations"
        description="Manage enterprise IT assets and daily operations"
        actions={
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 shrink-0 cursor-pointer"
                aria-label="Notifications (placeholder)"
              >
                <Bell className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 shrink-0 cursor-pointer"
                aria-label="Profile (placeholder)"
              >
                <User className="size-4" aria-hidden />
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
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
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
          Key performance indicators
        </h2>
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6"
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
            title="Retired"
            icon={Archive}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.retired) : undefined}
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
            title="Disposed"
            icon={Trash2}
            loading={kpisLoading}
            value={kpis ? formatKpiValue(kpis.disposed) : undefined}
            empty={kpiEmpty}
          />
        </div>
      </section>

      <section aria-labelledby="asset-ops-quick-actions-heading">
        <h2
          id="asset-ops-quick-actions-heading"
          className="mb-3 text-sm font-medium tracking-tight text-foreground"
        >
          Quick actions
        </h2>
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          data-testid="asset-ops-quick-actions-grid"
        >
          <QuickActionCard title="Register Asset" icon={PackagePlus} description="Add a new asset to inventory" />
          <QuickActionCard title="Assign Asset" icon={UserPlus} description="Issue asset to an employee" />
          <QuickActionCard title="Return Asset" icon={Undo2} description="Process a return from holder" />
          <QuickActionCard title="Discovery" icon={ScanSearch} description="Review discovery signals" />
          <QuickActionCard title="Information Portal" icon={Globe} description="Open asset information portal" />
          <QuickActionCard title="QR / Barcode" icon={QrCode} description="Scan or print labels" />
        </div>
      </section>

      <section aria-labelledby="asset-ops-operations-heading">
        <h2
          id="asset-ops-operations-heading"
          className="mb-3 text-sm font-medium tracking-tight text-foreground"
        >
          Operations
        </h2>
        <div
          className="grid grid-cols-1 gap-4 lg:grid-cols-3"
          data-testid="asset-ops-operations-grid"
        >
          <QueueCard
            title="Ready To Move Queue"
            columnLabels={READY_QUEUE_COLUMNS}
            rows={queueErrors?.ready ? [] : readyQueueRows}
            loading={queuesLoading}
            emptyTitle={queueErrors?.ready ? "Could not load queue" : "No ready assets"}
            emptyDescription={
              queueErrors?.ready ?? "Assets in ready-to-move status will appear here."
            }
            action={{ label: "View all ready" }}
          />
          <QueueCard
            title="Pending Disposal Queue"
            columnLabels={DISPOSAL_QUEUE_COLUMNS}
            rows={queueErrors?.disposal ? [] : disposalQueueRows}
            loading={queuesLoading}
            emptyTitle={queueErrors?.disposal ? "Could not load queue" : "No pending disposal"}
            emptyDescription={
              queueErrors?.disposal ?? "Assets awaiting disposal will appear here."
            }
            action={{ label: "View all pending disposal" }}
          />
          <QueueCard
            title="Recent Assignments"
            columnLabels={ASSIGNMENT_COLUMNS}
            rows={queueErrors?.assignments ? [] : assignmentRows}
            loading={queuesLoading}
            emptyTitle={queueErrors?.assignments ? "Could not load assignments" : "No assignments"}
            emptyDescription={
              queueErrors?.assignments ?? "Recent assignment activity will appear here."
            }
            action={{ label: "View all assignments" }}
          />
        </div>
      </section>
    </div>
  );
}
