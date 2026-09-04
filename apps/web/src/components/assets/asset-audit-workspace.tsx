"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Play,
  RefreshCw,
  SquarePen,
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

type AuditRow = {
  id: string;
  document_number: string;
  asset_id?: string | null;
  auditor_employee_id: string;
  audit_date?: string | null;
  found_status?: string | null;
  notes?: string | null;
  status: string;
  version: number;
  branch_id: string;
};

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

const STATUS_OPTIONS = ["", "planned", "in_progress", "completed", "cancelled"] as const;
const FOUND_OPTIONS = ["found", "missing", "damaged", "relocated"] as const;

function parseListItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as ListPayload<T>).items;
    return Array.isArray(items) ? items : [];
  }
  return [];
}

export function AssetAuditWorkspace() {
  const apiPath = "/assets/asset-audits";
  const assetsPath = "/assets/assets";

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [foundFilter, setFoundFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    asset_id: "",
    branch_id: "",
    auditor_employee_id: "",
    audit_date: "",
    found_status: "",
    notes: "",
  });
  const [edit, setEdit] = useState({
    auditor_employee_id: "",
    audit_date: "",
    found_status: "",
    notes: "",
  });

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const canStart = Boolean(
    selected?.status === "planned" && selected.audit_date,
  );
  const canComplete = Boolean(
    selected &&
      (selected.status === "planned" || selected.status === "in_progress") &&
      selected.found_status &&
      selected.audit_date,
  );
  const canCancel = Boolean(
    selected && selected.status !== "completed" && selected.status !== "cancelled",
  );

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
      if (foundFilter) query.set("found_status", foundFilter);
      if (search.trim()) query.set("q", search.trim());
      const res = await resourceService.list<ListPayload<AuditRow>>(
        `${apiPath}?${query.toString()}`,
      );
      const payload = res.data as ListPayload<AuditRow> | AuditRow[];
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
      setError(err instanceof ApiClientError ? err.message : "Failed to load audits");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [apiPath, foundFilter, page, pageSize, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!selected) return;
    setEdit({
      auditor_employee_id: selected.auditor_employee_id,
      audit_date: selected.audit_date ?? "",
      found_status: selected.found_status ?? "",
      notes: selected.notes ?? "",
    });
  }, [selected]);

  async function refreshSelected(id: string) {
    try {
      const res = await resourceService.get<AuditRow>(apiPath, id);
      setSelected(res.data as AuditRow);
    } catch {
      setSelected(null);
    }
  }

  async function createDraft() {
    if (!draft.asset_id || !draft.branch_id) {
      setError("Select an asset.");
      return;
    }
    if (!draft.auditor_employee_id.trim()) {
      setError("Auditor employee UUID is required.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.create(apiPath, {
        asset_id: draft.asset_id,
        branch_id: draft.branch_id,
        auditor_employee_id: draft.auditor_employee_id.trim(),
        audit_date: draft.audit_date || undefined,
        found_status: draft.found_status || undefined,
        notes: draft.notes.trim() || undefined,
      });
      setDraft({
        asset_id: "",
        branch_id: "",
        auditor_employee_id: "",
        audit_date: "",
        found_status: "",
        notes: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create audit");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveDraft() {
    if (!selected || selected.status !== "planned") return;
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.update(apiPath, selected.id, {
        auditor_employee_id: edit.auditor_employee_id.trim() || undefined,
        audit_date: edit.audit_date || null,
        found_status: edit.found_status || null,
        notes: edit.notes.trim() || null,
        version: selected.version,
      });
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update audit");
    } finally {
      setActionLoading(false);
    }
  }

  async function runAction(action: string) {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.action(apiPath, selected.id, action);
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  const statusBadge = (row: AuditRow) => (
    <Badge variant="secondary" className="font-mono text-xs">
      {row.status}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset audits"
        description="Physical verification of assets — planned, in progress, completed, or cancelled. No approval workflow."
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Audits</CardTitle>
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
                aria-label="Search audits"
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
                value={foundFilter || "__all"}
                onValueChange={(value) => {
                  setPage(1);
                  setFoundFilter(value === "__all" ? "" : value);
                }}
              >
                <SelectTrigger className="w-40 cursor-pointer" aria-label="Filter by found status">
                  <SelectValue placeholder="Found" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all" className="cursor-pointer">
                    All found
                  </SelectItem>
                  {FOUND_OPTIONS.map((status) => (
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
                      Document
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Asset
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Found
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
                        No audits found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const asset = row.asset_id ? assetMap.get(row.asset_id) : undefined;
                      const isSelected = selected?.id === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer border-t transition-colors duration-200 hover:bg-muted/40 ${
                            isSelected ? "bg-muted/50" : ""
                          }`}
                          onClick={() => setSelected(row)}
                        >
                          <td className="px-3 py-2 font-mono text-xs">{row.document_number}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">
                              {asset?.asset_name ?? row.asset_id ?? "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {asset?.asset_code ?? "Unresolved"}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.found_status ?? "—"}
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
              <CardTitle>Create planned audit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="aud-asset">Asset</Label>
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
                  <SelectTrigger id="aud-asset" className="cursor-pointer">
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
                <Label htmlFor="aud-auditor">Auditor employee UUID</Label>
                <Input
                  id="aud-auditor"
                  value={draft.auditor_employee_id}
                  onChange={(e) =>
                    setDraft((s) => ({ ...s, auditor_employee_id: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aud-date">Audit date</Label>
                <Input
                  id="aud-date"
                  type="date"
                  value={draft.audit_date}
                  onChange={(e) => setDraft((s) => ({ ...s, audit_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aud-found">Found status (optional until complete)</Label>
                <Select
                  value={draft.found_status || "__none"}
                  onValueChange={(value) =>
                    setDraft((s) => ({
                      ...s,
                      found_status: value === "__none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger id="aud-found" className="cursor-pointer">
                    <SelectValue placeholder="Found status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none" className="cursor-pointer">
                      Not set
                    </SelectItem>
                    {FOUND_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status} className="cursor-pointer">
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="aud-notes">Notes</Label>
                <Input
                  id="aud-notes"
                  value={draft.notes}
                  onChange={(e) => setDraft((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>
              <Button
                type="button"
                className="cursor-pointer transition-colors duration-200"
                disabled={actionLoading}
                onClick={() => void createDraft()}
              >
                <SquarePen className="mr-2 h-4 w-4" />
                Create planned
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Select an audit to manage.</p>
              ) : (
                <>
                  <div className="space-y-1 text-sm">
                    <div className="font-mono text-xs">{selected.document_number}</div>
                    <div>{statusBadge(selected)}</div>
                    <div className="text-muted-foreground">
                      Date {selected.audit_date ?? "—"} · Found {selected.found_status ?? "—"}
                    </div>
                    <div className="text-muted-foreground">{selected.notes ?? "—"}</div>
                  </div>

                  {selected.status === "planned" ? (
                    <div className="space-y-3 border-t pt-4">
                      <p className="text-xs text-muted-foreground">
                        Set audit date before Start. Set found status before Complete. Only planned
                        audits can be edited.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="aud-edit-date">Audit date</Label>
                        <Input
                          id="aud-edit-date"
                          type="date"
                          value={edit.audit_date}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, audit_date: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="aud-edit-found">Found status</Label>
                        <Select
                          value={edit.found_status || "__none"}
                          onValueChange={(value) =>
                            setEdit((s) => ({
                              ...s,
                              found_status: value === "__none" ? "" : value,
                            }))
                          }
                        >
                          <SelectTrigger id="aud-edit-found" className="cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none" className="cursor-pointer">
                              Not set
                            </SelectItem>
                            {FOUND_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status} className="cursor-pointer">
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="aud-edit-notes">Notes</Label>
                        <Input
                          id="aud-edit-notes"
                          value={edit.notes}
                          onChange={(e) => setEdit((s) => ({ ...s, notes: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="aud-edit-auditor">Auditor employee UUID</Label>
                        <Input
                          id="aud-edit-auditor"
                          value={edit.auditor_employee_id}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, auditor_employee_id: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void saveDraft()}
                      >
                        Save planned
                      </Button>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || !canStart}
                      onClick={() => void runAction("start")}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Start
                    </Button>
                    <Button
                      type="button"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || !canComplete}
                      onClick={() => void runAction("complete")}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || !canCancel}
                      onClick={() => void runAction("cancel")}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
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
