"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gauge, Loader2, Plus, RefreshCw, XCircle } from "lucide-react";

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
  type MeterReadingRow,
  meterReadingService,
} from "@/services/assets-service";
import { ApiClientError, resourceService } from "@/services/api-client";

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
};

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

const METER_TYPES = ["odometer", "runtime_hours", "cycle_count", "other"] as const;
const STATUS_OPTIONS = ["", "recorded", "void"] as const;
const PAGE_SIZE = 25;

function parseListPayload<T>(data: unknown): ListPayload<T> {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as ListPayload<T>;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? PAGE_SIZE,
    };
  }
  return { items: [], total: 0, page: 1, page_size: PAGE_SIZE };
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return value.slice(0, 16).replace("T", " ");
}


export function AssetMeterReadingWorkspace() {
  const assetsPath = "/assets/assets";

  const [rows, setRows] = useState<MeterReadingRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<MeterReadingRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [meterTypeFilter, setMeterTypeFilter] = useState("");
  const [assetFilter, setAssetFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [latestHint, setLatestHint] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    asset_id: "",
    meter_type: "odometer",
    reading_value: "",
    reading_at: new Date().toISOString().slice(0, 16),
  });

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const canVoid = selected?.status === "recorded";

  const loadAssets = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const res = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=200&status=active`,
      );
      setAssetOptions(parseListPayload<AssetRow>(res.data).items);
    } catch {
      setAssetOptions([]);
    }
  }, [assetsPath]);

  const loadLatestHint = useCallback(async (assetId: string, meterType: string) => {
    if (!assetId || !meterType) {
      setLatestHint(null);
      return;
    }
    try {
      const payload = await meterReadingService.search({
        page: 1,
        page_size: 1,
        asset_id: assetId,
        meter_type: meterType,
        status: "recorded",
      });
      const latest = payload.items[0];
      setLatestHint(
        latest
          ? `Latest recorded: ${latest.reading_value} at ${formatDateTime(latest.reading_at)}`
          : "No prior reading for this asset and meter type.",
      );
    } catch {
      setLatestHint(null);
    }
  }, []);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await meterReadingService.search({
        page,
        page_size: PAGE_SIZE,
        status: statusFilter || undefined,
        meter_type: meterTypeFilter || undefined,
        asset_id: assetFilter || undefined,
        q: search.trim() || undefined,
      });
      setRows(payload.items);
      setTotal(payload.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load meter readings");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, meterTypeFilter, assetFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!showCreate) return;
    void loadLatestHint(draft.asset_id, draft.meter_type);
  }, [showCreate, draft.asset_id, draft.meter_type, loadLatestHint]);

  const handleCreate = async () => {
    if (!draft.asset_id || !draft.reading_value.trim()) {
      setError("Asset and reading value are required.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const created = await meterReadingService.create({
        asset_id: draft.asset_id,
        meter_type: draft.meter_type,
        reading_value: draft.reading_value,
        reading_at: new Date(draft.reading_at).toISOString(),
      });
      setShowCreate(false);
      setSelected(created);
      setPage(1);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create meter reading");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      const voided = await meterReadingService.void(selected.id);
      setSelected(voided);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to void meter reading");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meter readings"
        description="Record and track asset usage meters with non-decreasing validation."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              type="button"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Record reading
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Gauge className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Reading history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input
                aria-label="Search meter readings"
                placeholder="Search asset or meter type"
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
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem
                      key={status || "__all"}
                      value={status || "__all"}
                      className="cursor-pointer"
                    >
                      {status || "All statuses"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={meterTypeFilter || "__all"}
                onValueChange={(value) => {
                  setPage(1);
                  setMeterTypeFilter(value === "__all" ? "" : value);
                }}
              >
                <SelectTrigger className="w-40 cursor-pointer" aria-label="Filter by meter type">
                  <SelectValue placeholder="Meter type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all" className="cursor-pointer">
                    All types
                  </SelectItem>
                  {METER_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="cursor-pointer">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={assetFilter || "__all"}
                onValueChange={(value) => {
                  setPage(1);
                  setAssetFilter(value === "__all" ? "" : value);
                }}
              >
                <SelectTrigger className="w-44 cursor-pointer" aria-label="Filter by asset">
                  <SelectValue placeholder="Asset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all" className="cursor-pointer">
                    All assets
                  </SelectItem>
                  {assetOptions.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id} className="cursor-pointer">
                      {asset.asset_code}
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
                  disabled={page * PAGE_SIZE >= total}
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
                    <th scope="col" className="px-3 py-2 font-medium">
                      Asset
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Value
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Reading at
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
                        No meter readings found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
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
                          <td className="px-3 py-2 text-xs">
                            {asset?.asset_code ?? row.asset_id}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{row.meter_type}</td>
                          <td className="px-3 py-2 font-mono">{row.reading_value}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {formatDateTime(row.reading_at)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="font-mono text-xs">
                              {row.status}
                            </Badge>
                          </td>
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
          {showCreate ? (
            <Card>
              <CardHeader>
                <CardTitle>Record meter reading</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="mtr-asset">Asset</Label>
                  <Select
                    value={draft.asset_id || "__none"}
                    onValueChange={(value) =>
                      setDraft((s) => ({
                        ...s,
                        asset_id: value === "__none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger id="mtr-asset" className="cursor-pointer">
                      <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none" className="cursor-pointer">
                        Select asset
                      </SelectItem>
                      {assetOptions.map((asset) => (
                        <SelectItem key={asset.id} value={asset.id} className="cursor-pointer">
                          {asset.asset_code} — {asset.asset_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mtr-type">Meter type</Label>
                  <Select
                    value={draft.meter_type}
                    onValueChange={(value) => setDraft((s) => ({ ...s, meter_type: value }))}
                  >
                    <SelectTrigger id="mtr-type" className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METER_TYPES.map((type) => (
                        <SelectItem key={type} value={type} className="cursor-pointer">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {latestHint ? (
                  <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    {latestHint}
                  </p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="mtr-value">Reading value</Label>
                  <Input
                    id="mtr-value"
                    type="number"
                    min="0"
                    step="any"
                    value={draft.reading_value}
                    onChange={(e) => setDraft((s) => ({ ...s, reading_value: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mtr-at">Reading at</Label>
                  <Input
                    id="mtr-at"
                    type="datetime-local"
                    value={draft.reading_at}
                    onChange={(e) => setDraft((s) => ({ ...s, reading_at: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    className="cursor-pointer transition-colors duration-200"
                    disabled={actionLoading}
                    onClick={() => void handleCreate()}
                  >
                    {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save reading
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer transition-colors duration-200"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!selected ? (
                <p className="text-muted-foreground">Select a reading to view details.</p>
              ) : (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Asset</span>
                    <span className="font-mono text-xs">
                      {assetMap.get(selected.asset_id)?.asset_code ?? selected.asset_id}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Meter type</span>
                    <span>{selected.meter_type}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Value</span>
                    <span className="font-mono">{selected.reading_value}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Reading at</span>
                    <span>{formatDateTime(selected.reading_at)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="secondary">{selected.status}</Badge>
                  </div>
                  {canVoid ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 w-full cursor-pointer transition-colors duration-200"
                      disabled={actionLoading}
                      onClick={() => void handleVoid()}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Void reading
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
