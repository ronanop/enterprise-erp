"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  Loader2,
  Play,
  RefreshCw,
  SquarePen,
  TimerOff,
  XCircle,
} from "lucide-react";

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
};

type InsuranceRow = {
  id: string;
  asset_id: string;
  policy_number: string;
  insurer_name: string;
  vendor_id?: string | null;
  coverage_amount?: string | number | null;
  start_date: string;
  end_date: string;
  status: string;
  version: number;
  branch_id?: string | null;
};

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

const STATUS_OPTIONS = ["", "draft", "active", "renewed", "expired", "cancelled"] as const;

function parseListItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as ListPayload<T>).items;
    return Array.isArray(items) ? items : [];
  }
  return [];
}

export function AssetInsuranceWorkspace() {
  const apiPath = "/assets/asset-insurances";
  const assetsPath = "/assets/assets";

  const [rows, setRows] = useState<InsuranceRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<InsuranceRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    asset_id: "",
    branch_id: "",
    policy_number: "",
    insurer_name: "",
    vendor_id: "",
    coverage_amount: "",
    start_date: "",
    end_date: "",
  });
  const [edit, setEdit] = useState({
    policy_number: "",
    insurer_name: "",
    vendor_id: "",
    coverage_amount: "",
    start_date: "",
    end_date: "",
  });
  const [renewDate, setRenewDate] = useState("");

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const canEdit = Boolean(
    selected && (selected.status === "draft" || selected.status === "active"),
  );
  const canActivate = Boolean(selected?.status === "draft");
  const canRenew = Boolean(selected?.status === "active" && renewDate);
  const canExpire = Boolean(
    selected && (selected.status === "active" || selected.status === "renewed"),
  );
  const canClose = Boolean(selected?.status === "expired");

  const loadAssets = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const active = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=100&status=active`,
      );
      const maintenance = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=100&status=in_maintenance`,
      );
      const merged = [
        ...parseListItems<AssetRow>(active.data),
        ...parseListItems<AssetRow>(maintenance.data),
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
      const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (statusFilter) query.set("status", statusFilter);
      if (search.trim()) query.set("q", search.trim());
      const res = await resourceService.list<ListPayload<InsuranceRow>>(
        `${apiPath}?${query.toString()}`,
      );
      const payload = res.data as ListPayload<InsuranceRow> | InsuranceRow[];
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
      setError(err instanceof ApiClientError ? err.message : "Failed to load insurance policies");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [apiPath, page, pageSize, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!selected) return;
    setEdit({
      policy_number: selected.policy_number,
      insurer_name: selected.insurer_name,
      vendor_id: selected.vendor_id ?? "",
      coverage_amount:
        selected.coverage_amount != null ? String(selected.coverage_amount) : "",
      start_date: selected.start_date,
      end_date: selected.end_date,
    });
    setRenewDate("");
  }, [selected]);

  async function refreshSelected(id: string) {
    try {
      const res = await resourceService.get<InsuranceRow>(apiPath, id);
      setSelected(res.data as InsuranceRow);
    } catch {
      setSelected(null);
    }
  }

  async function createDraft() {
    if (!draft.asset_id) {
      setError("Select an asset.");
      return;
    }
    if (!draft.policy_number.trim() || !draft.insurer_name.trim()) {
      setError("Policy number and insurer name are required.");
      return;
    }
    if (!draft.start_date || !draft.end_date) {
      setError("Start date and end date are required.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.create(apiPath, {
        asset_id: draft.asset_id,
        branch_id: draft.branch_id || undefined,
        policy_number: draft.policy_number.trim(),
        insurer_name: draft.insurer_name.trim(),
        vendor_id: draft.vendor_id.trim() || undefined,
        coverage_amount: draft.coverage_amount.trim()
          ? Number(draft.coverage_amount)
          : undefined,
        start_date: draft.start_date,
        end_date: draft.end_date,
      });
      setDraft({
        asset_id: "",
        branch_id: "",
        policy_number: "",
        insurer_name: "",
        vendor_id: "",
        coverage_amount: "",
        start_date: "",
        end_date: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create insurance policy");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveEdit() {
    if (!selected || !canEdit) return;
    setActionLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        policy_number: edit.policy_number.trim(),
        insurer_name: edit.insurer_name.trim(),
        vendor_id: edit.vendor_id.trim() || null,
        coverage_amount: edit.coverage_amount.trim()
          ? Number(edit.coverage_amount)
          : null,
        start_date: edit.start_date,
        version: selected.version,
      };
      if (selected.status !== "active") {
        payload.end_date = edit.end_date;
      }
      await resourceService.update(apiPath, selected.id, payload);
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update insurance policy");
    } finally {
      setActionLoading(false);
    }
  }

  async function runAction(action: string, body?: unknown) {
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

  const statusBadge = (row: InsuranceRow) => (
    <Badge variant="secondary" className="font-mono text-xs">
      {row.status}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset insurance"
        description="Insurance policy lifecycle — draft, activate, renew, expire, close. No approval workflow."
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Insurance policies</CardTitle>
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
                aria-label="Search insurance policies"
                placeholder="Search policy, insurer, or asset"
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
                      Policy
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Asset
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      End date
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Status
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
                        No insurance policies found.
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
                            <div className="font-medium">{row.policy_number}</div>
                            <div className="text-xs text-muted-foreground">{row.insurer_name}</div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">
                              {asset?.asset_name ?? row.asset_id}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {asset?.asset_code ?? "Unresolved"}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{row.end_date}</td>
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
              <CardTitle>Create draft policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ins-asset">Asset</Label>
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
                  <SelectTrigger id="ins-asset" className="cursor-pointer">
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
                <Label htmlFor="ins-policy">Policy number</Label>
                <Input
                  id="ins-policy"
                  value={draft.policy_number}
                  onChange={(e) => setDraft((s) => ({ ...s, policy_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ins-insurer">Insurer name</Label>
                <Input
                  id="ins-insurer"
                  value={draft.insurer_name}
                  onChange={(e) => setDraft((s) => ({ ...s, insurer_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ins-vendor">Vendor UUID (optional)</Label>
                <Input
                  id="ins-vendor"
                  value={draft.vendor_id}
                  onChange={(e) => setDraft((s) => ({ ...s, vendor_id: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ins-coverage">Coverage amount (optional)</Label>
                <Input
                  id="ins-coverage"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.coverage_amount}
                  onChange={(e) => setDraft((s) => ({ ...s, coverage_amount: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ins-start">Start date</Label>
                  <Input
                    id="ins-start"
                    type="date"
                    value={draft.start_date}
                    onChange={(e) => setDraft((s) => ({ ...s, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ins-end">End date</Label>
                  <Input
                    id="ins-end"
                    type="date"
                    value={draft.end_date}
                    onChange={(e) => setDraft((s) => ({ ...s, end_date: e.target.value }))}
                  />
                </div>
              </div>
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
                <p className="text-sm text-muted-foreground">Select a policy to manage.</p>
              ) : (
                <>
                  <div className="space-y-1 text-sm">
                    <div>{statusBadge(selected)}</div>
                    <div className="font-mono text-xs">{selected.policy_number}</div>
                    <div className="text-muted-foreground">{selected.insurer_name}</div>
                    <div className="text-muted-foreground">
                      {selected.start_date} → {selected.end_date}
                    </div>
                    {selected.coverage_amount != null ? (
                      <div className="text-muted-foreground">
                        Coverage {selected.coverage_amount}
                      </div>
                    ) : null}
                  </div>

                  {canEdit ? (
                    <div className="space-y-3 border-t pt-4">
                      <p className="text-xs text-muted-foreground">
                        Draft policies are fully editable. Active policies allow metadata updates
                        only; coverage extension must use Renew.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="ins-edit-policy">Policy number</Label>
                        <Input
                          id="ins-edit-policy"
                          value={edit.policy_number}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, policy_number: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ins-edit-insurer">Insurer name</Label>
                        <Input
                          id="ins-edit-insurer"
                          value={edit.insurer_name}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, insurer_name: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ins-edit-vendor">Vendor UUID</Label>
                        <Input
                          id="ins-edit-vendor"
                          value={edit.vendor_id}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, vendor_id: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ins-edit-coverage">Coverage amount</Label>
                        <Input
                          id="ins-edit-coverage"
                          type="number"
                          min="0"
                          step="0.01"
                          value={edit.coverage_amount}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, coverage_amount: e.target.value }))
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="ins-edit-start">Start date</Label>
                          <Input
                            id="ins-edit-start"
                            type="date"
                            value={edit.start_date}
                            onChange={(e) =>
                              setEdit((s) => ({ ...s, start_date: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ins-edit-end">End date</Label>
                          <Input
                            id="ins-edit-end"
                            type="date"
                            value={edit.end_date}
                            disabled={selected.status === "active"}
                            onChange={(e) =>
                              setEdit((s) => ({ ...s, end_date: e.target.value }))
                            }
                          />
                          {selected.status === "active" ? (
                            <p className="text-xs text-muted-foreground">
                              Use Renew to extend insurance coverage.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void saveEdit()}
                      >
                        Save
                      </Button>
                    </div>
                  ) : null}

                  {selected.status === "active" ? (
                    <div className="space-y-2 border-t pt-4">
                      <Label htmlFor="ins-renew">New end date (renew)</Label>
                      <Input
                        id="ins-renew"
                        type="date"
                        value={renewDate}
                        onChange={(e) => setRenewDate(e.target.value)}
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || !canActivate}
                      onClick={() => void runAction("activate")}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Activate
                    </Button>
                    <Button
                      type="button"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || !canRenew}
                      onClick={() => void runAction("renew", { new_end_date: renewDate })}
                    >
                      <CalendarPlus className="mr-2 h-4 w-4" />
                      Renew
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || !canExpire}
                      onClick={() => void runAction("expire")}
                    >
                      <TimerOff className="mr-2 h-4 w-4" />
                      Expire
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || !canClose}
                      onClick={() => void runAction("close")}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Close
                    </Button>
                    {selected.status === "cancelled" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Closed
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
