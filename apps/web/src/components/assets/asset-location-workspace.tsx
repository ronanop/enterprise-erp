"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin, RefreshCw, SquarePen } from "lucide-react";
import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";


import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isAuthenticated } from "@/lib/auth";
import {
  type AssetLocationListResult,
  type AssetLocationRow,
  assetLocationService,
} from "@/services/assets-service";
import { ApiClientError, resourceService } from "@/services/api-client";

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  branch_id: string;
  status: string;
};

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

const STATUS_OPTIONS = ["", "active", "historical"] as const;
const CURRENT_OPTIONS = ["", "true", "false"] as const;

function parseListItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as ListPayload<T>).items;
    return Array.isArray(items) ? items : [];
  }
  return [];
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return value.slice(0, 16).replace("T", " ");
}

export function AssetLocationWorkspace() {
  const assetsPath = "/assets/assets";

  const [rows, setRows] = useState<AssetLocationRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<AssetLocationRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [currentFilter, setCurrentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    asset_id: "",
    branch_id: "",
    location_label: "",
    org_location_id: "",
    effective_from: "",
  });
  const [edit, setEdit] = useState({
    location_label: "",
    org_location_id: "",
    effective_from: "",
    effective_to: "",
  });

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const canEdit = Boolean(selected?.status === "active");
  const canComplete = Boolean(selected?.status === "active" && selected?.is_current);

  const loadAssets = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const active = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=100&status=active`,
      );
      const maintenance = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=100&status=in_maintenance`,
      );
      const transferred = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=100&status=transferred`,
      );
      const merged = [
        ...parseListItems<AssetRow>(active.data),
        ...parseListItems<AssetRow>(maintenance.data),
        ...parseListItems<AssetRow>(transferred.data),
      ];
      const seen = new Set<string>();
      setAssetOptions(
        merged.filter((row) => {
          if (seen.has(row.id)) return false;
          seen.add(row.id);
          return true;
        }),
      );
    } catch {
      setAssetOptions([]);
    }
  }, [assetsPath]);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await assetLocationService.search({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
        is_current:
          currentFilter === "true" ? true : currentFilter === "false" ? false : undefined,
        q: search.trim() || undefined,
      });
      setRows(payload.items);
      setTotal(payload.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load locations");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, currentFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!selected) return;
    setEdit({
      location_label: selected.location_label,
      org_location_id: selected.org_location_id ?? "",
      effective_from: selected.effective_from?.slice(0, 16) ?? "",
      effective_to: selected.effective_to?.slice(0, 16) ?? "",
    });
  }, [selected]);

  async function refreshSelected(id: string) {
    try {
      const row = await assetLocationService.get(id);
      setSelected(row);
    } catch {
      setSelected(null);
    }
  }

  async function createLocation() {
    if (!draft.asset_id) {
      setError("Select an asset.");
      return;
    }
    if (!draft.location_label.trim()) {
      setError("Location label is required.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await assetLocationService.create({
        asset_id: draft.asset_id,
        branch_id: draft.branch_id || undefined,
        location_label: draft.location_label.trim(),
        org_location_id: draft.org_location_id.trim() || undefined,
        effective_from: draft.effective_from
          ? new Date(draft.effective_from).toISOString()
          : undefined,
      });
      setDraft({
        asset_id: "",
        branch_id: "",
        location_label: "",
        org_location_id: "",
        effective_from: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create location");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveEdit() {
    if (!selected || !canEdit) return;
    setActionLoading(true);
    setError(null);
    try {
      await assetLocationService.update(selected.id, {
        location_label: edit.location_label.trim(),
        org_location_id: edit.org_location_id.trim() || null,
        effective_from: edit.effective_from
          ? new Date(edit.effective_from).toISOString()
          : null,
        effective_to: edit.effective_to ? new Date(edit.effective_to).toISOString() : null,
        version: selected.version,
      });
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update location");
    } finally {
      setActionLoading(false);
    }
  }

  async function completeLocation() {
    if (!selected || !canComplete) return;
    setActionLoading(true);
    setError(null);
    try {
      await assetLocationService.complete(selected.id);
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to complete location");
    } finally {
      setActionLoading(false);
    }
  }

  const statusBadge = (row: AssetLocationRow) => (
    <div className="flex flex-wrap gap-1">
      <Badge variant="secondary" className="font-mono text-xs">
        {row.status}
      </Badge>
      {row.is_current ? (
        <Badge variant="outline" className="font-mono text-xs">
          current
        </Badge>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset locations"
        description="Physical location history per asset — create, update metadata, complete. No approval workflow."
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Location records</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input
                aria-label="Search locations"
                placeholder="Search label or asset"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                className="max-w-xs"
              />
              <Select
                value={statusFilter || "__all"}
                onValueChange={(value) => {
                  setPage(1);
                  setStatusFilter(value === "__all" ? "" : value);
                }}
              >
                <SelectTrigger className="w-36 cursor-pointer" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all" className="cursor-pointer">
                    All statuses
                  </SelectItem>
                  {STATUS_OPTIONS.filter(Boolean).map((status) => (
                    <SelectItem key={status} value={status} className="cursor-pointer">
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={currentFilter || "__all"}
                onValueChange={(value) => {
                  setPage(1);
                  setCurrentFilter(value === "__all" ? "" : value);
                }}
              >
                <SelectTrigger className="w-36 cursor-pointer" aria-label="Filter by current">
                  <SelectValue placeholder="Current" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all" className="cursor-pointer">
                    All
                  </SelectItem>
                  {CURRENT_OPTIONS.filter(Boolean).map((value) => (
                    <SelectItem key={value} value={value} className="cursor-pointer">
                      {value === "true" ? "Current only" : "Historical current flag"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Page {page} · {total} total
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={page * pageSize >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Location
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Asset
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Effective
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={5}>
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={5}>
                        No location records found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                      const asset = assetMap.get(row.asset_id);
                      const isSelected = selected?.id === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer border-t transition-colors duration-200 hover:bg-muted/40 ${
                            isSelected ? "bg-muted/50" : ""
                          }`}
                          onClick={() => setSelected(row)}
                        >
                          <td className={tableSerialCellClassName()}>{tableRowSerial(page, pageSize, index)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2 font-medium">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              {row.location_label}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{asset?.asset_name ?? row.asset_id}</div>
                            <div className="text-xs text-muted-foreground">
                              {asset?.asset_code ?? "Unresolved"}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {formatDateTime(row.effective_from)}
                            {row.effective_to ? ` → ${formatDateTime(row.effective_to)}` : ""}
                          </td>
                          <td className="px-3 py-2">{statusBadge(row)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="loc-asset">Asset</Label>
                <Select
                  value={draft.asset_id || undefined}
                  onValueChange={(value) => {
                    const asset = assetMap.get(value);
                    setDraft((s) => ({
                      ...s,
                      asset_id: value,
                      branch_id: asset?.branch_id ?? "",
                    }));
                  }}
                >
                  <SelectTrigger id="loc-asset" className="cursor-pointer">
                    <SelectValue placeholder="Select asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetOptions.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id} className="cursor-pointer">
                        {asset.asset_code} — {asset.asset_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-label">Location label</Label>
                <Input
                  id="loc-label"
                  value={draft.location_label}
                  onChange={(e) => setDraft((s) => ({ ...s, location_label: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-org">Org location UUID (optional)</Label>
                <Input
                  id="loc-org"
                  value={draft.org_location_id}
                  onChange={(e) => setDraft((s) => ({ ...s, org_location_id: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-from">Effective from (optional)</Label>
                <Input
                  id="loc-from"
                  type="datetime-local"
                  value={draft.effective_from}
                  onChange={(e) => setDraft((s) => ({ ...s, effective_from: e.target.value }))}
                />
              </div>
              <Button
                type="button"
                className="w-full cursor-pointer transition-colors duration-200"
                disabled={actionLoading}
                onClick={() => void createLocation()}
              >
                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create location
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle>Selected record</CardTitle>
              {selected ? statusBadge(selected) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {!selected ? (
                <p className="text-sm text-muted-foreground">
                  Select a location row to view details and actions.
                </p>
              ) : (
                <>
                  <div className="grid gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Asset:</span>{" "}
                      {assetMap.get(selected.asset_id)?.asset_code ?? selected.asset_id}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Effective from:</span>{" "}
                      {formatDateTime(selected.effective_from)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Effective to:</span>{" "}
                      {formatDateTime(selected.effective_to)}
                    </div>
                  </div>

                  {canEdit ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="edit-label">Location label</Label>
                        <Input
                          id="edit-label"
                          value={edit.location_label}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, location_label: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-org">Org location UUID</Label>
                        <Input
                          id="edit-org"
                          value={edit.org_location_id}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, org_location_id: e.target.value }))
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="edit-from">Effective from</Label>
                          <Input
                            id="edit-from"
                            type="datetime-local"
                            value={edit.effective_from}
                            onChange={(e) =>
                              setEdit((s) => ({ ...s, effective_from: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-to">Effective to</Label>
                          <Input
                            id="edit-to"
                            type="datetime-local"
                            value={edit.effective_to}
                            onChange={(e) =>
                              setEdit((s) => ({ ...s, effective_to: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void saveEdit()}
                      >
                        <SquarePen className="mr-2 h-4 w-4" />
                        Save changes
                      </Button>
                    </>
                  ) : null}

                  {canComplete ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full cursor-pointer transition-colors duration-200"
                      disabled={actionLoading}
                      onClick={() => void completeLocation()}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete (mark historical)
                    </Button>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
