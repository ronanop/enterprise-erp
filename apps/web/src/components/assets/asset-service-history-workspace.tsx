"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Plus, RefreshCw } from "lucide-react";

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
  type ServiceHistoryRow,
  serviceHistoryService,
} from "@/services/assets-service";
import { ApiClientError, resourceService } from "@/services/api-client";

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  branch_id: string;
  status: string;
};

type MaintenanceRow = {
  id: string;
  asset_id: string;
  document_number: string;
  maintenance_type: string;
  status: string;
};

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

const MAINTENANCE_PAGE_SIZE = 25;

function parseListPayload<T>(data: unknown): ListPayload<T> {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as ListPayload<T>;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? MAINTENANCE_PAGE_SIZE,
    };
  }
  return { items: [], total: 0, page: 1, page_size: MAINTENANCE_PAGE_SIZE };
}

function parseListItems<T>(data: unknown): T[] {
  return parseListPayload<T>(data).items;
}

function isValidPartsJson(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return value.slice(0, 16).replace("T", " ");
}

export function AssetServiceHistoryWorkspace() {
  const assetsPath = "/assets/assets";
  const maintenancesPath = "/assets/asset-maintenances";

  const [rows, setRows] = useState<ServiceHistoryRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [maintenanceCache, setMaintenanceCache] = useState<Record<string, MaintenanceRow>>({});
  const [pickerMaintenances, setPickerMaintenances] = useState<MaintenanceRow[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerTotal, setPickerTotal] = useState(0);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [filterMaintenances, setFilterMaintenances] = useState<MaintenanceRow[]>([]);
  const [filterMaintenanceSearch, setFilterMaintenanceSearch] = useState("");
  const [filterMaintenancePage, setFilterMaintenancePage] = useState(1);
  const [filterMaintenanceTotal, setFilterMaintenanceTotal] = useState(0);
  const [filterMaintenanceLoading, setFilterMaintenanceLoading] = useState(false);
  const [partsJsonError, setPartsJsonError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ServiceHistoryRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [assetFilter, setAssetFilter] = useState("");
  const [maintenanceFilter, setMaintenanceFilter] = useState("");
  const [servicedFrom, setServicedFrom] = useState("");
  const [servicedTo, setServicedTo] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({
    asset_id: "",
    maintenance_id: "",
    service_summary: "",
    cost_amount: "",
    serviced_at: "",
    parts_replaced_json: "",
  });

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const maintenanceMap = useMemo(
    () => new Map(Object.values(maintenanceCache).map((row) => [row.id, row])),
    [maintenanceCache],
  );

  const mergeMaintenanceRows = useCallback((rows: MaintenanceRow[]) => {
    if (rows.length === 0) return;
    setMaintenanceCache((current) => {
      const next = { ...current };
      for (const row of rows) {
        next[row.id] = row;
      }
      return next;
    });
  }, []);

  const searchMaintenances = useCallback(
    async (params: {
      page: number;
      q?: string;
      asset_id?: string;
      append?: boolean;
      target: "picker" | "filter";
    }) => {
      if (!isAuthenticated()) return;
      const setLoading =
        params.target === "picker" ? setPickerLoading : setFilterMaintenanceLoading;
      setLoading(true);
      try {
        const query = new URLSearchParams({
          page: String(params.page),
          page_size: String(MAINTENANCE_PAGE_SIZE),
          status: "completed",
        });
        if (params.asset_id) query.set("asset_id", params.asset_id);
        if (params.q?.trim()) query.set("q", params.q.trim());
        const res = await resourceService.list<ListPayload<MaintenanceRow>>(
          `${maintenancesPath}?${query.toString()}`,
        );
        const payload = parseListPayload<MaintenanceRow>(res.data);
        mergeMaintenanceRows(payload.items);
        if (params.target === "picker") {
          setPickerMaintenances((current) =>
            params.append ? [...current, ...payload.items] : payload.items,
          );
          setPickerPage(payload.page);
          setPickerTotal(payload.total);
        } else {
          setFilterMaintenances((current) =>
            params.append ? [...current, ...payload.items] : payload.items,
          );
          setFilterMaintenancePage(payload.page);
          setFilterMaintenanceTotal(payload.total);
        }
      } catch {
        if (params.target === "picker") {
          if (!params.append) {
            setPickerMaintenances([]);
            setPickerTotal(0);
          }
        } else if (!params.append) {
          setFilterMaintenances([]);
          setFilterMaintenanceTotal(0);
        }
      } finally {
        setLoading(false);
      }
    },
    [maintenancesPath, mergeMaintenanceRows],
  );

  const loadAssets = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const res = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=200`,
      );
      setAssetOptions(parseListItems<AssetRow>(res.data));
    } catch {
      setAssetOptions([]);
    }
  }, [assetsPath]);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await serviceHistoryService.search({
        page,
        page_size: pageSize,
        asset_id: assetFilter || undefined,
        maintenance_id: maintenanceFilter || undefined,
        serviced_from: servicedFrom ? new Date(servicedFrom).toISOString() : undefined,
        serviced_to: servicedTo ? new Date(servicedTo).toISOString() : undefined,
        q: search.trim() || undefined,
      });
      setRows(payload.items);
      setTotal(payload.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load service history");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, assetFilter, maintenanceFilter, servicedFrom, servicedTo, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!showCreate) return;
    const timer = window.setTimeout(() => {
      void searchMaintenances({
        page: 1,
        q: pickerSearch,
        asset_id: draft.asset_id || undefined,
        target: "picker",
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [showCreate, pickerSearch, draft.asset_id, searchMaintenances]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void searchMaintenances({
        page: 1,
        q: filterMaintenanceSearch,
        target: "filter",
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filterMaintenanceSearch, searchMaintenances]);

  async function createEntry() {
    if (!draft.asset_id || !draft.maintenance_id || !draft.service_summary.trim()) {
      setError("Asset, completed maintenance, and summary are required.");
      return;
    }
    if (!isValidPartsJson(draft.parts_replaced_json)) {
      setPartsJsonError("Enter valid JSON (object or array).");
      return;
    }
    setActionLoading(true);
    setError(null);
    setPartsJsonError(null);
    try {
      let parts: unknown;
      if (draft.parts_replaced_json.trim()) {
        parts = JSON.parse(draft.parts_replaced_json);
      }
      await serviceHistoryService.create({
        asset_id: draft.asset_id,
        maintenance_id: draft.maintenance_id,
        service_summary: draft.service_summary.trim(),
        cost_amount: draft.cost_amount.trim() ? Number(draft.cost_amount) : undefined,
        serviced_at: draft.serviced_at
          ? new Date(draft.serviced_at).toISOString()
          : undefined,
        parts_replaced_json: parts as Record<string, unknown> | unknown[] | undefined,
      });
      setDraft({
        asset_id: "",
        maintenance_id: "",
        service_summary: "",
        cost_amount: "",
        serviced_at: "",
        parts_replaced_json: "",
      });
      setPickerSearch("");
      setPickerPage(1);
      setPickerMaintenances([]);
      setPartsJsonError(null);
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to create service history entry",
      );
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service history"
        description="Append-only maintenance service log — auto-recorded on work order completion. Immutable after creation."
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>History records</CardTitle>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => setShowCreate((v) => !v)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Supplemental entry
              </Button>
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
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input
                aria-label="Search service history"
                placeholder="Search summary or asset"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                className="max-w-xs"
              />
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
              <Select
                value={maintenanceFilter || "__all"}
                onValueChange={(value) => {
                  setPage(1);
                  setMaintenanceFilter(value === "__all" ? "" : value);
                }}
              >
                <SelectTrigger className="w-44 cursor-pointer" aria-label="Filter by maintenance">
                  <SelectValue placeholder="Maintenance" />
                </SelectTrigger>
                <SelectContent>
                  <div className="space-y-2 p-2">
                    <Input
                      aria-label="Search maintenance work orders"
                      placeholder="Search work orders"
                      value={filterMaintenanceSearch}
                      onChange={(e) => setFilterMaintenanceSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    {filterMaintenanceLoading ? (
                      <div className="flex justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : null}
                  </div>
                  <SelectItem value="__all" className="cursor-pointer">
                    All work orders
                  </SelectItem>
                  {filterMaintenances.map((row) => (
                    <SelectItem key={row.id} value={row.id} className="cursor-pointer">
                      {row.document_number}
                    </SelectItem>
                  ))}
                  {filterMaintenancePage * MAINTENANCE_PAGE_SIZE < filterMaintenanceTotal ? (
                    <div className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full cursor-pointer"
                        disabled={filterMaintenanceLoading}
                        onClick={(e) => {
                          e.preventDefault();
                          void searchMaintenances({
                            page: filterMaintenancePage + 1,
                            q: filterMaintenanceSearch,
                            target: "filter",
                            append: true,
                          });
                        }}
                      >
                        Load more
                      </Button>
                    </div>
                  ) : null}
                </SelectContent>
              </Select>
              <Input
                aria-label="Serviced from"
                type="datetime-local"
                value={servicedFrom}
                onChange={(e) => {
                  setPage(1);
                  setServicedFrom(e.target.value);
                }}
                className="w-48"
              />
              <Input
                aria-label="Serviced to"
                type="datetime-local"
                value={servicedTo}
                onChange={(e) => {
                  setPage(1);
                  setServicedTo(e.target.value);
                }}
                className="w-48"
              />
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
                    <th scope="col" className="px-3 py-2 font-medium">
                      Summary
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Asset
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Serviced
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={4}>
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={4}>
                        No service history records found.
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
                          <td className="px-3 py-2">
                            <div className="flex items-start gap-2">
                              <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="line-clamp-2">{row.service_summary}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{asset?.asset_name ?? row.asset_id}</div>
                            <div className="text-xs text-muted-foreground">
                              {asset?.asset_code ?? "Unresolved"}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {formatDateTime(row.serviced_at)}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.cost_amount ?? "—"}
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
                <CardTitle>Supplemental entry</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="svh-asset">Asset</Label>
                  <Select
                    value={draft.asset_id || undefined}
                    onValueChange={(value) =>
                      setDraft((s) => ({ ...s, asset_id: value, maintenance_id: "" }))
                    }
                  >
                    <SelectTrigger id="svh-asset" className="cursor-pointer">
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
                  <Label htmlFor="svh-maint-search">Completed maintenance</Label>
                  <Input
                    id="svh-maint-search"
                    placeholder="Search work order number"
                    value={pickerSearch}
                    disabled={!draft.asset_id}
                    onChange={(e) => {
                      setPickerSearch(e.target.value);
                      setPickerPage(1);
                    }}
                  />
                  <Select
                    value={draft.maintenance_id || undefined}
                    onValueChange={(value) => {
                      const maint = pickerMaintenances.find((row) => row.id === value);
                      setDraft((s) => ({
                        ...s,
                        maintenance_id: value,
                        asset_id: maint?.asset_id ?? s.asset_id,
                      }));
                    }}
                    disabled={!draft.asset_id}
                  >
                    <SelectTrigger id="svh-maint" className="cursor-pointer">
                      <SelectValue placeholder="Select work order" />
                    </SelectTrigger>
                    <SelectContent>
                      {pickerLoading && pickerMaintenances.length === 0 ? (
                        <div className="flex justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : null}
                      {pickerMaintenances.map((row) => (
                        <SelectItem key={row.id} value={row.id} className="cursor-pointer">
                          {row.document_number} — {row.maintenance_type}
                        </SelectItem>
                      ))}
                      {pickerPage * MAINTENANCE_PAGE_SIZE < pickerTotal ? (
                        <div className="p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full cursor-pointer"
                            disabled={pickerLoading}
                            onClick={(e) => {
                              e.preventDefault();
                              void searchMaintenances({
                                page: pickerPage + 1,
                                q: pickerSearch,
                                asset_id: draft.asset_id || undefined,
                                target: "picker",
                                append: true,
                              });
                            }}
                          >
                            Load more
                          </Button>
                        </div>
                      ) : null}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="svh-summary">Service summary</Label>
                  <Input
                    id="svh-summary"
                    value={draft.service_summary}
                    onChange={(e) => setDraft((s) => ({ ...s, service_summary: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="svh-cost">Cost amount (optional)</Label>
                  <Input
                    id="svh-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.cost_amount}
                    onChange={(e) => setDraft((s) => ({ ...s, cost_amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="svh-serviced">Serviced at (optional)</Label>
                  <Input
                    id="svh-serviced"
                    type="datetime-local"
                    value={draft.serviced_at}
                    onChange={(e) => setDraft((s) => ({ ...s, serviced_at: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="svh-parts">Parts replaced JSON (optional)</Label>
                  <textarea
                    id="svh-parts"
                    rows={4}
                    placeholder='[{"part":"filter","qty":1}]'
                    value={draft.parts_replaced_json}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDraft((s) => ({ ...s, parts_replaced_json: value }));
                      setPartsJsonError(
                        isValidPartsJson(value) ? null : "Enter valid JSON (object or array).",
                      );
                    }}
                    className={`flex min-h-[96px] w-full rounded-md border bg-background px-3 py-2 font-mono text-sm shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      partsJsonError ? "border-destructive" : "border-input"
                    }`}
                  />
                  {partsJsonError ? (
                    <p className="text-xs text-destructive">{partsJsonError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      JSON object or array. Leave blank if not applicable.
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  className="w-full cursor-pointer transition-colors duration-200"
                  disabled={actionLoading}
                  onClick={() => void createEntry()}
                >
                  {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Record entry
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle>Detail</CardTitle>
              {selected ? (
                <Badge variant="secondary" className="font-mono text-xs">
                  {selected.status}
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!selected ? (
                <p className="text-muted-foreground">
                  Select a history row to view details. Records are immutable.
                </p>
              ) : (
                <>
                  <div>
                    <span className="text-muted-foreground">Summary:</span>
                    <p className="mt-1">{selected.service_summary}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Asset:</span>{" "}
                    {assetMap.get(selected.asset_id)?.asset_code ?? selected.asset_id}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Maintenance:</span>{" "}
                    {maintenanceMap.get(selected.maintenance_id)?.document_number ??
                      selected.maintenance_id}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Serviced at:</span>{" "}
                    {formatDateTime(selected.serviced_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cost:</span>{" "}
                    {selected.cost_amount ?? "—"}
                  </div>
                  {selected.parts_replaced_json ? (
                    <div>
                      <span className="text-muted-foreground">Parts replaced:</span>
                      <pre className="mt-1 overflow-x-auto rounded-md bg-muted/40 p-2 text-xs">
                        {JSON.stringify(selected.parts_replaced_json, null, 2)}
                      </pre>
                    </div>
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
