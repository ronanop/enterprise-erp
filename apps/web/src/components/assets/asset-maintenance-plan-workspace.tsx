"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  SquarePen,
  XCircle,
} from "lucide-react";
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
  type MaintenancePlanListResult,
  type MaintenancePlanRow,
  maintenancePlanService,
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

const STATUS_OPTIONS = ["", "draft", "active", "paused", "closed"] as const;
const MAINTENANCE_TYPES = [
  "preventive",
  "corrective",
  "emergency",
  "annual_service",
] as const;

function parseListItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as ListPayload<T>).items;
    return Array.isArray(items) ? items : [];
  }
  return [];
}

export function AssetMaintenancePlanWorkspace() {
  const assetsPath = "/assets/assets";

  const [rows, setRows] = useState<MaintenancePlanRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<MaintenancePlanRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    asset_id: "",
    branch_id: "",
    plan_name: "",
    maintenance_type: "preventive",
    frequency_days: "",
    frequency_meter_units: "",
    next_due_date: "",
  });
  const [edit, setEdit] = useState({
    plan_name: "",
    maintenance_type: "preventive",
    frequency_days: "",
    frequency_meter_units: "",
    next_due_date: "",
  });

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const canEdit = Boolean(
    selected &&
      (selected.status === "draft" ||
        selected.status === "active" ||
        selected.status === "paused"),
  );
  const canActivate = Boolean(selected?.status === "draft");
  const canPause = Boolean(selected?.status === "active");
  const canResume = Boolean(selected?.status === "paused");
  const canClose = Boolean(
    selected && (selected.status === "active" || selected.status === "paused"),
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
      const payload = await maintenancePlanService.search({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
        maintenance_type: typeFilter || undefined,
        q: search.trim() || undefined,
      });
      setRows(payload.items);
      setTotal(payload.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load maintenance plans");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!selected) return;
    setEdit({
      plan_name: selected.plan_name,
      maintenance_type: selected.maintenance_type,
      frequency_days:
        selected.frequency_days != null ? String(selected.frequency_days) : "",
      frequency_meter_units:
        selected.frequency_meter_units != null
          ? String(selected.frequency_meter_units)
          : "",
      next_due_date: selected.next_due_date ?? "",
    });
  }, [selected]);

  async function refreshSelected(id: string) {
    try {
      const row = await maintenancePlanService.get(id);
      setSelected(row);
    } catch {
      setSelected(null);
    }
  }

  async function createDraft() {
    if (!draft.asset_id) {
      setError("Select an asset.");
      return;
    }
    if (!draft.plan_name.trim()) {
      setError("Plan name is required.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await maintenancePlanService.create({
        asset_id: draft.asset_id,
        branch_id: draft.branch_id || undefined,
        plan_name: draft.plan_name.trim(),
        maintenance_type: draft.maintenance_type,
        frequency_days: draft.frequency_days ? Number(draft.frequency_days) : undefined,
        frequency_meter_units: draft.frequency_meter_units
          ? Number(draft.frequency_meter_units)
          : undefined,
        next_due_date: draft.next_due_date || undefined,
      });
      setDraft({
        asset_id: "",
        branch_id: "",
        plan_name: "",
        maintenance_type: "preventive",
        frequency_days: "",
        frequency_meter_units: "",
        next_due_date: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create maintenance plan");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveEdit() {
    if (!selected || !canEdit) return;
    setActionLoading(true);
    setError(null);
    try {
      await maintenancePlanService.update(selected.id, {
        plan_name: edit.plan_name.trim(),
        maintenance_type: edit.maintenance_type,
        frequency_days: edit.frequency_days ? Number(edit.frequency_days) : null,
        frequency_meter_units: edit.frequency_meter_units
          ? Number(edit.frequency_meter_units)
          : null,
        next_due_date: edit.next_due_date || null,
        version: selected.version,
      });
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update maintenance plan");
    } finally {
      setActionLoading(false);
    }
  }

  async function runAction(action: "activate" | "pause" | "resume" | "close") {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      await maintenancePlanService.lifecycle(selected.id, action);
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  const statusBadge = (row: MaintenancePlanRow) => (
    <Badge variant="secondary" className="font-mono text-xs">
      {row.status}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance plans"
        description="Preventive maintenance schedules — draft, activate, pause, resume, close. No approval workflow."
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Plans</CardTitle>
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
                aria-label="Search maintenance plans"
                placeholder="Search document, plan, or asset"
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
                value={typeFilter || "__all"}
                onValueChange={(value) => {
                  setPage(1);
                  setTypeFilter(value === "__all" ? "" : value);
                }}
              >
                <SelectTrigger className="w-44 cursor-pointer" aria-label="Filter by type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all" className="cursor-pointer">
                    All types
                  </SelectItem>
                  {MAINTENANCE_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="cursor-pointer">
                      {type}
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
                      Plan
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Next due
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
                        No maintenance plans found.
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
                            <div className="font-medium">{row.plan_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {asset?.asset_code ?? row.asset_id} · {row.maintenance_type}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.next_due_date ?? "—"}
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
              <CardTitle>Create draft plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="draft-asset">Asset</Label>
                <Select
                  value={draft.asset_id || "__none"}
                  onValueChange={(value) =>
                    setDraft((d) => ({
                      ...d,
                      asset_id: value === "__none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger id="draft-asset" className="cursor-pointer">
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
              <div className="space-y-1">
                <Label htmlFor="draft-plan-name">Plan name</Label>
                <Input
                  id="draft-plan-name"
                  value={draft.plan_name}
                  onChange={(e) => setDraft((d) => ({ ...d, plan_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="draft-type">Maintenance type</Label>
                <Select
                  value={draft.maintenance_type}
                  onValueChange={(value) =>
                    setDraft((d) => ({ ...d, maintenance_type: value }))
                  }
                >
                  <SelectTrigger id="draft-type" className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="cursor-pointer">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="draft-freq-days">Frequency (days)</Label>
                  <Input
                    id="draft-freq-days"
                    type="number"
                    min={0}
                    value={draft.frequency_days}
                    onChange={(e) => setDraft((d) => ({ ...d, frequency_days: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="draft-next-due">Next due date</Label>
                  <Input
                    id="draft-next-due"
                    type="date"
                    value={draft.next_due_date}
                    onChange={(e) => setDraft((d) => ({ ...d, next_due_date: e.target.value }))}
                  />
                </div>
              </div>
              <Button
                type="button"
                className="w-full cursor-pointer transition-colors duration-200"
                disabled={actionLoading}
                onClick={() => void createDraft()}
              >
                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create draft
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SquarePen className="h-4 w-4" />
                Detail &amp; actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Select a plan from the list.</p>
              ) : (
                <>
                  <div className="space-y-1 text-sm">
                    <div className="font-mono text-xs text-muted-foreground">
                      {selected.document_number}
                    </div>
                    <div className="font-medium">{selected.plan_name}</div>
                    <div>Status: {statusBadge(selected)}</div>
                    <div className="text-muted-foreground">Version {selected.version}</div>
                  </div>

                  {canEdit ? (
                    <div className="space-y-3 border-t pt-4">
                      <div className="space-y-1">
                        <Label htmlFor="edit-plan-name">Plan name</Label>
                        <Input
                          id="edit-plan-name"
                          value={edit.plan_name}
                          onChange={(e) => setEdit((v) => ({ ...v, plan_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="edit-next-due">Next due date</Label>
                        <Input
                          id="edit-next-due"
                          type="date"
                          value={edit.next_due_date}
                          onChange={(e) =>
                            setEdit((v) => ({ ...v, next_due_date: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void saveEdit()}
                      >
                        Save changes
                      </Button>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    {canActivate ? (
                      <Button
                        type="button"
                        size="sm"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void runAction("activate")}
                      >
                        <Play className="mr-1 h-4 w-4" />
                        Activate
                      </Button>
                    ) : null}
                    {canPause ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void runAction("pause")}
                      >
                        <Pause className="mr-1 h-4 w-4" />
                        Pause
                      </Button>
                    ) : null}
                    {canResume ? (
                      <Button
                        type="button"
                        size="sm"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void runAction("resume")}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Resume
                      </Button>
                    ) : null}
                    {canClose ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void runAction("close")}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Close
                      </Button>
                    ) : null}
                  </div>
                  {selected.status === "draft" && !edit.next_due_date ? (
                    <p className="text-xs text-muted-foreground">
                      Set next due date before activate.
                    </p>
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
