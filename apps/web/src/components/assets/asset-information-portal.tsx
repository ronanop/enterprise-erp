"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Loader2,
  Printer,
  QrCode,
  Shield,
  UserRound,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import { AssetDiscoveryPanel } from "@/components/assets/asset-discovery-panel";
import {
  mapAssignmentHistoryEntries,
  type EmployeeLookup,
} from "@/components/assets/inventory/register-parity";
import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerialFromIndex,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
  StatusBadge,
  formatPortalOverviewStatus,
  isOperationalStatus,
} from "@/components/assets/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildRecentActivity } from "@/domain/asset-prd";
import { isAuthenticated } from "@/lib/auth";
import {
  employeeDirectoryById,
  listEmployeeDirectory,
  type EmployeeDirectoryEntry,
} from "@/lib/org-options";
import { ApiClientError, resourceService } from "@/services/api-client";
import {
  type AssetInformationPortal,
  type AssetsRow,
  assetInformationPortalService,
  buildSelfServiceUrl,
} from "@/services/assets-service";

function dash(value?: string | null): string {
  return value && String(value).trim() ? String(value) : "—";
}

function PortalOverviewStatus({
  operationalStatus,
  lifecycleStatus,
}: {
  operationalStatus?: string | null;
  lifecycleStatus?: string | null;
}) {
  const label = formatPortalOverviewStatus({
    operational_status: operationalStatus,
    status: lifecycleStatus,
  });
  const opsKey = String(operationalStatus ?? "")
    .trim()
    .replace(/-/g, "_")
    .toUpperCase();
  return (
    <div data-testid="portal-overview-status">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
      {label === "—" ? (
        <div className="mt-0.5">—</div>
      ) : isOperationalStatus(opsKey) ? (
        <div className="mt-1">
          <StatusBadge kind="operational" status={opsKey} />
        </div>
      ) : (
        <Badge variant="secondary" className="mt-1 text-xs">
          {label}
        </Badge>
      )}
    </div>
  );
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
  const [tab, setTab] = useState<PortalTab>("overview");
  const [portal, setPortal] = useState<AssetInformationPortal | null>(null);
  const [assignments, setAssignments] = useState<AssetsRow[]>([]);
  const [maintenances, setMaintenances] = useState<AssetsRow[]>([]);
  const [documents, setDocuments] = useState<AssetsRow[]>([]);
  const [employeeLookup, setEmployeeLookup] = useState<EmployeeLookup>({});
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrCanvasId = `asset-qr-${assetId}`;

  const selfServiceUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return portal?.self_service_path ?? `/assets/self-service/${assetId}`;
    }
    return buildSelfServiceUrl(assetId);
  }, [assetId, portal?.self_service_path]);

  const loadPortal = useCallback(async () => {
    if (!isAuthenticated()) {
      setError("Sign in required.");
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
      setError(err instanceof ApiClientError ? err.message : "Failed to load asset portal");
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  const loadHistory = useCallback(async () => {
    if (!isAuthenticated()) return;
    setHistoryLoading(true);
    try {
      const [asnRes, maintRes, docRes, empDir] = await Promise.all([
        resourceService.list(`/assets/asset-assignments?asset_id=${assetId}&page_size=50`),
        resourceService.list(`/assets/asset-maintenances?asset_id=${assetId}&page_size=50`),
        resourceService.list(`/assets/asset-documents?asset_id=${assetId}&page_size=50`),
        listEmployeeDirectory().catch(() => [] as EmployeeDirectoryEntry[]),
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

  const activity = useMemo(
    () =>
      buildRecentActivity(
        portal
          ? [
              {
                id: portal.asset_id,
                asset_code: portal.asset_code,
                asset_name: portal.asset_name,
                status: portal.status,
              } as AssetsRow,
            ]
          : [],
        assignments,
        maintenances,
        12,
      ),
    [portal, assignments, maintenances],
  );

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
      <p>${selfServiceUrl}</p>
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
      <div className="space-y-3">
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error ?? "Asset not found"}
        </p>
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          onClick={() => router.push("/assets/assets")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to assets
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="asset-information-portal">
      <PageHeader
        title="Asset Information Portal"
        description={`${portal.asset_code} — overview, history, documents, activity, and discovery.`}
        actions={
          <div className="flex flex-wrap gap-2">
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
        className="flex flex-wrap gap-2 border-b border-border/70 pb-2"
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
            className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors duration-200 ${
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
        <div className="space-y-4 lg:col-span-8">
          {tab === "overview" ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Overview</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                  <Field label="Asset code" value={portal.asset_code} mono />
                  <PortalOverviewStatus
                    operationalStatus={portal.operational_status}
                    lifecycleStatus={portal.status}
                  />
                  <Field label="Asset name" value={portal.asset_name} />
                  <Field label="Type" value={portal.asset_type} />
                  <Field
                    label="Category"
                    value={
                      portal.category_code
                        ? `${portal.category_code} — ${portal.category_name ?? ""}`
                        : portal.category_name
                    }
                  />
                  <Field label="Serial number" value={portal.serial_number} mono />
                  <Field label="Manufacturer" value={portal.manufacturer} />
                  <Field label="Model" value={portal.model} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserRound className="size-4" aria-hidden />
                    Assignment
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                  {portal.assignment ? (
                    <>
                      <Field label="Document" value={portal.assignment.document_number} mono />
                      <Field label="Status" value={portal.assignment.status} badge />
                      <Field label="Allocation" value={portal.assignment.allocation_type} />
                      <Field label="Assignee" value={portal.assignment.assignee_label} />
                    </>
                  ) : (
                    <p className="text-muted-foreground sm:col-span-2">No active assignment.</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Shield className="size-4" aria-hidden />
                      Warranty
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm">
                    {portal.warranty ? (
                      <>
                        <Field label="Type" value={portal.warranty.warranty_type} />
                        <Field label="Status" value={portal.warranty.status} badge />
                        <Field label="Start" value={portal.warranty.start_date} />
                        <Field label="End" value={portal.warranty.end_date} />
                      </>
                    ) : (
                      <p className="text-muted-foreground">No open warranty.</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Insurance</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm">
                    {portal.insurance ? (
                      <>
                        <Field label="Policy" value={portal.insurance.policy_number} mono />
                        <Field label="Insurer" value={portal.insurance.insurer_name} />
                        <Field label="Status" value={portal.insurance.status} badge />
                        <Field label="End" value={portal.insurance.end_date} />
                      </>
                    ) : (
                      <p className="text-muted-foreground">No open insurance policy.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}

          {tab === "assignments" ? (
            <PortalSection
              title="Assignment History"
              loading={historyLoading}
              empty={assignmentHistory.length === 0}
            >
              <AssignmentHistoryTable entries={assignmentHistory} />
            </PortalSection>
          ) : null}

          {tab === "maintenance" ? (
            <PortalSection
              title="Maintenance History"
              loading={historyLoading}
              empty={maintenances.length === 0}
            >
              <SimpleHistoryTable
                rows={maintenances}
                columns={[
                  ["document_number", "Document"],
                  ["status", "Status"],
                  ["maintenance_type", "Type"],
                  ["scheduled_date", "Scheduled"],
                ]}
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
            <PortalSection title="Activity Logs" loading={historyLoading} empty={activity.length === 0}>
              <Card>
                <CardContent className="divide-y pt-4">
                  {activity.map((item) => (
                    <div key={item.id} className="py-2 text-sm">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.at}</p>
                    </div>
                  ))}
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

        <div className="space-y-4 lg:col-span-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="size-4" aria-hidden />
                QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-center rounded-md border bg-white p-4">
                <QRCodeCanvas
                  id={qrCanvasId}
                  value={selfServiceUrl}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>
              <p className="break-all text-xs text-muted-foreground">{selfServiceUrl}</p>
              <p className="text-xs text-muted-foreground">
                QR is generated in the browser only — never stored on the server.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={downloadQr}
                >
                  <Download className="size-4" aria-hidden />
                  Download QR
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={printQr}
                >
                  <Printer className="size-4" aria-hidden />
                  Print QR
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={() => router.push(portal.self_service_path)}
                >
                  <ExternalLink className="size-4" aria-hidden />
                  Open Self-Service
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PortalSection({
  title,
  loading,
  empty,
  children,
}: {
  title: string;
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
  if (empty) {
    return <p className="text-sm text-muted-foreground">No records.</p>;
  }
  return <>{children}</>;
}

function AssignmentHistoryTable({
  entries,
}: {
  entries: ReturnType<typeof mapAssignmentHistoryEntries>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border" data-testid="portal-assignment-history">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className={tableSerialHeaderClassName()} scope="col">
              {TABLE_SERIAL_HEADER_LABEL}
            </th>
            <th className="px-3 py-2">Document</th>
            <th className="px-3 py-2">Assignee</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Issued</th>
            <th className="px-3 py-2">Returned</th>
            <th className="px-3 py-2">Delivery</th>
            <th className="px-3 py-2">Assignment remarks</th>
            <th className="px-3 py-2">Return remarks</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((row, index) => (
            <tr key={row.id} className="border-t">
              <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
              <td className="px-3 py-2 font-mono text-xs">{row.documentNumber}</td>
              <td className="px-3 py-2">{row.assigneeLabel}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.allocatedAt}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.returnedAt}</td>
              <td className="px-3 py-2">
                {row.deliveryChallanSummary ||
                  `${row.deliveryReferenceNumber}${
                    row.deliveryReferenceStatus !== "—"
                      ? ` (${row.deliveryReferenceStatus})`
                      : ""
                  }`}
              </td>
              <td className="max-w-[12rem] truncate px-3 py-2" title={row.assignmentRemarks}>
                {row.assignmentRemarks}
              </td>
              <td className="max-w-[12rem] truncate px-3 py-2" title={row.returnRemarks}>
                {row.returnRemarks}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

function Field({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  badge?: boolean;
}) {
  const display = dash(value);
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {badge && display !== "—" ? (
        <Badge variant="secondary" className="mt-1 font-mono text-xs">
          {display}
        </Badge>
      ) : (
        <div className={`mt-0.5 ${mono ? "font-mono text-xs" : ""}`}>{display}</div>
      )}
    </div>
  );
}
