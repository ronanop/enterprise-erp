"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, QrCode, UserPlus, Wrench } from "lucide-react";

import { AssetDiscoveryPanel } from "@/components/assets/asset-discovery-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  brandModelLabel,
  buildRecentActivity,
  isItAssetCategory,
  mapAssetToPrdStatus,
  parseDiscoveryProfile,
  prdStatusLabel,
} from "@/domain/asset-prd";
import { isAuthenticated } from "@/lib/auth";
import { listEmployeeOptions } from "@/lib/org-options";
import {
  buildRegisterParityExpandable,
  deriveEarlierUsedBy,
  formatDeliveryReferenceStatus,
  mapAssignmentHistoryEntries,
  pickRegisterAssignment,
  resolveAssigneeLabel,
} from "@/components/assets/inventory/register-parity";
import {
  assetRegisterService,
  type AssetsRow,
} from "@/services/assets-service";
import { ApiClientError, resourceService } from "@/services/api-client";

type Tab = "overview" | "assignments" | "maintenance" | "documents" | "activity";

export function AssetDetailWorkspace({ assetId }: { assetId: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [asset, setAsset] = useState<AssetsRow | null>(null);
  const [assignments, setAssignments] = useState<AssetsRow[]>([]);
  const [maintenances, setMaintenances] = useState<AssetsRow[]>([]);
  const [documents, setDocuments] = useState<AssetsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [employeeLabels, setEmployeeLabels] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const row = await assetRegisterService.get(assetId);
      setAsset(row);
      const [asnRes, maintRes, docRes, empOpts] = await Promise.all([
        resourceService.list(`/assets/asset-assignments?asset_id=${assetId}&page_size=50`),
        resourceService.list(`/assets/asset-maintenances?asset_id=${assetId}&page_size=50`),
        resourceService.list(`/assets/asset-documents?asset_id=${assetId}&page_size=50`),
        listEmployeeOptions().catch(() => []),
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
      setEmployeeLabels(Object.fromEntries(empOpts.map((e) => [e.id, e.label])));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load asset");
      setAsset(null);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const prdStatus = useMemo(
    () => (asset ? mapAssetToPrdStatus(asset, assignments) : "available"),
    [asset, assignments],
  );

  const activeAssignment = useMemo(
    () =>
      assignments.find((a) => {
        const s = String(a.status ?? "").toLowerCase();
        return s === "active" || s === "approved";
      }),
    [assignments],
  );

  async function returnActive() {
    if (!activeAssignment) return;
    setReturning(true);
    try {
      await resourceService.action(
        "/assets/asset-assignments",
        String(activeAssignment.id),
        "return",
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Return failed");
    } finally {
      setReturning(false);
    }
  }

  const activity = useMemo(
    () =>
      buildRecentActivity(
        asset ? [asset] : [],
        assignments,
        maintenances,
        12,
      ),
    [asset, assignments, maintenances],
  );

  const registerParity = useMemo(() => {
    const expandable = buildRegisterParityExpandable(assignments, employeeLabels);
    const current = pickRegisterAssignment(assignments);
    return {
      expandable,
      currentHolder: resolveAssigneeLabel(current, employeeLabels),
      earlierUsedBy: deriveEarlierUsedBy(assignments, employeeLabels),
      deliveryStatus: formatDeliveryReferenceStatus(current?.delivery_reference_status as string),
      history: mapAssignmentHistoryEntries(assignments, employeeLabels),
    };
  }, [assignments, employeeLabels]);

  const profile = asset ? parseDiscoveryProfile(asset) : null;
  const showIt = isItAssetCategory(
    asset?.category_code as string | undefined,
    asset?.category_name as string | undefined,
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!asset) {
    return (
      <p className="text-destructive" role="alert">
        {error ?? "Asset not found"}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={String(asset.asset_name ?? "Asset")}
        description={`${asset.asset_code ?? ""} · ${prdStatusLabel(prdStatus)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild className="cursor-pointer">
              <Link href={`/assets/asset-assignments?assetId=${assetId}`}>
                <UserPlus className="mr-1 size-4" />
                Assign
              </Link>
            </Button>
            {activeAssignment ? (
              <Button
                variant="outline"
                size="sm"
                disabled={returning}
                onClick={() => void returnActive()}
                className="cursor-pointer"
              >
                Return
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild className="cursor-pointer">
              <Link href={`/assets/asset-maintenances?assetId=${assetId}`}>
                <Wrench className="mr-1 size-4" />
                Maintenance
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="cursor-pointer">
              <Link href={`/assets/qr-barcode?assetId=${assetId}`}>
                <QrCode className="mr-1 size-4" />
                QR
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-border/70 pb-2">
        {(
          [
            ["overview", "Overview"],
            ["assignments", "Assignment history"],
            ["maintenance", "Maintenance history"],
            ["documents", "Documents"],
            ["activity", "Activity logs"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors duration-200 ${
              tab === key
                ? "bg-primary/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Status: </span>
                <Badge variant="secondary">{prdStatusLabel(prdStatus)}</Badge>
              </p>
              <p>
                <span className="text-muted-foreground">Operational: </span>
                {String(asset.operational_status ?? "—")}
              </p>
              <p>
                <span className="text-muted-foreground">Type: </span>
                {String(asset.asset_type ?? "—")}
              </p>
              <p>
                <span className="text-muted-foreground">Brand / model: </span>
                {brandModelLabel(asset)}
              </p>
              <p>
                <span className="text-muted-foreground">Serial: </span>
                {String(asset.serial_number ?? "—")}
              </p>
            </CardContent>
          </Card>
          <Card data-testid="asset-detail-register-parity">
            <CardHeader>
              <CardTitle className="text-base">Register parity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Current holder: </span>
                {registerParity.currentHolder}
              </p>
              <p>
                <span className="text-muted-foreground">Earlier used by: </span>
                <span data-testid="asset-detail-earlier-used-by">{registerParity.earlierUsedBy}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Delivery reference: </span>
                <span data-testid="asset-detail-delivery-reference">
                  {registerParity.expandable.deliveryChallan}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Delivery status: </span>
                {registerParity.deliveryStatus}
              </p>
              <p>
                <span className="text-muted-foreground">Assignment remarks: </span>
                <span className="whitespace-pre-wrap" data-testid="asset-detail-assignment-remarks">
                  {registerParity.expandable.assignmentRemarks}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Return remarks: </span>
                <span className="whitespace-pre-wrap" data-testid="asset-detail-return-remarks">
                  {registerParity.expandable.returnRemarks}
                </span>
              </p>
            </CardContent>
          </Card>
          {showIt ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Technical (IT)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {profile ? (
                  <ul className="space-y-1">
                    {profile.hostname ? <li>Hostname: {profile.hostname}</li> : null}
                    {profile.mac_address ? <li>MAC: {profile.mac_address}</li> : null}
                    {profile.os_name ? <li>OS: {profile.os_name}</li> : null}
                  </ul>
                ) : (
                  <p>No discovery profile yet.</p>
                )}
                <div className="mt-4">
                  <AssetDiscoveryPanel
                    assetId={assetId}
                    assetVersion={Number(asset.version ?? 1)}
                    currentProfile={
                      (asset.discovery_profile_json as Record<string, unknown> | null) ?? null
                    }
                    onApplied={() => void load()}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "assignments" ? (
        <AssignmentHistoryDetailList entries={registerParity.history} />
      ) : null}
      {tab === "maintenance" ? (
        <HistoryList
          rows={maintenances}
          columns={["document_number", "status", "maintenance_type", "scheduled_date"]}
        />
      ) : null}
      {tab === "documents" ? (
        <HistoryList
          rows={documents}
          columns={["document_name", "document_type", "status"]}
        />
      ) : null}
      {tab === "activity" ? (
        <Card>
          <CardContent className="divide-y pt-4">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="py-2 text-sm">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.at}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function AssignmentHistoryDetailList({
  entries,
}: {
  entries: ReturnType<typeof mapAssignmentHistoryEntries>;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No records.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border" data-testid="asset-detail-assignment-history">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
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
          {entries.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="px-3 py-2 font-mono text-xs">{row.documentNumber}</td>
              <td className="px-3 py-2">{row.assigneeLabel}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.allocatedAt}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.returnedAt}</td>
              <td className="px-3 py-2">
                {row.deliveryReferenceNumber}
                {row.deliveryReferenceStatus !== "—" ? ` (${row.deliveryReferenceStatus})` : ""}
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

function HistoryList({
  rows,
  columns,
}: {
  rows: AssetsRow[];
  columns: string[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No records.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 capitalize">
                {c.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.id)} className="border-t">
              {columns.map((c) => (
                <td key={c} className="px-3 py-2">
                  {String(row[c] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
