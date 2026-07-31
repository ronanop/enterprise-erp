"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  SquarePen,
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
import { getAccessTokenUserId, isAuthenticated } from "@/lib/auth";
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
  document_number: string;
  asset_id: string;
  maintenance_type: string;
  maintenance_plan_id?: string | null;
  scheduled_date?: string | null;
  completed_date?: string | null;
  vendor_id?: string | null;
  cost_amount?: string | number | null;
  technician_employee_id?: string | null;
  workflow_status?: string | null;
  status: string;
  version: number;
  created_by?: string | null;
  branch_id: string;
};

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

const STATUS_OPTIONS = [
  "",
  "draft",
  "submitted",
  "approved",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;
const MAINTENANCE_TYPES = ["preventive", "corrective", "emergency", "annual_service"] as const;

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

export function AssetMaintenanceWorkspace() {
  const searchParams = useSearchParams();
  const prefillAssetId = searchParams.get("assetId") ?? "";
  const apiPath = "/assets/asset-maintenances";
  const assetsPath = "/assets/assets";

  const [rows, setRows] = useState<MaintenanceRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<MaintenanceRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowComments, setWorkflowComments] = useState("");
  const [draft, setDraft] = useState({
    asset_id: "",
    branch_id: "",
    maintenance_type: "preventive",
    scheduled_date: "",
    vendor_id: "",
    technician_employee_id: "",
    cost_amount: "",
  });
  const [edit, setEdit] = useState({
    maintenance_type: "preventive",
    scheduled_date: "",
    vendor_id: "",
    technician_employee_id: "",
    cost_amount: "",
  });

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const currentUserId = useMemo(() => getAccessTokenUserId(), []);

  const canWorkflowAct = useMemo(() => {
    if (!selected || selected.status !== "submitted") return false;
    if (selected.workflow_status && selected.workflow_status !== "in_progress") {
      return false;
    }
    return true;
  }, [selected]);

  const canApproveOrReject = useMemo(() => {
    if (!canWorkflowAct) return false;
    if (!currentUserId || !selected?.created_by) return true;
    return currentUserId !== selected.created_by;
  }, [canWorkflowAct, currentUserId, selected]);

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
      if (typeFilter) query.set("maintenance_type", typeFilter);
      if (search.trim()) query.set("q", search.trim());
      const res = await resourceService.list<ListPayload<MaintenanceRow>>(
        `${apiPath}?${query.toString()}`,
      );
      const payload = res.data as ListPayload<MaintenanceRow> | MaintenanceRow[];
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
      setError(err instanceof ApiClientError ? err.message : "Failed to load maintenance");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [apiPath, page, pageSize, search, statusFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!prefillAssetId) return;
    const asset = assetMap.get(prefillAssetId);
    setDraft((current) => ({
      ...current,
      asset_id: prefillAssetId,
      branch_id: asset?.branch_id ?? current.branch_id,
    }));
  }, [prefillAssetId, assetMap]);

  useEffect(() => {
    if (!selected) return;
    setEdit({
      maintenance_type: selected.maintenance_type,
      scheduled_date: selected.scheduled_date ?? "",
      vendor_id: selected.vendor_id ?? "",
      technician_employee_id: selected.technician_employee_id ?? "",
      cost_amount: selected.cost_amount != null ? String(selected.cost_amount) : "",
    });
  }, [selected]);

  function onDraftAssetChange(assetId: string) {
    const asset = assetMap.get(assetId);
    setDraft((s) => ({
      ...s,
      asset_id: assetId,
      branch_id: asset?.branch_id ?? "",
    }));
  }

  function validateDraft(payload: typeof draft): string | null {
    if (!payload.asset_id) return "Select an asset.";
    if (!payload.branch_id) return "Branch is required.";
    if (!payload.maintenance_type) return "Select a maintenance type.";
    return null;
  }

  async function createDraft() {
    const message = validateDraft(draft);
    if (message) {
      setError(message);
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.create(apiPath, {
        asset_id: draft.asset_id,
        branch_id: draft.branch_id,
        maintenance_type: draft.maintenance_type,
        scheduled_date: draft.scheduled_date || undefined,
        vendor_id: draft.vendor_id || undefined,
        technician_employee_id: draft.technician_employee_id || undefined,
        cost_amount: draft.cost_amount ? Number(draft.cost_amount) : undefined,
      });
      setDraft({
        asset_id: "",
        branch_id: "",
        maintenance_type: "preventive",
        scheduled_date: "",
        vendor_id: "",
        technician_employee_id: "",
        cost_amount: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create draft");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveDraft() {
    if (!selected || selected.status !== "draft") return;
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.update(apiPath, selected.id, {
        maintenance_type: edit.maintenance_type,
        scheduled_date: edit.scheduled_date || null,
        vendor_id: edit.vendor_id || null,
        technician_employee_id: edit.technician_employee_id || null,
        cost_amount: edit.cost_amount ? Number(edit.cost_amount) : null,
        version: selected.version,
      });
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update draft");
    } finally {
      setActionLoading(false);
    }
  }

  async function refreshSelected(id: string) {
    try {
      const res = await resourceService.get<MaintenanceRow>(apiPath, id);
      setSelected(res.data as MaintenanceRow);
    } catch {
      setSelected(null);
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
      if (action === "approve" || action === "reject") {
        setWorkflowComments("");
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  const statusBadge = useMemo(
    () => (row: MaintenanceRow) => (
      <Badge variant="secondary" className="font-mono text-xs">
        {row.status}
        {row.workflow_status ? ` / ${row.workflow_status}` : ""}
      </Badge>
    ),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset maintenance"
        description="Preventive and corrective work orders with workflow approval, scheduling, and asset status control."
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Work orders</CardTitle>
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
                aria-label="Search maintenance"
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
                    <th scope="col" className="px-3 py-2 font-medium">
                      Document
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Asset
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Type
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
                        No work orders found.
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
                          <td className="px-3 py-2 font-mono text-xs">{row.document_number}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{asset?.asset_name ?? row.asset_id}</div>
                            <div className="text-xs text-muted-foreground">
                              {asset?.asset_code ?? "Unresolved asset"}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs">{row.maintenance_type}</td>
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
              <CardTitle>Create draft</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="mnt-draft-asset">Asset</Label>
                <Select value={draft.asset_id} onValueChange={onDraftAssetChange}>
                  <SelectTrigger id="mnt-draft-asset" aria-label="Select asset for maintenance">
                    <SelectValue placeholder="Select active asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetOptions.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id} className="cursor-pointer">
                        {asset.asset_code} - {asset.asset_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mnt-draft-branch">Branch</Label>
                <Input id="mnt-draft-branch" value={draft.branch_id} readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mnt-draft-type">Type</Label>
                <Select
                  value={draft.maintenance_type}
                  onValueChange={(value) => setDraft((s) => ({ ...s, maintenance_type: value }))}
                >
                  <SelectTrigger id="mnt-draft-type" aria-label="Maintenance type">
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
              <div className="space-y-2">
                <Label htmlFor="mnt-draft-sched">Scheduled date</Label>
                <Input
                  id="mnt-draft-sched"
                  type="date"
                  value={draft.scheduled_date}
                  onChange={(e) => setDraft((s) => ({ ...s, scheduled_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mnt-draft-cost">Cost</Label>
                <Input
                  id="mnt-draft-cost"
                  type="number"
                  step="0.01"
                  value={draft.cost_amount}
                  onChange={(e) => setDraft((s) => ({ ...s, cost_amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="mnt-draft-tech">Technician employee UUID</Label>
                <Input
                  id="mnt-draft-tech"
                  value={draft.technician_employee_id}
                  onChange={(e) =>
                    setDraft((s) => ({ ...s, technician_employee_id: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="mnt-draft-vendor">Vendor UUID</Label>
                <Input
                  id="mnt-draft-vendor"
                  value={draft.vendor_id}
                  onChange={(e) => setDraft((s) => ({ ...s, vendor_id: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  type="button"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={actionLoading}
                  onClick={() => void createDraft()}
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <SquarePen className="mr-2 h-4 w-4" />
                  )}
                  Create draft
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work order detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">
                  Select a work order to review, edit, or act on it.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {selected.document_number}
                      </div>
                      <div className="text-base font-semibold">
                        {assetMap.get(selected.asset_id)?.asset_name ?? selected.asset_id}
                      </div>
                    </div>
                    {statusBadge(selected)}
                  </div>

                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <div>Type: {selected.maintenance_type}</div>
                    <div>Scheduled: {selected.scheduled_date ?? "—"}</div>
                    <div>Technician: {shortId(selected.technician_employee_id)}</div>
                    <div>Vendor: {shortId(selected.vendor_id)}</div>
                    <div>Cost: {selected.cost_amount ?? "—"}</div>
                    <div>Completed: {selected.completed_date ?? "—"}</div>
                  </div>

                  {currentUserId &&
                  selected.created_by &&
                  currentUserId === selected.created_by &&
                  selected.status === "submitted" ? (
                    <p className="text-xs text-muted-foreground">
                      SoD: you created this work order and cannot approve or reject it.
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="mnt-workflow-comments">Workflow comments</Label>
                    <Input
                      id="mnt-workflow-comments"
                      aria-label="Workflow comments"
                      placeholder="Optional approval or rejection comments"
                      value={workflowComments}
                      onChange={(e) => setWorkflowComments(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || selected.status !== "draft"}
                      onClick={() => void runAction("submit")}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Submit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || selected.status !== "draft"}
                      onClick={() => void runAction("cancel")}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || !canApproveOrReject}
                      onClick={() =>
                        void runAction("approve", { comments: workflowComments || undefined })
                      }
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || !canApproveOrReject}
                      onClick={() =>
                        void runAction("reject", { comments: workflowComments || undefined })
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || selected.status !== "approved"}
                      onClick={() =>
                        void runAction("schedule", {
                          scheduled_date: selected.scheduled_date || undefined,
                        })
                      }
                    >
                      <CalendarClock className="mr-2 h-4 w-4" />
                      Schedule
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={
                        actionLoading ||
                        !(selected.status === "approved" || selected.status === "scheduled")
                      }
                      onClick={() => void runAction("start")}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Start
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={
                        actionLoading ||
                        !(
                          selected.status === "approved" ||
                          selected.status === "scheduled" ||
                          selected.status === "in_progress"
                        )
                      }
                      onClick={() => void runAction("complete")}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={
                        actionLoading ||
                        !(selected.status === "cancelled" && selected.workflow_status === "rejected")
                      }
                      onClick={() => void runAction("reopen")}
                    >
                      Reopen
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={
                        actionLoading ||
                        !(
                          selected.status === "draft" ||
                          (selected.status === "cancelled" &&
                            selected.workflow_status === "rejected")
                        )
                      }
                      onClick={() => void runAction("resubmit")}
                    >
                      Resubmit
                    </Button>
                  </div>

                  {selected.status === "draft" ? (
                    <div className="grid gap-3 border-t pt-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="mnt-edit-type">Type</Label>
                        <Select
                          value={edit.maintenance_type}
                          onValueChange={(value) =>
                            setEdit((s) => ({ ...s, maintenance_type: value }))
                          }
                        >
                          <SelectTrigger id="mnt-edit-type" aria-label="Edit maintenance type">
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
                      <div className="space-y-2">
                        <Label htmlFor="mnt-edit-sched">Scheduled date</Label>
                        <Input
                          id="mnt-edit-sched"
                          type="date"
                          value={edit.scheduled_date}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, scheduled_date: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mnt-edit-cost">Cost</Label>
                        <Input
                          id="mnt-edit-cost"
                          type="number"
                          step="0.01"
                          value={edit.cost_amount}
                          onChange={(e) => setEdit((s) => ({ ...s, cost_amount: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mnt-edit-tech">Technician UUID</Label>
                        <Input
                          id="mnt-edit-tech"
                          value={edit.technician_employee_id}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, technician_employee_id: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="mnt-edit-vendor">Vendor UUID</Label>
                        <Input
                          id="mnt-edit-vendor"
                          value={edit.vendor_id}
                          onChange={(e) => setEdit((s) => ({ ...s, vendor_id: e.target.value }))}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Button
                          type="button"
                          className="cursor-pointer transition-colors duration-200"
                          disabled={actionLoading}
                          onClick={() => void saveDraft()}
                        >
                          Save draft
                        </Button>
                      </div>
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
