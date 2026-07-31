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

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const row = await assetRegisterService.get(assetId);
      setAsset(row);
      const [asnRes, maintRes, docRes] = await Promise.all([
        resourceService.list(`/assets/asset-assignments?asset_id=${assetId}&page_size=50`),
        resourceService.list(`/assets/asset-maintenances?asset_id=${assetId}&page_size=50`),
        resourceService.list(`/assets/asset-documents?asset_id=${assetId}&page_size=50`),
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
        <HistoryList
          rows={assignments}
          columns={["document_number", "status", "allocation_type", "allocated_at"]}
        />
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
