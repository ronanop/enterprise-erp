"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, RefreshCw, Send, ShieldCheck, SquarePen } from "lucide-react";
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
import { getAccessTokenUserId, isAuthenticated } from "@/lib/auth";
import { ApiClientError, resourceService } from "@/services/api-client";
import {
  listSiteBuildings,
  listSiteLocations,
  type SiteBuilding,
  type SiteLocation,
} from "@/services/asset-site-location-service";

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  branch_id: string;
  department_id?: string | null;
  custodian_employee_id?: string | null;
  status: string;
};

type TransferRow = {
  id: string;
  document_number: string;
  asset_id: string;
  from_branch_id?: string | null;
  to_branch_id?: string | null;
  from_department_id?: string | null;
  to_department_id?: string | null;
  from_employee_id?: string | null;
  to_employee_id?: string | null;
  from_location_label?: string | null;
  to_location_label?: string | null;
  workflow_status?: string | null;
  reason?: string | null;
  transfer_notes?: string | null;
  effective_date?: string | null;
  status: string;
  version: number;
  created_by?: string | null;
};

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

function parseListItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as ListPayload<T>).items;
    return Array.isArray(items) ? items : [];
  }
  return [];
}

function formatPlace(label?: string | null, id?: string | null): string {
  if (label && label.trim()) return label.trim();
  if (id && id.trim()) return id.slice(0, 8);
  return "—";
}

function formatStatusLabel(status: string): string {
  const key = status.trim().toLowerCase();
  if (!key) return "—";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function AssetTransferWorkspace() {
  const apiPath = "/assets/asset-transfers";
  const assetsPath = "/assets/assets";
  const searchParams = useSearchParams();
  const focusDocument = (searchParams.get("document") || "").trim();

  const [rows, setRows] = useState<TransferRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<TransferRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState(focusDocument);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowComments, setWorkflowComments] = useState("");
  const [siteLocations, setSiteLocations] = useState<SiteLocation[]>([]);
  const [draftBuildings, setDraftBuildings] = useState<SiteBuilding[]>([]);
  const [editBuildings, setEditBuildings] = useState<SiteBuilding[]>([]);
  const [draft, setDraft] = useState({
    asset_id: "",
    branch_id: "",
    to_branch_id: "",
    to_department_id: "",
    to_employee_id: "",
    to_location_id: "",
    to_building_id: "",
    reason: "",
    effective_date: "",
    transfer_notes: "",
  });
  const [edit, setEdit] = useState({
    to_branch_id: "",
    to_department_id: "",
    to_employee_id: "",
    to_location_id: "",
    to_building_id: "",
    reason: "",
    effective_date: "",
    transfer_notes: "",
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
    return selected.created_by !== currentUserId;
  }, [canWorkflowAct, currentUserId, selected]);

  const loadAssets = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const active = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=100&status=active`,
      );
      const activeRows = parseListItems<AssetRow>(active.data);
      const maintenance = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=100&status=in_maintenance`,
      );
      const maintenanceRows = parseListItems<AssetRow>(maintenance.data);
      const merged = [...activeRows, ...maintenanceRows];
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
      const searchTerm = search.trim();
      if (searchTerm) query.set("q", searchTerm);
      const res = await resourceService.list<ListPayload<TransferRow>>(
        `${apiPath}?${query.toString()}`,
      );
      const payload = res.data as ListPayload<TransferRow> | TransferRow[];
      let nextRows: TransferRow[] = [];
      if (payload && typeof payload === "object" && "items" in payload) {
        nextRows = payload.items ?? [];
        setRows(nextRows);
        setTotal(payload.total ?? 0);
      } else if (Array.isArray(payload)) {
        nextRows = payload;
        setRows(payload);
        setTotal(payload.length);
      } else {
        setRows([]);
        setTotal(0);
      }
      if (focusDocument) {
        const match = nextRows.find((row) => row.document_number === focusDocument);
        if (match) {
          setSelected(match);
          setEdit({
            to_branch_id: match.to_branch_id ?? "",
            to_department_id: match.to_department_id ?? "",
            to_employee_id: match.to_employee_id ?? "",
            to_location_id: "",
            to_building_id: "",
            reason: match.reason ?? "",
            effective_date: match.effective_date ?? "",
            transfer_notes: match.transfer_notes ?? "",
          });
          setEditBuildings([]);
        }
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load transfers");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [apiPath, focusDocument, page, pageSize, search, statusFilter]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadAssets();
    });
  }, [loadAssets]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    void listSiteLocations()
      .then(setSiteLocations)
      .catch(() => setSiteLocations([]));
  }, []);

  function selectTransfer(row: TransferRow) {
    setSelected(row);
    setEdit({
      to_branch_id: row.to_branch_id ?? "",
      to_department_id: row.to_department_id ?? "",
      to_employee_id: row.to_employee_id ?? "",
      to_location_id: "",
      to_building_id: "",
      reason: row.reason ?? "",
      effective_date: row.effective_date ?? "",
      transfer_notes: row.transfer_notes ?? "",
    });
    setEditBuildings([]);
  }

  function onDraftAssetChange(assetId: string) {
    const asset = assetMap.get(assetId);
    setDraft((current) => ({
      ...current,
      asset_id: assetId,
      branch_id: asset?.branch_id ?? "",
    }));
  }

  function validateDraft(
    payload: typeof draft | typeof edit,
    { creating }: { creating: boolean },
  ): string | null {
    if (creating && !draft.asset_id) return "Select an asset to transfer.";
    if (
      !payload.to_branch_id.trim() &&
      !payload.to_department_id.trim() &&
      !payload.to_employee_id.trim() &&
      !payload.to_location_id.trim()
    ) {
      return "Add at least one transfer target.";
    }
    if (payload.to_location_id.trim() && !payload.to_building_id.trim()) {
      return "Select a building for the destination location.";
    }
    return null;
  }

  async function refreshSelected(rowId: string) {
    const fresh = await resourceService.get<TransferRow>(apiPath, rowId);
    setSelected(fresh.data as TransferRow);
  }

  async function createDraft() {
    const validationError = validateDraft(draft, { creating: true });
    if (validationError) {
      setError(validationError);
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.create(apiPath, {
        asset_id: draft.asset_id,
        branch_id: draft.branch_id,
        to_branch_id: draft.to_branch_id || undefined,
        to_department_id: draft.to_department_id || undefined,
        to_employee_id: draft.to_employee_id || undefined,
        to_location_id: draft.to_location_id || undefined,
        to_building_id: draft.to_building_id || undefined,
        reason: draft.reason.trim() || undefined,
        effective_date: draft.effective_date || undefined,
        transfer_notes: draft.transfer_notes.trim() || undefined,
      });
      setDraft({
        asset_id: "",
        branch_id: "",
        to_branch_id: "",
        to_department_id: "",
        to_employee_id: "",
        to_location_id: "",
        to_building_id: "",
        reason: "",
        effective_date: "",
        transfer_notes: "",
      });
      setDraftBuildings([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create transfer");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveDraft() {
    if (!selected || selected.status !== "draft") {
      setError("Only draft transfers can be edited.");
      return;
    }
    const validationError = validateDraft(edit, { creating: false });
    if (validationError) {
      setError(validationError);
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.update(apiPath, selected.id, {
        to_branch_id: edit.to_branch_id || undefined,
        to_department_id: edit.to_department_id || undefined,
        to_employee_id: edit.to_employee_id || undefined,
        to_location_id: edit.to_location_id || undefined,
        to_building_id: edit.to_building_id || undefined,
        reason: edit.reason.trim() || undefined,
        effective_date: edit.effective_date || undefined,
        transfer_notes: edit.transfer_notes.trim() || undefined,
        version: selected.version,
      });
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update transfer");
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
      if (action === "approve" || action === "reject") {
        setWorkflowComments("");
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  function renderStatusBadge(row: TransferRow) {
    return (
      <Badge variant="secondary" className="font-mono text-xs">
        {formatStatusLabel(row.status)}
        {row.workflow_status ? ` / ${row.workflow_status}` : ""}
      </Badge>
    );
  }

  return (
    <div className="space-y-6" data-testid="asset-transfer-workspace">
      <PageHeader
        title="Transfers"
        description="Manage asset transfer requests and their approval status."
      />

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Transfer register</CardTitle>
              <p className="text-sm text-muted-foreground">
                {total} transfer documents — filter by status or search by document / reason.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_120px]">
              <div className="space-y-2">
                <Label htmlFor="transfer-search">Search</Label>
                <Input
                  id="transfer-search"
                  aria-label="Search transfers"
                  placeholder="Document, asset code, asset name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-status">Status</Label>
                <Select
                  value={statusFilter || "all"}
                  onValueChange={(value) => {
                    setPage(1);
                    setStatusFilter(value === "all" ? "" : value);
                  }}
                >
                  <SelectTrigger id="transfer-status" aria-label="Filter transfers by status">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value || "all"} value={option.value || "all"}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Page</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer transition-colors"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer transition-colors"
                    disabled={page * pageSize >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm" data-testid="transfer-register-table">
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
                      From
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      To
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Effective
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={8}>
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={8}>
                        No transfers found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                      const asset = assetMap.get(row.asset_id);
                      const isSelected = selected?.id === row.id;
                      const assetLabel = asset
                        ? `${asset.asset_code} — ${asset.asset_name}`
                        : row.asset_id.slice(0, 8);
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer border-t transition-colors hover:bg-muted/40 ${
                            isSelected ? "bg-muted/50" : ""
                          }`}
                          onClick={() => selectTransfer(row)}
                          data-testid={`transfer-row-${row.document_number}`}
                        >
                          <td className={tableSerialCellClassName()}>
                            {tableRowSerial(page, pageSize, index)}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{row.document_number}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{asset?.asset_name ?? "Unresolved asset"}</div>
                            <div className="text-xs text-muted-foreground">
                              {asset?.asset_code ?? assetLabel}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {formatPlace(row.from_location_label, row.from_branch_id)}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {formatPlace(
                              row.to_location_label,
                              row.to_branch_id || row.from_branch_id,
                            )}
                          </td>
                          <td className="px-3 py-2">{renderStatusBadge(row)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {row.effective_date || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 cursor-pointer px-2 text-xs transition-colors duration-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectTransfer(row);
                              }}
                            >
                              Open
                            </Button>
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
          <Card>
            <CardHeader>
              <CardTitle>Create draft</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="draft-asset">Asset</Label>
                <Select value={draft.asset_id} onValueChange={onDraftAssetChange}>
                  <SelectTrigger id="draft-asset" aria-label="Select asset for transfer">
                    <SelectValue placeholder="Select active asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetOptions.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.asset_code} - {asset.asset_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-branch">Origin branch</Label>
                <Input id="draft-branch" value={draft.branch_id} readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-to-branch">To branch UUID</Label>
                <Input
                  id="draft-to-branch"
                  value={draft.to_branch_id}
                  onChange={(e) => setDraft((s) => ({ ...s, to_branch_id: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-to-dept">To department UUID</Label>
                <Input
                  id="draft-to-dept"
                  value={draft.to_department_id}
                  onChange={(e) => setDraft((s) => ({ ...s, to_department_id: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-to-emp">To custodian UUID</Label>
                <Input
                  id="draft-to-emp"
                  value={draft.to_employee_id}
                  onChange={(e) => setDraft((s) => ({ ...s, to_employee_id: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>To location</Label>
                <Select
                  value={draft.to_location_id}
                  onValueChange={(v) => {
                    setDraft((s) => ({ ...s, to_location_id: v, to_building_id: "" }));
                    void listSiteBuildings(v)
                      .then(setDraftBuildings)
                      .catch(() => setDraftBuildings([]));
                  }}
                >
                  <SelectTrigger className="cursor-pointer" aria-label="To location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {siteLocations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                        {loc.is_head_office ? " (Head Office)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To building</Label>
                <Select
                  value={draft.to_building_id}
                  onValueChange={(v) => setDraft((s) => ({ ...s, to_building_id: v }))}
                  disabled={!draft.to_location_id}
                >
                  <SelectTrigger className="cursor-pointer" aria-label="To building">
                    <SelectValue
                      placeholder={
                        draft.to_location_id ? "Select building" : "Select location first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {draftBuildings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-date">Effective date</Label>
                <Input
                  id="draft-date"
                  type="date"
                  value={draft.effective_date}
                  onChange={(e) => setDraft((s) => ({ ...s, effective_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="draft-reason">Reason</Label>
                <Input
                  id="draft-reason"
                  value={draft.reason}
                  onChange={(e) => setDraft((s) => ({ ...s, reason: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="draft-notes">Transfer notes</Label>
                <textarea
                  id="draft-notes"
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={draft.transfer_notes}
                  onChange={(e) => setDraft((s) => ({ ...s, transfer_notes: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  type="button"
                  className="cursor-pointer transition-colors"
                  disabled={actionLoading}
                  onClick={() => void createDraft()}
                >
                  {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SquarePen className="mr-2 h-4 w-4" />}
                  Create draft
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transfer detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Select a transfer to review, edit, or act on it.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">{selected.document_number}</div>
                      <div className="text-base font-semibold">
                        {assetMap.get(selected.asset_id)?.asset_name ?? selected.asset_id}
                      </div>
                    </div>
                    {renderStatusBadge(selected)}
                  </div>

                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <div className="rounded-md border p-3">
                      <div className="mb-1 font-medium">Current</div>
                      <div>Branch: {selected.from_branch_id ?? "None"}</div>
                      <div>Department: {selected.from_department_id ?? "None"}</div>
                      <div>Custodian: {selected.from_employee_id ?? "None"}</div>
                      <div>Location: {selected.from_location_label ?? "None"}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="mb-1 font-medium">Target</div>
                      <div>Branch: {selected.to_branch_id ?? "Unchanged"}</div>
                      <div>Department: {selected.to_department_id ?? "Unchanged"}</div>
                      <div>Custodian: {selected.to_employee_id ?? "Unchanged"}</div>
                      <div>Location: {selected.to_location_label ?? "Unchanged"}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workflow-comments">Workflow comments</Label>
                    <Input
                      id="workflow-comments"
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
                      className="cursor-pointer transition-colors"
                      disabled={actionLoading || selected.status !== "draft"}
                      onClick={() => void runAction("submit")}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Submit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors"
                      disabled={actionLoading || selected.status !== "draft"}
                      onClick={() => void runAction("cancel")}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="cursor-pointer transition-colors"
                      disabled={actionLoading || !canApproveOrReject}
                      onClick={() => void runAction("approve", { comments: workflowComments || undefined })}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors"
                      disabled={actionLoading || !canApproveOrReject}
                      onClick={() => void runAction("reject", { comments: workflowComments || undefined })}
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors"
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
                      className="cursor-pointer transition-colors"
                      disabled={
                        actionLoading ||
                        !(selected.status === "cancelled" && selected.workflow_status === "rejected")
                      }
                      onClick={() => void runAction("resubmit")}
                    >
                      Resubmit
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {selected?.status === "draft" ? (
            <Card>
              <CardHeader>
                <CardTitle>Edit draft</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-to-branch">To branch UUID</Label>
                  <Input
                    id="edit-to-branch"
                    value={edit.to_branch_id}
                    onChange={(e) => setEdit((s) => ({ ...s, to_branch_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-to-dept">To department UUID</Label>
                  <Input
                    id="edit-to-dept"
                    value={edit.to_department_id}
                    onChange={(e) => setEdit((s) => ({ ...s, to_department_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-to-emp">To custodian UUID</Label>
                  <Input
                    id="edit-to-emp"
                    value={edit.to_employee_id}
                    onChange={(e) => setEdit((s) => ({ ...s, to_employee_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>To location</Label>
                  <Select
                    value={edit.to_location_id}
                    onValueChange={(v) => {
                      setEdit((s) => ({ ...s, to_location_id: v, to_building_id: "" }));
                      void listSiteBuildings(v)
                        .then(setEditBuildings)
                        .catch(() => setEditBuildings([]));
                    }}
                  >
                    <SelectTrigger className="cursor-pointer" aria-label="Edit to location">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {siteLocations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                          {loc.is_head_office ? " (Head Office)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To building</Label>
                  <Select
                    value={edit.to_building_id}
                    onValueChange={(v) => setEdit((s) => ({ ...s, to_building_id: v }))}
                    disabled={!edit.to_location_id}
                  >
                    <SelectTrigger className="cursor-pointer" aria-label="Edit to building">
                      <SelectValue
                        placeholder={
                          edit.to_location_id ? "Select building" : "Select location first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {editBuildings.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Effective date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={edit.effective_date}
                    onChange={(e) => setEdit((s) => ({ ...s, effective_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-reason">Reason</Label>
                  <Input
                    id="edit-reason"
                    value={edit.reason}
                    onChange={(e) => setEdit((s) => ({ ...s, reason: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-notes">Transfer notes</Label>
                  <textarea
                    id="edit-notes"
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={edit.transfer_notes}
                    onChange={(e) => setEdit((s) => ({ ...s, transfer_notes: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <Button
                    type="button"
                    className="cursor-pointer transition-colors"
                    disabled={actionLoading}
                    onClick={() => void saveDraft()}
                  >
                    Save draft
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
