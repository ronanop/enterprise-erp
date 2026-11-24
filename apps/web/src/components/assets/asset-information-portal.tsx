"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AssetDiscoveryPanel } from "@/components/assets/asset-discovery-panel";
import { MaintenanceWorkOrderDetailDrawer } from "@/components/assets/maintenance-work-order-detail-drawer";
import {
  formatPortalDate,
  formatPortalDateTime,
  PortalLifecycleTimeline,
} from "@/components/assets/portal/portal-lifecycle-timeline";
import {
  mapAssignmentHistoryEntries,
  type EmployeeLookup,
} from "@/components/assets/inventory/register-parity";
import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerialFromIndex,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildAssignmentTimeline,
  buildClientLifecycleTimeline,
  buildMaintenanceTimeline,
  mapApiLifecycleEvents,
} from "@/domain/asset-lifecycle-timeline";
import { isAuthenticated } from "@/lib/auth";
import {
  employeeDirectoryById,
  listEmployeeDirectory,
  type EmployeeDirectoryEntry,
} from "@/lib/org-options";
import { ApiClientError, resourceService } from "@/services/api-client";
import {
  type AssetInformationPortal,
  type AssetLifecycleTimelineEvent,
  type AssetsRow,
  assetInformationPortalService,
} from "@/services/assets-service";
import { Eye, ArrowLeft, Loader2 } from "lucide-react";

function dash(value?: string | null): string {
  return value && String(value).trim() ? String(value) : "—";
}

function portalErrorMessage(err: unknown): string {
  if (!(err instanceof ApiClientError)) {
    return "Failed to load asset portal";
  }
  const status = typeof err.status === "number" ? err.status : null;
  if (status === 401) {
    return "Sign in is required to view this asset.";
  }
  if (status === 403) {
    return "You are signed in, but you do not have Asset Management access for this asset. Ask an admin to grant asset permissions.";
  }
  if (status === 404) {
    return "Asset not found.";
  }
  return err.message || "Failed to load asset portal";
}

type PortalTab =
  | "assignments"
  | "maintenance"
  | "documents"
  | "activity"
  | "discovery";

const PORTAL_TABS: Array<{ id: PortalTab; label: string }> = [
  { id: "assignments", label: "Assignment History" },
  { id: "maintenance", label: "Maintenance History" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity Logs" },
  { id: "discovery", label: "Discovery" },
];

type Props = {
  assetId: string;
};

export function AssetInformationPortalView({ assetId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQr = searchParams.get("from") === "qr";
  const [tab, setTab] = useState<PortalTab>("assignments");
  const [portal, setPortal] = useState<AssetInformationPortal | null>(null);
  const [assignments, setAssignments] = useState<AssetsRow[]>([]);
  const [maintenances, setMaintenances] = useState<AssetsRow[]>([]);
  const [documents, setDocuments] = useState<AssetsRow[]>([]);
  const [lifecycleEvents, setLifecycleEvents] = useState<AssetLifecycleTimelineEvent[]>([]);
  const [employeeLookup, setEmployeeLookup] = useState<EmployeeLookup>({});
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceDetailId, setMaintenanceDetailId] = useState<string | null>(null);

  const loadPortal = useCallback(async () => {
    if (!isAuthenticated()) {
      setError("Sign in is required to view this asset.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await assetInformationPortalService.getPortal(assetId);
      setPortal(data);
    } catch (err) {
      setPortal(null);
      setError(portalErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  const loadHistory = useCallback(async () => {
    if (!isAuthenticated()) return;
    setHistoryLoading(true);
    try {
      const [asnRes, maintRes, docRes, empDir, timeline] = await Promise.all([
        resourceService.list(`/assets/asset-assignments?asset_id=${assetId}&page_size=50`),
        resourceService.list(`/assets/asset-maintenances?asset_id=${assetId}&page_size=50`),
        resourceService.list(`/assets/asset-documents?asset_id=${assetId}&page_size=50`),
        listEmployeeDirectory().catch(() => [] as EmployeeDirectoryEntry[]),
        assetInformationPortalService
          .getLifecycleTimeline(assetId)
          .catch(() => [] as AssetLifecycleTimelineEvent[]),
      ]);
      const pick = (data: unknown) => {
        if (data && typeof data === "object" && "items" in data) {
          return (data as { items: AssetsRow[] }).items ?? [];
        }
        return Array.isArray(data) ? data : [];
      };
      setAssignments(pick(asnRes.data));
      setMaintenances(pick(maintRes.data));
      setDocuments(pick(docRes.data));
      setLifecycleEvents(timeline);
      const byId = employeeDirectoryById(empDir);
      const lookup: EmployeeLookup = {};
      for (const [id, e] of Object.entries(byId)) {
        lookup[id] = {
          label: e.label,
          displayName: e.displayName,
          employeeCode: e.employeeCode,
          mobile: e.mobile,
        };
      }
      setEmployeeLookup(lookup);
    } catch {
      // History tabs degrade gracefully; core portal payload still works.
    } finally {
      setHistoryLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const assignmentHistory = useMemo(
    () => mapAssignmentHistoryEntries(assignments, employeeLookup),
    [assignments, employeeLookup],
  );

  const assignmentTimeline = useMemo(() => {
    const byId = new Map(assignments.map((row) => [String(row.id ?? ""), row]));
    return buildAssignmentTimeline(
      assignmentHistory.map((entry) => {
        const raw = byId.get(entry.id);
        return {
          ...entry,
          allocatedAtRaw:
            raw?.allocated_at != null
              ? String(raw.allocated_at)
              : raw?.created_at != null
                ? String(raw.created_at)
                : null,
          returnedAtRaw: raw?.returned_at != null ? String(raw.returned_at) : null,
        };
      }),
    );
  }, [assignmentHistory, assignments]);

  const maintenanceRows = useMemo(
    () =>
      [...maintenances]
        .filter((row) => String(row.status ?? "").toLowerCase() !== "draft")
        .sort((a, b) => {
          const aAt = String(
            a.completed_date ?? a.scheduled_date ?? a.created_at ?? a.updated_at ?? "",
          );
          const bAt = String(
            b.completed_date ?? b.scheduled_date ?? b.created_at ?? b.updated_at ?? "",
          );
          return bAt.localeCompare(aAt);
        }),
    [maintenances],
  );

  const maintenanceTimeline = useMemo(
    () => buildMaintenanceTimeline(maintenanceRows),
    [maintenanceRows],
  );

  const activityTimeline = useMemo(() => {
    if (lifecycleEvents.length > 0) {
      return mapApiLifecycleEvents(lifecycleEvents);
    }
    return buildClientLifecycleTimeline({
      assetId,
      assetCode: portal?.asset_code,
      assetName: portal?.asset_name,
      createdAt: portal?.created_at ?? null,
      updatedAt: portal?.updated_at ?? null,
      assignments: assignmentHistory.map((entry) => {
        const raw = assignments.find((a) => String(a.id ?? "") === entry.id);
        return {
          ...entry,
          allocatedAtRaw:
            raw?.allocated_at != null
              ? String(raw.allocated_at)
              : raw?.created_at != null
                ? String(raw.created_at)
                : null,
          returnedAtRaw: raw?.returned_at != null ? String(raw.returned_at) : null,
        };
      }),
      maintenances,
    });
  }, [
    assetId,
    assignmentHistory,
    assignments,
    lifecycleEvents,
    maintenances,
    portal?.asset_code,
    portal?.asset_name,
    portal?.created_at,
    portal?.updated_at,
  ]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading asset information portal…
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="mx-auto max-w-lg space-y-3 px-1" data-testid="asset-information-portal-error">
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm text-destructive">
          {error ?? "Asset not found"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            onClick={() =>
              router.push(
                `/login?next=${encodeURIComponent(
                  `/assets/information-portal/${assetId}?from=qr`,
                )}`,
              )
            }
          >
            Sign in
          </Button>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => router.push("/assets/assets")}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to assets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-4"
      data-testid="asset-information-portal"
      data-from-qr={fromQr ? "true" : undefined}
    >
      <PageHeader
        title="Asset Information Portal"
        titleClassName="capitalize"
        actions={
          <div className="flex flex-wrap gap-2">
            {!fromQr ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => router.push("/assets/assets")}
              >
                <ArrowLeft className="size-4" aria-hidden />
                Register
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => {
                void loadPortal();
                void loadHistory();
              }}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <div
        className="-mx-1 sticky top-0 z-10 flex flex-nowrap gap-2 overflow-x-auto border-b border-border/70 bg-background/95 px-1 pb-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:flex-wrap sm:overflow-visible"
        role="tablist"
        aria-label="Information Portal sections"
      >
        {PORTAL_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            data-testid={`portal-tab-${item.id}`}
            onClick={() => setTab(item.id)}
            className={`shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors duration-200 ${
              tab === item.id
                ? "bg-primary/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
          {fromQr ? (
            <p
              className="rounded-lg border border-sky-500/30 bg-sky-50 px-3 py-2 text-sm text-sky-900"
              role="status"
              data-testid="portal-scanned-banner"
            >
              Scanned QR — asset details below. Sign-in is required; only authorized Asset
              Management users can view this portal.
            </p>
          ) : null}
          {tab === "assignments" ? (
            <PortalSection
              title="Assignment History"
              loading={historyLoading}
              empty={assignmentTimeline.length === 0}
            >
              <PortalLifecycleTimeline
                events={assignmentTimeline}
                emptyTitle="No assignment history"
                emptyDescription="Assignment and return cycles will appear here once this asset is issued."
                testId="portal-assignment-history"
              />
            </PortalSection>
          ) : null}

          {tab === "maintenance" ? (
            <PortalSection
              title="Maintenance History"
              loading={historyLoading}
              empty={false}
            >
              <div className="space-y-6" data-testid="portal-maintenance-history">
                <section className="space-y-3" aria-labelledby="portal-maintenance-timeline-heading">
                  <h3
                    id="portal-maintenance-timeline-heading"
                    className="text-sm font-semibold tracking-tight text-foreground"
                  >
                    Timeline
                  </h3>
                  <PortalLifecycleTimeline
                    events={maintenanceTimeline.map((event) => ({
                      ...event,
                      action: event.maintenanceId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 cursor-pointer transition-colors duration-200"
                          data-testid={`portal-maintenance-view-${event.maintenanceId}`}
                          onClick={() => setMaintenanceDetailId(event.maintenanceId)}
                        >
                          <Eye className="mr-1 size-3.5" aria-hidden />
                          View Details
                        </Button>
                      ) : null,
                    }))}
                    emptyTitle="No maintenance history"
                    emptyDescription="Maintenance cycles will appear here when work orders are started or completed."
                    testId="portal-maintenance-timeline"
                  />
                </section>

                <section className="space-y-3" aria-labelledby="portal-maintenance-table-heading">
                  <h3
                    id="portal-maintenance-table-heading"
                    className="text-sm font-semibold tracking-tight text-foreground"
                  >
                    Work order columns
                  </h3>
                  <MaintenanceHistoryTable
                    rows={maintenanceRows}
                    onViewDetails={(id) => setMaintenanceDetailId(id)}
                  />
                </section>
              </div>
            </PortalSection>
          ) : null}

          {tab === "documents" ? (
            <PortalSection
              title="Documents"
              loading={historyLoading}
              empty={documents.length === 0}
            >
              <SimpleHistoryTable
                rows={documents}
                columns={[
                  ["document_name", "Name"],
                  ["document_type", "Type"],
                  ["status", "Status"],
                ]}
              />
            </PortalSection>
          ) : null}

          {tab === "activity" ? (
            <PortalSection
              title="Activity Logs"
              loading={historyLoading}
              empty={activityTimeline.length === 0}
            >
              <Card className="border-border/80 shadow-sm">
                <CardContent className="pt-5">
                  <PortalLifecycleTimeline
                    events={activityTimeline}
                    emptyTitle="No activity yet"
                    emptyDescription="Lifecycle events will appear here as this asset is created, assigned, maintained, or updated."
                    testId="portal-activity-timeline"
                  />
                </CardContent>
              </Card>
            </PortalSection>
          ) : null}

          {tab === "discovery" ? (
            <AssetDiscoveryPanel
              assetId={assetId}
              assetVersion={portal.version ?? 1}
              currentProfile={portal.discovery_profile_json}
              onApplied={() => void loadPortal()}
            />
          ) : null}
      </div>

      <MaintenanceWorkOrderDetailDrawer
        open={maintenanceDetailId != null}
        maintenanceId={maintenanceDetailId}
        onClose={() => setMaintenanceDetailId(null)}
        onUpdated={() => {
          void loadHistory();
        }}
      />
    </div>
  );
}

function PortalSection({
  title,
  description,
  loading,
  empty,
  children,
}: {
  title: string;
  description?: string;
  loading: boolean;
  empty: boolean;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading {title.toLowerCase()}…
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {empty ? (
        <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No records.
        </p>
      ) : (
        children
      )}
    </div>
  );
}

function SimpleHistoryTable({
  rows,
  columns,
}: {
  rows: AssetsRow[];
  columns: Array<[string, string]>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className={tableSerialHeaderClassName()} scope="col">
              {TABLE_SERIAL_HEADER_LABEL}
            </th>
            {columns.map(([key, label]) => (
              <th key={key} className="px-3 py-2">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)} className="border-t">
              <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
              {columns.map(([key]) => (
                <td key={key} className="px-3 py-2">
                  {dash(row[key] != null ? String(row[key]) : null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatMaintenanceStatusLabel(status?: string | null): string {
  const raw = String(status ?? "").trim();
  if (!raw) return "—";
  return raw.replace(/_/g, " ");
}

function maintenanceStatusBadgeClass(status?: string | null): string {
  const s = String(status ?? "").toLowerCase();
  if (s === "completed") return "border-teal-200 bg-teal-50 text-teal-800";
  if (s === "in_progress") return "border-amber-200 bg-amber-50 text-amber-900";
  if (s === "cancelled" || s === "canceled") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-border bg-muted/40 text-muted-foreground";
}

function MaintenanceHistoryTable({
  rows,
  onViewDetails,
}: {
  rows: AssetsRow[];
  onViewDetails: (maintenanceId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center"
        data-testid="portal-maintenance-table"
      >
        <p className="text-sm font-medium text-foreground">No work orders</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Document, type, status, entered, and completed columns appear when maintenance is recorded
          for this asset.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/80" data-testid="portal-maintenance-table">
      <table className="w-full min-w-[64rem] text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className={tableSerialHeaderClassName()} scope="col">
              {TABLE_SERIAL_HEADER_LABEL}
            </th>
            <th className="px-3 py-2 font-medium">Document</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Entered</th>
            <th className="px-3 py-2 font-medium">Completed</th>
            <th className="px-3 py-2 font-medium">Duration</th>
            <th className="px-3 py-2 font-medium">Expected Return</th>
            <th className="px-3 py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const id = String(row.id ?? "");
            const entered =
              row.created_at != null
                ? String(row.created_at)
                : row.scheduled_date != null
                  ? String(row.scheduled_date)
                  : null;
            const completed =
              row.completed_date != null
                ? String(row.completed_date)
                : null;
            const duration =
              row.expected_duration_days != null
                ? `${row.expected_duration_days}d`
                : "—";
            return (
              <tr
                key={id || String(index)}
                className="border-t border-border/60 transition-colors duration-200 hover:bg-muted/30"
              >
                <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {dash(row.document_number != null ? String(row.document_number) : null)}
                </td>
                <td className="px-3 py-2 capitalize">
                  {dash(
                    row.maintenance_type != null
                      ? String(row.maintenance_type).replace(/_/g, " ")
                      : null,
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={`shrink-0 capitalize ${maintenanceStatusBadgeClass(
                      row.status != null ? String(row.status) : null,
                    )}`}
                  >
                    {formatMaintenanceStatusLabel(
                      row.status != null ? String(row.status) : null,
                    )}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-xs text-muted-foreground">
                  {entered?.includes("T") ? formatPortalDateTime(entered) : formatPortalDate(entered)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-xs text-muted-foreground">
                  {formatPortalDate(completed)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{duration}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                  {formatPortalDate(
                    row.expected_return_date != null ? String(row.expected_return_date) : null,
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {id ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 cursor-pointer transition-colors duration-200"
                      data-testid={`portal-maintenance-table-view-${id}`}
                      onClick={() => onViewDetails(id)}
                    >
                      <Eye className="mr-1 size-3.5" aria-hidden />
                      View
                    </Button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
