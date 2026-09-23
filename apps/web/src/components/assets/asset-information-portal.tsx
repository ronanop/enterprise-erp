"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AssetDiscoveryPanel } from "@/components/assets/asset-discovery-panel";
import { MaintenanceWorkOrderDetailDrawer } from "@/components/assets/maintenance-work-order-detail-drawer";
import { PortalLifecycleTimeline } from "@/components/assets/portal/portal-lifecycle-timeline";
import { PortalOverviewPanel } from "@/components/assets/portal/portal-overview-panel";
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
  buildAssetQrUrl,
} from "@/services/assets-service";
import { Eye, ArrowLeft, Download, ExternalLink, Loader2, Printer, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

function dash(value?: string | null): string {
  return value && String(value).trim() ? String(value) : "—";
}

function portalErrorMessage(err: unknown): string {
  if (!(err instanceof ApiClientError)) {
    return "Failed to load asset portal";
  }
  const status = typeof err.status === "number" ? err.status : null;
  if (status === 401) {
    return "Sign in with Microsoft is required to view this asset.";
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
  | "overview"
  | "assignments"
  | "maintenance"
  | "documents"
  | "activity"
  | "discovery";

const PORTAL_TABS: Array<{ id: PortalTab; label: string }> = [
  { id: "overview", label: "Overview" },
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
  const [tab, setTab] = useState<PortalTab>("overview");
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
  const qrCanvasId = `asset-qr-${assetId}`;

  const qrUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return (
        portal?.self_service_path ??
        `/assets/information-portal/${encodeURIComponent(assetId)}?from=qr`
      );
    }
    return buildAssetQrUrl(assetId);
  }, [assetId, portal?.self_service_path]);

  const loadPortal = useCallback(async () => {
    if (!isAuthenticated()) {
      setError("Sign in with Microsoft is required to view this asset.");
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
      // History tabs degrade gracefully; portal overview still works.
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

  const maintenanceTimeline = useMemo(
    () => buildMaintenanceTimeline(maintenances),
    [maintenances],
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

  function getQrCanvas(): HTMLCanvasElement | null {
    return document.getElementById(qrCanvasId) as HTMLCanvasElement | null;
  }

  function downloadQr() {
    const canvas = getQrCanvas();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${portal?.asset_code ?? "asset"}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function printQr() {
    const canvas = getQrCanvas();
    if (!canvas || !portal) return;
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>QR ${portal.asset_code}</title>
      <style>
        body{font-family:system-ui,sans-serif;text-align:center;padding:24px;color:#111}
        img{width:240px;height:240px}
        h1{font-size:18px;margin:12px 0 4px}
        p{font-size:12px;color:#444;word-break:break-all}
      </style></head><body>
      <h1>${portal.asset_code}</h1>
      <div>${portal.asset_name}</div>
      <img src="${dataUrl}" alt="QR" />
      <p>${qrUrl}</p>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    win.document.close();
  }

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
            Sign in with Microsoft
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
        description={
          fromQr
            ? `${portal.asset_code} — scanned asset profile (authenticated).`
            : `${portal.asset_code} — overview, history, documents, activity, and discovery.`
        }
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

      <div className="grid gap-4 lg:grid-cols-12">
        <div className={`space-y-4 ${fromQr ? "lg:col-span-12" : "order-2 lg:order-1 lg:col-span-8"}`}>
          {tab === "overview" ? <PortalOverviewPanel portal={portal} /> : null}

          {tab === "assignments" ? (
            <PortalSection
              title="Assignment History"
              description="Who used this asset, when it was assigned, and when it was returned."
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
              description="Each maintenance cycle — when it started, when it completed, and work-order details."
              loading={historyLoading}
              empty={maintenanceTimeline.length === 0}
            >
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
                testId="portal-maintenance-history"
              />
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
              description="Complete lifecycle — creation, assignments, maintenance cycles, edits, and status changes."
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

        <div className="order-1 space-y-4 lg:order-2 lg:col-span-4">
          {fromQr ? null : (
            <section className="overflow-hidden rounded-xl border border-indigo-500/30 bg-card/80 shadow-sm lg:sticky lg:top-14">
              <div className="border-b border-border/60 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200">
                    <QrCode className="size-3.5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <span className="inline-flex rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-800 ring-1 ring-inset ring-indigo-200">
                      Scan target
                    </span>
                    <h3 className="mt-1 text-sm font-medium text-foreground">QR Code</h3>
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex justify-center rounded-xl border border-border/70 bg-white p-4 shadow-sm">
                  <QRCodeCanvas
                    id={qrCanvasId}
                    value={qrUrl}
                    size={200}
                    level="M"
                    includeMargin
                  />
                </div>
                <p className="break-all font-mono text-[11px] text-muted-foreground">{qrUrl}</p>
                <p className="text-xs text-muted-foreground">
                  Scanning opens Microsoft sign-in, then this Information Portal for authorized Asset
                  Management users. QR is generated in the browser only — never stored on the server.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full cursor-pointer transition-colors duration-200"
                    onClick={downloadQr}
                  >
                    <Download className="size-4" aria-hidden />
                    Download QR
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full cursor-pointer transition-colors duration-200"
                    onClick={printQr}
                  >
                    <Printer className="size-4" aria-hidden />
                    Print QR
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full cursor-pointer transition-colors duration-200"
                    onClick={() => window.open(qrUrl, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Open scan link
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>
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
