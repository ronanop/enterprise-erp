"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Send } from "lucide-react";

import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import {
  isOperationalStatus,
  OPERATIONAL_STATUS_LABELS,
} from "@/components/assets/shared/asset-status";
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
import { ApiClientError, resourceService } from "@/services/api-client";

/** Ops statuses that can be sent to disposal (before/after transition). */
const SEND_ELIGIBLE_OPS = new Set([
  "READY_TO_MOVE",
  "ASSIGNED",
  "RETIRED",
]);

const OPEN_DISPOSAL_STATUSES = new Set(["draft", "submitted", "approved"]);

export type DisposalAssetOption = {
  id: string;
  asset_code: string;
  asset_name: string;
  branch_id: string;
  status: string;
  operational_status?: string | null;
  serial_number?: string | null;
  make?: string | null;
  model?: string | null;
  asset_type?: string | null;
  asset_type_name?: string | null;
  current_location_label?: string | null;
  custodian_employee_id?: string | null;
  department_id?: string | null;
  purchase_date?: string | null;
  configuration?: string | null;
};

type AssetDetail = DisposalAssetOption;

type DisposalRow = {
  id: string;
  document_number: string;
  asset_id: string;
  disposal_type: string;
  remarks?: string | null;
  status: string;
  version: number;
  branch_id: string;
  created_at?: string | null;
};

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

function parseListItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as ListPayload<T>).items;
    return Array.isArray(items) ? items : [];
  }
  return [];
}

function parseListTotal(data: unknown): number {
  if (data && typeof data === "object" && "total" in data) {
    const total = Number((data as ListPayload<unknown>).total);
    return Number.isFinite(total) ? total : 0;
  }
  if (Array.isArray(data)) return data.length;
  return 0;
}

function displayValue(value?: string | null): string {
  const text = value?.trim();
  return text ? text : "—";
}

function opsLabel(ops?: string | null): string {
  const key = String(ops ?? "").toUpperCase();
  if (isOperationalStatus(key)) return OPERATIONAL_STATUS_LABELS[key];
  return key || "—";
}

export function isDisposalEligibleAsset(asset: {
  operational_status?: string | null;
}): boolean {
  const ops = String(asset.operational_status ?? "").toUpperCase();
  return SEND_ELIGIBLE_OPS.has(ops);
}

export function formatDisposalGateError(message: string): {
  title: string;
  detail: string;
  showAssignmentsLink: boolean;
} {
  const lower = message.toLowerCase();
  if (lower.includes("open assignment")) {
    return {
      title: "Asset has an open assignment.",
      detail: "Return or cancel the assignment before sending to disposal.",
      showAssignmentsLink: true,
    };
  }
  if (lower.includes("open disposal")) {
    return {
      title: "Asset already has an open disposal request.",
      detail: message,
      showAssignmentsLink: false,
    };
  }
  if (lower.includes("remarks")) {
    return {
      title: "Remarks are required.",
      detail: "Enter the reason for sending this asset to disposal.",
      showAssignmentsLink: false,
    };
  }
  return { title: message, detail: "", showAssignmentsLink: false };
}

export function formatAssetOptionLabel(asset: DisposalAssetOption): string {
  return [
    asset.asset_code,
    asset.asset_name,
    asset.serial_number ? `SN ${asset.serial_number}` : null,
    [asset.make, asset.model].filter(Boolean).join(" ") || null,
    opsLabel(asset.operational_status),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function disposalRecordStatusLabel(status: string): string {
  const key = String(status || "").toLowerCase();
  // Simplified Send to Disposal creates posted records immediately.
  if (key === "posted") return "Disposed";
  if (key === "draft" || key === "submitted") return "Sent to Disposal";
  if (key === "approved") return "Approved";
  if (key === "cancelled") return "Cancelled";
  return status || "—";
}

async function fetchAllAssetPages(): Promise<DisposalAssetOption[]> {
  const pageSize = 200;
  let page = 1;
  let total = Infinity;
  const all: DisposalAssetOption[] = [];
  while ((page - 1) * pageSize < total) {
    const res = await resourceService.list<ListPayload<DisposalAssetOption>>("/assets/assets", {
      page,
      page_size: pageSize,
    });
    const items = parseListItems<DisposalAssetOption>(res.data);
    total = parseListTotal(res.data) || items.length;
    all.push(...items);
    if (items.length === 0) break;
    page += 1;
    if (page > 50) break;
  }
  return all;
}

function AssetDetailsPanel({ asset }: { asset: AssetDetail }) {
  const rows = [
    { label: "Asset Code", value: displayValue(asset.asset_code) },
    { label: "Asset Name", value: displayValue(asset.asset_name) },
    { label: "Serial Number", value: displayValue(asset.serial_number) },
    { label: "Asset Type", value: displayValue(asset.asset_type_name || asset.asset_type) },
    { label: "Make", value: displayValue(asset.make) },
    { label: "Model", value: displayValue(asset.model) },
    { label: "Operational Status", value: opsLabel(asset.operational_status) },
    { label: "Lifecycle Status", value: displayValue(asset.status) },
    { label: "Current Assignee", value: displayValue(asset.custodian_employee_id) },
    { label: "Department", value: displayValue(asset.department_id) },
    { label: "Branch", value: displayValue(asset.branch_id) },
    { label: "Location", value: displayValue(asset.current_location_label) },
    { label: "Issue / Purchase Date", value: displayValue(asset.purchase_date) },
    { label: "Configuration", value: displayValue(asset.configuration) },
  ];
  return (
    <div
      className="rounded-md border border-border/80"
      data-testid="disposal-selected-asset-details"
    >
      <div className="border-b border-border/60 px-3 py-2 text-sm font-medium">
        Selected Asset Details
      </div>
      <dl className="divide-y divide-border/40 px-3">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {row.label}
            </dt>
            <dd className="text-sm text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function AssetDisposalWorkspace() {
  const apiPath = "/assets/asset-disposals";

  const [rows, setRows] = useState<DisposalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [gateError, setGateError] = useState<ReturnType<typeof formatDisposalGateError> | null>(
    null,
  );
  const [success, setSuccess] = useState<string | null>(null);
  const [assetOptions, setAssetOptions] = useState<DisposalAssetOption[]>([]);
  const [assetLookup, setAssetLookup] = useState<Record<string, DisposalAssetOption>>({});
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<AssetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [remarks, setRemarks] = useState("");

  const selectedFromOptions = useMemo(
    () => assetOptions.find((a) => a.id === selectedAssetId) ?? null,
    [assetOptions, selectedAssetId],
  );

  const loadAssets = useCallback(async () => {
    if (!isAuthenticated()) return;
    setAssetsLoading(true);
    setAssetsError(null);
    try {
      let openAssetIds = new Set<string>();
      try {
        const openDisposals = await resourceService.list<ListPayload<DisposalRow>>(
          apiPath,
          { page: 1, page_size: 200 },
        );
        openAssetIds = new Set(
          parseListItems<DisposalRow>(openDisposals.data)
            .filter((row) => OPEN_DISPOSAL_STATUSES.has(String(row.status).toLowerCase()))
            .map((row) => row.asset_id),
        );
      } catch {
        // Disposal list failure must not blank the asset picker.
        openAssetIds = new Set();
      }

      const allAssets = await fetchAllAssetPages();
      setAssetLookup((prev) => {
        const next = { ...prev };
        for (const asset of allAssets) next[asset.id] = asset;
        return next;
      });
      setAssetOptions(
        allAssets.filter((asset) => {
          if (!isDisposalEligibleAsset(asset)) return false;
          if (openAssetIds.has(asset.id)) return false;
          return true;
        }),
      );
    } catch (err) {
      setAssetOptions([]);
      setAssetsError(
        err instanceof ApiClientError ? err.message : "Failed to load eligible assets",
      );
    } finally {
      setAssetsLoading(false);
    }
  }, [apiPath]);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await resourceService.list<ListPayload<DisposalRow>>(apiPath, {
        page,
        page_size: pageSize,
        ...(search.trim() ? { q: search.trim() } : {}),
      });
      const payload = res.data as ListPayload<DisposalRow> | DisposalRow[];
      if (payload && typeof payload === "object" && "items" in payload) {
        setRows(payload.items ?? []);
        setTotal(payload.total ?? 0);
      } else if (Array.isArray(payload)) {
        setRows(payload);
        setTotal(payload.length);
      } else {
        setRows([]);
        setTotal(0);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load disposals");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [apiPath, page, pageSize, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!selectedAssetId) {
      setSelectedDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await resourceService.get<AssetDetail>("/assets/assets", selectedAssetId);
        if (!cancelled) setSelectedDetail((res.data as AssetDetail) ?? selectedFromOptions);
      } catch {
        if (!cancelled) {
          setSelectedDetail(
            selectedFromOptions ?? assetLookup[selectedAssetId] ?? null,
          );
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAssetId, selectedFromOptions, assetLookup]);

  async function sendToDisposal() {
    setSuccess(null);
    setGateError(null);
    setError(null);
    if (!selectedAssetId) {
      setError("Select an asset to send to disposal.");
      return;
    }
    if (!remarks.trim()) {
      setGateError(formatDisposalGateError("Remarks are required"));
      return;
    }
    const asset =
      selectedDetail ?? selectedFromOptions ?? assetLookup[selectedAssetId] ?? null;
    if (!asset?.branch_id) {
      setError("Selected asset is missing branch information.");
      return;
    }
    setActionLoading(true);
    try {
      await resourceService.create(apiPath, {
        branch_id: asset.branch_id,
        asset_id: selectedAssetId,
        disposal_type: "scrap",
        remarks: remarks.trim(),
      });
      setSuccess("Asset disposed successfully.");
      setSelectedAssetId("");
      setSelectedDetail(null);
      setRemarks("");
      await Promise.all([load(), loadAssets()]);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to send asset to disposal";
      setGateError(formatDisposalGateError(message));
    } finally {
      setActionLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset disposal"
        description="Select an inventory asset, enter the scrap reason, and send it to disposal."
      />

      {gateError ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          data-testid="disposal-gate-error"
          role="alert"
        >
          <p className="font-medium">{gateError.title}</p>
          {gateError.detail ? <p className="mt-1 text-xs opacity-90">{gateError.detail}</p> : null}
          {gateError.showAssignmentsLink ? (
            <Link
              href="/assets/asset-assignments"
              className="mt-2 inline-flex cursor-pointer text-xs underline underline-offset-2 transition-colors duration-200"
            >
              Open Asset Assignments
            </Link>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
          data-testid="disposal-list-error"
        >
          {error}
        </div>
      ) : null}

      {assetsError ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
          data-testid="disposal-assets-error"
        >
          {assetsError}
        </div>
      ) : null}

      {success ? (
        <div
          className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800"
          data-testid="disposal-success"
          role="status"
        >
          {success}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Send to Disposal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disposal-asset">Asset</Label>
              {assetsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading assets…
                </div>
              ) : assetOptions.length === 0 ? (
                <p
                  className="rounded-md border border-dashed border-border/80 px-3 py-2 text-sm text-muted-foreground"
                  data-testid="disposal-no-eligible-assets"
                >
                  No assets are available to send to disposal.
                </p>
              ) : (
                <Select
                  value={selectedAssetId || undefined}
                  onValueChange={(value) => {
                    setSelectedAssetId(value);
                    setGateError(null);
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  <SelectTrigger
                    id="disposal-asset"
                    data-testid="disposal-asset-select"
                    className="cursor-pointer transition-colors duration-200"
                  >
                    <SelectValue placeholder="Select asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetOptions.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id} className="cursor-pointer">
                        {formatAssetOptionLabel(asset)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {detailLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading asset details…
              </div>
            ) : null}

            {selectedDetail ? <AssetDetailsPanel asset={selectedDetail} /> : null}

            <div className="space-y-2">
              <Label htmlFor="disposal-type">Disposal Type</Label>
              <Select value="scrap" disabled>
                <SelectTrigger id="disposal-type" data-testid="disposal-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scrap">Scrap</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disposal-remarks">Remarks</Label>
              <textarea
                id="disposal-remarks"
                data-testid="disposal-remarks"
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Enter the reason for sending this asset to disposal..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            <Button
              type="button"
              className="cursor-pointer transition-colors duration-200"
              disabled={actionLoading || assetsLoading}
              onClick={() => void sendToDisposal()}
              data-testid="disposal-send-button"
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send to Disposal
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Disposal records</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => {
                void load();
                void loadAssets();
              }}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disposal-search">Search</Label>
              <Input
                id="disposal-search"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Document number…"
              />
            </div>

            <div className="overflow-x-auto rounded-md border border-border/80">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className={tableSerialHeaderClassName()}>{TABLE_SERIAL_HEADER_LABEL}</th>
                    <th className="px-3 py-2 font-medium">Disposal Document</th>
                    <th className="px-3 py-2 font-medium">Asset Code</th>
                    <th className="px-3 py-2 font-medium">Asset Name</th>
                    <th className="px-3 py-2 font-medium">Disposal Type</th>
                    <th className="px-3 py-2 font-medium">Reason / Remarks</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center">
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        No disposal records yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                      const asset = assetLookup[row.asset_id];
                      return (
                        <tr key={row.id} className="border-t border-border/50">
                          <td className={tableSerialCellClassName()}>
                            {tableRowSerial(page, pageSize, index)}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{row.document_number}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {asset?.asset_code ?? "—"}
                          </td>
                          <td className="px-3 py-2">{asset?.asset_name ?? "—"}</td>
                          <td className="px-3 py-2 capitalize">{row.disposal_type}</td>
                          <td
                            className="max-w-[14rem] truncate px-3 py-2"
                            title={row.remarks ?? ""}
                          >
                            {displayValue(row.remarks)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary">
                              {disposalRecordStatusLabel(row.status)}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages} · {total} total
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
