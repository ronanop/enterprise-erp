"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Calculator,
  Loader2,
  RefreshCw,
  RotateCcw,
  SquarePen,
} from "lucide-react";
import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableRowSerialFromIndex,
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
import { ApiClientError, resourceService } from "@/services/api-client";

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  branch_id: string;
  status: string;
  depreciation_method?: string | null;
};

type DepreciationRow = {
  id: string;
  document_number: string;
  asset_id: string;
  period_year: number;
  period_month: number;
  method: string;
  depreciation_amount?: string | number | null;
  book_value_after?: string | number | null;
  units_produced?: string | number | null;
  depreciation_batch_id?: string | null;
  finance_journal_id?: string | null;
  status: string;
  version: number;
};

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

const STATUS_OPTIONS = ["", "draft", "calculated", "posted", "failed", "reversed"] as const;
const METHODS = ["straight_line", "wdv", "units_of_production"] as const;

function parseListItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as ListPayload<T>).items;
    return Array.isArray(items) ? items : [];
  }
  return [];
}

function shortId(value?: string | null): string {
  return value ? value.slice(0, 8) : "None";
}

export function AssetDepreciationWorkspace() {
  const apiPath = "/assets/asset-depreciations";
  const assetsPath = "/assets/assets";

  const [rows, setRows] = useState<DepreciationRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<DepreciationRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postAccounts, setPostAccounts] = useState({
    debit_account_id: "",
    credit_account_id: "",
    fiscal_year_id: "",
  });
  const [generate, setGenerate] = useState({
    period_year: String(new Date().getFullYear()),
    period_month: String(new Date().getMonth() + 1),
  });
  const [draft, setDraft] = useState({
    asset_id: "",
    period_year: String(new Date().getFullYear()),
    period_month: String(new Date().getMonth() + 1),
    method: "straight_line",
    units_produced: "",
  });
  const [uop, setUop] = useState({ estimated_total_units: "" });
  const [historyAssetId, setHistoryAssetId] = useState("");
  const [historyRows, setHistoryRows] = useState<DepreciationRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [batchFilterId, setBatchFilterId] = useState("");
  const [batchRows, setBatchRows] = useState<DepreciationRow[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const loadAssets = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const active = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=100&status=active`,
      );
      setAssetOptions(parseListItems<AssetRow>(active.data));
    } catch {
      setAssetOptions([]);
    }
  }, [assetsPath]);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (statusFilter) query.set("status", statusFilter);
      if (methodFilter) query.set("method", methodFilter);
      if (search.trim()) query.set("q", search.trim());
      const res = await resourceService.list<ListPayload<DepreciationRow>>(
        `${apiPath}?${query.toString()}`,
      );
      const payload = res.data as ListPayload<DepreciationRow> | DepreciationRow[];
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
      setError(err instanceof ApiClientError ? err.message : "Failed to load depreciations");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [apiPath, page, pageSize, search, statusFilter, methodFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const loadAssetHistory = useCallback(async () => {
    if (!isAuthenticated() || !historyAssetId) {
      setHistoryRows([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const query = new URLSearchParams({
        page: "1",
        page_size: "50",
        asset_id: historyAssetId,
      });
      const res = await resourceService.list<ListPayload<DepreciationRow>>(
        `${apiPath}?${query.toString()}`,
      );
      setHistoryRows(parseListItems<DepreciationRow>(res.data));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load asset history");
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [apiPath, historyAssetId]);

  const loadBatchStatus = useCallback(async () => {
    if (!isAuthenticated() || !batchFilterId.trim()) {
      setBatchRows([]);
      return;
    }
    setBatchLoading(true);
    try {
      const query = new URLSearchParams({
        page: "1",
        page_size: "100",
        depreciation_batch_id: batchFilterId.trim(),
      });
      const res = await resourceService.list<ListPayload<DepreciationRow>>(
        `${apiPath}?${query.toString()}`,
      );
      setBatchRows(parseListItems<DepreciationRow>(res.data));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load batch status");
      setBatchRows([]);
    } finally {
      setBatchLoading(false);
    }
  }, [apiPath, batchFilterId]);

  useEffect(() => {
    void loadAssetHistory();
  }, [loadAssetHistory]);

  useEffect(() => {
    void loadBatchStatus();
  }, [loadBatchStatus]);

  async function refreshSelected(id: string) {
    try {
      const res = await resourceService.get<DepreciationRow>(apiPath, id);
      setSelected(res.data as DepreciationRow);
    } catch {
      setSelected(null);
    }
  }

  async function createDraft() {
    if (!draft.asset_id) {
      setError("Select an asset.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.create(apiPath, {
        asset_id: draft.asset_id,
        period_year: Number(draft.period_year),
        period_month: Number(draft.period_month),
        method: draft.method,
        units_produced: draft.units_produced ? Number(draft.units_produced) : undefined,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create draft");
    } finally {
      setActionLoading(false);
    }
  }

  async function generateRun() {
    setActionLoading(true);
    setError(null);
    try {
      const res = await resourceService.create<{
        depreciation_batch_id?: string;
      }>(`${apiPath}/generate-run`, {
        period_year: Number(generate.period_year),
        period_month: Number(generate.period_month),
      });
      const batchId =
        res.data && typeof res.data === "object" && "depreciation_batch_id" in res.data
          ? String((res.data as { depreciation_batch_id?: string }).depreciation_batch_id ?? "")
          : "";
      if (batchId) {
        setBatchFilterId(batchId);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to generate period run");
    } finally {
      setActionLoading(false);
    }
  }

  async function runAction(action: string, body?: Record<string, unknown>) {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.action(apiPath, selected.id, action, body);
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function postOrReverse(action: "post" | "reverse") {
    if (!postAccounts.debit_account_id.trim() || !postAccounts.credit_account_id.trim()) {
      setError("Debit and credit account UUIDs are required.");
      return;
    }
    await runAction(action, {
      debit_account_id: postAccounts.debit_account_id.trim(),
      credit_account_id: postAccounts.credit_account_id.trim(),
      fiscal_year_id: postAccounts.fiscal_year_id.trim() || undefined,
    });
  }

  const statusBadge = (row: DepreciationRow) => (
    <Badge variant="secondary" className="font-mono text-xs">
      {row.status}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset depreciation"
        description="Period depreciation runs with straight-line, WDV, and units-of-production calculation and Finance posting."
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Depreciation runs</CardTitle>
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
                aria-label="Search depreciations"
                placeholder="Search document or asset"
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
                <SelectTrigger className="w-40 cursor-pointer" aria-label="Filter by status">
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
                value={methodFilter || "__all"}
                onValueChange={(value) => {
                  setPage(1);
                  setMethodFilter(value === "__all" ? "" : value);
                }}
              >
                <SelectTrigger className="w-48 cursor-pointer" aria-label="Filter by method">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all" className="cursor-pointer">
                    All methods
                  </SelectItem>
                  {METHODS.map((method) => (
                    <SelectItem key={method} value={method} className="cursor-pointer">
                      {method}
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
                      Document
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Asset
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Period
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
                        No depreciation runs found.
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
                          <td className="px-3 py-2 font-mono text-xs">{row.document_number}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{asset?.asset_name ?? row.asset_id}</div>
                            <div className="text-xs text-muted-foreground">
                              {asset?.asset_code ?? "Unresolved"} · {row.method}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.period_year}-{String(row.period_month).padStart(2, "0")}
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
              <CardTitle>Period generate</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dep-gen-year">Year</Label>
                <Input
                  id="dep-gen-year"
                  type="number"
                  value={generate.period_year}
                  onChange={(e) => setGenerate((s) => ({ ...s, period_year: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dep-gen-month">Month</Label>
                <Input
                  id="dep-gen-month"
                  type="number"
                  min={1}
                  max={12}
                  value={generate.period_month}
                  onChange={(e) => setGenerate((s) => ({ ...s, period_month: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  type="button"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={actionLoading}
                  onClick={() => void generateRun()}
                >
                  Generate draft batch
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create draft</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="dep-asset">Asset</Label>
                <Select
                  value={draft.asset_id || undefined}
                  onValueChange={(value) => {
                    const asset = assetMap.get(value);
                    setDraft((s) => ({
                      ...s,
                      asset_id: value,
                      method: asset?.depreciation_method || s.method,
                    }));
                  }}
                >
                  <SelectTrigger id="dep-asset" className="cursor-pointer">
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
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dep-year">Year</Label>
                  <Input
                    id="dep-year"
                    type="number"
                    value={draft.period_year}
                    onChange={(e) => setDraft((s) => ({ ...s, period_year: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dep-month">Month</Label>
                  <Input
                    id="dep-month"
                    type="number"
                    min={1}
                    max={12}
                    value={draft.period_month}
                    onChange={(e) => setDraft((s) => ({ ...s, period_month: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dep-method">Method</Label>
                <Select
                  value={draft.method}
                  onValueChange={(value) => setDraft((s) => ({ ...s, method: value }))}
                >
                  <SelectTrigger id="dep-method" className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((method) => (
                      <SelectItem key={method} value={method} className="cursor-pointer">
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {draft.method === "units_of_production" ? (
                <div className="space-y-2">
                  <Label htmlFor="dep-units">Units produced</Label>
                  <Input
                    id="dep-units"
                    type="number"
                    value={draft.units_produced}
                    onChange={(e) => setDraft((s) => ({ ...s, units_produced: e.target.value }))}
                  />
                </div>
              ) : null}
              <Button
                type="button"
                className="cursor-pointer transition-colors duration-200"
                disabled={actionLoading}
                onClick={() => void createDraft()}
              >
                <SquarePen className="mr-2 h-4 w-4" />
                Create draft
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Select a run to calculate or post.</p>
              ) : (
                <>
                  <div className="space-y-1 text-sm">
                    <div className="font-mono text-xs">{selected.document_number}</div>
                    <div>{statusBadge(selected)}</div>
                    <div className="text-muted-foreground">
                      {selected.period_year}-{String(selected.period_month).padStart(2, "0")} ·{" "}
                      {selected.method}
                    </div>
                    <div className="text-muted-foreground">
                      Amount {selected.depreciation_amount ?? "—"} · Book after{" "}
                      {selected.book_value_after ?? "—"}
                    </div>
                    <div className="text-muted-foreground">
                      Batch {shortId(selected.depreciation_batch_id)} · Journal{" "}
                      {shortId(selected.finance_journal_id)}
                    </div>
                    {selected.depreciation_batch_id ? (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto cursor-pointer p-0 text-xs"
                        onClick={() => setBatchFilterId(selected.depreciation_batch_id ?? "")}
                      >
                        View batch status
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto cursor-pointer p-0 text-xs"
                      onClick={() => setHistoryAssetId(selected.asset_id)}
                    >
                      View asset depreciation history
                    </Button>
                  </div>

                  {selected.method === "units_of_production" ? (
                    <div className="space-y-2">
                      <Label htmlFor="dep-est-units">Estimated total units (calculate)</Label>
                      <Input
                        id="dep-est-units"
                        type="number"
                        value={uop.estimated_total_units}
                        onChange={(e) =>
                          setUop((s) => ({ ...s, estimated_total_units: e.target.value }))
                        }
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={
                        actionLoading ||
                        !(selected.status === "draft" || selected.status === "failed")
                      }
                      onClick={() =>
                        void runAction("calculate", {
                          estimated_total_units: uop.estimated_total_units
                            ? Number(uop.estimated_total_units)
                            : undefined,
                        })
                      }
                    >
                      <Calculator className="mr-2 h-4 w-4" />
                      Calculate
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || selected.status !== "posted"}
                      onClick={() => void postOrReverse("reverse")}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reverse
                    </Button>
                  </div>

                  {(selected.status === "calculated" || selected.status === "posted") && (
                    <div className="space-y-3 border-t pt-4">
                      {selected.status === "posted" ? (
                        <p className="text-xs text-muted-foreground">
                          Reverse uses the same account orientation as post: Debit = depreciation
                          expense, Credit = accumulated depreciation. The system swaps accounts when
                          posting the reversing journal.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Post orientation: Debit = depreciation expense, Credit = accumulated
                          depreciation.
                        </p>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="dep-debit">
                          {selected.status === "posted"
                            ? "Debit account UUID (original expense)"
                            : "Debit account UUID (expense)"}
                        </Label>
                        <Input
                          id="dep-debit"
                          value={postAccounts.debit_account_id}
                          onChange={(e) =>
                            setPostAccounts((s) => ({ ...s, debit_account_id: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dep-credit">
                          {selected.status === "posted"
                            ? "Credit account UUID (original accumulated)"
                            : "Credit account UUID (accumulated)"}
                        </Label>
                        <Input
                          id="dep-credit"
                          value={postAccounts.credit_account_id}
                          onChange={(e) =>
                            setPostAccounts((s) => ({ ...s, credit_account_id: e.target.value }))
                          }
                        />
                      </div>
                      {selected.status === "calculated" ? (
                        <Button
                          type="button"
                          className="cursor-pointer transition-colors duration-200"
                          disabled={actionLoading}
                          onClick={() => void postOrReverse("post")}
                        >
                          <Banknote className="mr-2 h-4 w-4" />
                          Post to Finance
                        </Button>
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Asset history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="dep-history-asset">Asset</Label>
                <Select
                  value={historyAssetId || undefined}
                  onValueChange={(value) => setHistoryAssetId(value)}
                >
                  <SelectTrigger id="dep-history-asset" className="cursor-pointer">
                    <SelectValue placeholder="Select asset for history" />
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
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                        Document
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Period
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLoading ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                        </td>
                      </tr>
                    ) : !historyAssetId ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>
                          Select an asset to view depreciation history.
                        </td>
                      </tr>
                    ) : historyRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>
                          No history for this asset.
                        </td>
                      </tr>
                    ) : (
                      historyRows.map((row, index) => (
                        <tr
                          key={row.id}
                          className="cursor-pointer border-t transition-colors duration-200 hover:bg-muted/40"
                          onClick={() => setSelected(row)}
                        >
                          <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.document_number}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.period_year}-{String(row.period_month).padStart(2, "0")}
                          </td>
                          <td className="px-3 py-2">{statusBadge(row)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Batch status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="dep-batch-id">Batch UUID</Label>
                <div className="flex gap-2">
                  <Input
                    id="dep-batch-id"
                    value={batchFilterId}
                    onChange={(e) => setBatchFilterId(e.target.value)}
                    placeholder="depreciation_batch_id"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer transition-colors duration-200"
                    disabled={batchLoading || !batchFilterId.trim()}
                    onClick={() => void loadBatchStatus()}
                  >
                    Load
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
                        Document
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Asset
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchLoading ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                        </td>
                      </tr>
                    ) : !batchFilterId.trim() ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>
                          Enter a batch UUID or generate a period run.
                        </td>
                      </tr>
                    ) : batchRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>
                          No rows for this batch.
                        </td>
                      </tr>
                    ) : (
                      batchRows.map((row, index) => {
                        const asset = assetMap.get(row.asset_id);
                        return (
                          <tr
                            key={row.id}
                            className="cursor-pointer border-t transition-colors duration-200 hover:bg-muted/40"
                            onClick={() => setSelected(row)}
                          >
                            <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.document_number}</td>
                            <td className="px-3 py-2 text-xs">
                              {asset?.asset_code ?? shortId(row.asset_id)}
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
        </div>
      </div>
    </div>
  );
}
