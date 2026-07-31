"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, QrCode, Save, UserPlus, Wrench } from "lucide-react";

import { AssetDiscoveryPanel } from "@/components/assets/asset-discovery-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  brandModelLabel,
  buildRecentActivity,
  isItAssetCategory,
  mapAssetToPrdStatus,
  parseDiscoveryProfile,
  prdStatusLabel,
} from "@/domain/asset-prd";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  assetLocationService,
  assetRegisterService,
  documentService,
  type AssetsRow,
} from "@/services/assets-service";
import { ApiClientError, resourceService } from "@/services/api-client";

type Tab = "overview" | "assignments" | "maintenance" | "documents" | "activity";

export function AssetDetailWorkspace({ assetId }: { assetId: string }) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("overview");
  const [asset, setAsset] = useState<AssetsRow | null>(null);
  const [assignments, setAssignments] = useState<AssetsRow[]>([]);
  const [maintenances, setMaintenances] = useState<AssetsRow[]>([]);
  const [documents, setDocuments] = useState<AssetsRow[]>([]);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({ asset_name: "", serial_number: "" });
  const [docForm, setDocForm] = useState({
    document_name: "",
    document_type: "other",
    storage_uri: "",
  });
  const [docSaving, setDocSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const row = await assetRegisterService.get(assetId);
      setAsset(row);
      setEditForm({
        asset_name: String(row.asset_name ?? ""),
        serial_number: String(row.serial_number ?? ""),
      });
      const [asnRes, maintRes, docRes, locRes] = await Promise.all([
        resourceService.list(`/assets/asset-assignments?asset_id=${assetId}&page_size=50`),
        resourceService.list(`/assets/asset-maintenances?asset_id=${assetId}&page_size=50`),
        resourceService.list(`/assets/asset-documents?asset_id=${assetId}&page_size=50`),
        assetLocationService.search({ asset_id: assetId, page_size: 5, is_current: true }),
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
      const loc = locRes.items[0];
      setCurrentLocation(loc ? String(loc.location_label ?? "") : null);
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

  useEffect(() => {
    if (searchParams.get("edit") === "1") {
      setEditing(true);
      setTab("overview");
    }
  }, [searchParams]);

  async function saveEdit() {
    if (!asset) return;
    setSavingEdit(true);
    setError(null);
    try {
      await assetRegisterService.update(assetId, {
        asset_name: editForm.asset_name.trim(),
        serial_number: editForm.serial_number.trim() || null,
        version: Number(asset.version ?? 1),
      });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Save failed");
    } finally {
      setSavingEdit(false);
    }
  }

  async function addDocument() {
    if (!docForm.document_name.trim()) return;
    setDocSaving(true);
    try {
      await documentService.create({
        asset_id: assetId,
        document_type: docForm.document_type,
        document_name: docForm.document_name.trim(),
        storage_uri: docForm.storage_uri.trim() || undefined,
      });
      setDocForm({ document_name: "", document_type: "other", storage_uri: "" });
      await load();
      setTab("documents");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to add document");
    } finally {
      setDocSaving(false);
    }
  }

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
            <Link
              href={`/assets/asset-assignments?assetId=${assetId}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}
            >
              <UserPlus className="mr-1 size-4" />
              Assign
            </Link>
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
            <Link
              href={`/assets/asset-maintenances?assetId=${assetId}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}
            >
              <Wrench className="mr-1 size-4" />
              Maintenance
            </Link>
            <Link
              href={`/assets/qr-barcode?assetId=${assetId}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}
            >
              <QrCode className="mr-1 size-4" />
              QR
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Cancel edit" : "Edit"}
            </Button>
          </div>
        }
      />

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit asset</CardTitle>
          </CardHeader>
          <CardContent className="grid max-w-md gap-3">
            <div>
              <Label>Asset name</Label>
              <Input
                className="mt-1"
                value={editForm.asset_name}
                onChange={(e) => setEditForm((f) => ({ ...f, asset_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Serial number</Label>
              <Input
                className="mt-1"
                value={editForm.serial_number}
                onChange={(e) => setEditForm((f) => ({ ...f, serial_number: e.target.value }))}
              />
            </div>
            <Button
              size="sm"
              disabled={savingEdit}
              onClick={() => void saveEdit()}
              className="w-fit cursor-pointer"
            >
              <Save className="mr-1 size-4" />
              Save changes
            </Button>
          </CardContent>
        </Card>
      ) : null}

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
              <p>
                <span className="text-muted-foreground">Location: </span>
                {currentLocation ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">QR: </span>
                {String(asset.qr_code ?? "—")}
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
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add document</CardTitle>
            </CardHeader>
            <CardContent className="grid max-w-lg gap-3">
              <div>
                <Label htmlFor="doc-name">Name</Label>
                <Input
                  id="doc-name"
                  className="mt-1"
                  value={docForm.document_name}
                  onChange={(e) => setDocForm((f) => ({ ...f, document_name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="doc-type">Type</Label>
                <Input
                  id="doc-type"
                  className="mt-1"
                  value={docForm.document_type}
                  onChange={(e) => setDocForm((f) => ({ ...f, document_type: e.target.value }))}
                  placeholder="invoice, warranty, other"
                />
              </div>
              <div>
                <Label htmlFor="doc-uri">Storage URI (optional)</Label>
                <Input
                  id="doc-uri"
                  className="mt-1"
                  value={docForm.storage_uri}
                  onChange={(e) => setDocForm((f) => ({ ...f, storage_uri: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
              <Button
                size="sm"
                disabled={docSaving || !docForm.document_name.trim()}
                onClick={() => void addDocument()}
                className="w-fit cursor-pointer"
              >
                {docSaving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                Save document
              </Button>
            </CardContent>
          </Card>
          <HistoryList
            rows={documents}
            columns={["document_name", "document_type", "status"]}
          />
        </div>
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
