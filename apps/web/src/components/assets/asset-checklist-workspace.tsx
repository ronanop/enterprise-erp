"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
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
  type AssetChecklistRow,
  type ChecklistItem,
  checklistService,
} from "@/services/assets-service";
import { ApiClientError, resourceService } from "@/services/api-client";

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  branch_id: string;
};

type ParentRow = { id: string; document_number: string; asset_id?: string | null };

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

const STATUS_OPTIONS = ["", "draft", "completed", "cancelled"] as const;
const PICKER_PAGE_SIZE = 25;
const DEFAULT_ITEMS: ChecklistItem[] = [
  { code: "1", label: "Visual inspection", required: true, result: null },
];

function parseListPayload<T>(data: unknown): ListPayload<T> {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as ListPayload<T>;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? PICKER_PAGE_SIZE,
    };
  }
  return { items: [], total: 0, page: 1, page_size: PICKER_PAGE_SIZE };
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return value.slice(0, 16).replace("T", " ");
}

function parseItemsJson(value: string): { items: ChecklistItem[] } | null {
  if (!value.trim()) return { items: DEFAULT_ITEMS };
  try {
    const parsed = JSON.parse(value) as { items?: ChecklistItem[] };
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return { items: parsed.items };
  } catch {
    return null;
  }
}

export function AssetChecklistWorkspace() {
  const assetsPath = "/assets/assets";
  const maintenancesPath = "/assets/asset-maintenances";
  const auditsPath = "/assets/asset-audits";

  const [rows, setRows] = useState<AssetChecklistRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<AssetChecklistRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [assetFilter, setAssetFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [itemsJsonError, setItemsJsonError] = useState<string | null>(null);
  const [maintPicker, setMaintPicker] = useState<ParentRow[]>([]);
  const [auditPicker, setAuditPicker] = useState<ParentRow[]>([]);
  const [maintSearch, setMaintSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");

  const [draft, setDraft] = useState({
    checklist_code: "",
    checklist_name: "",
    asset_id: "",
    maintenance_id: "",
    audit_id: "",
    items_json: JSON.stringify({ items: DEFAULT_ITEMS }, null, 2),
  });
  const [edit, setEdit] = useState({
    checklist_name: "",
    items_json: "",
  });

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const canEdit = selected?.status === "draft";
  const canComplete = selected?.status === "draft";
  const canCancel = selected?.status === "draft";

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

  const searchParents = useCallback(
    async (target: "maintenance" | "audit", q: string, assetId?: string) => {
      if (!isAuthenticated()) return;
      const base =
        target === "maintenance"
          ? `${maintenancesPath}?page=1&page_size=${PICKER_PAGE_SIZE}&status=completed`
          : `${auditsPath}?page=1&page_size=${PICKER_PAGE_SIZE}`;
      const query = new URLSearchParams(base.split("?")[1] ?? "");
      if (q.trim()) query.set("q", q.trim());
      if (assetId) query.set("asset_id", assetId);
      const path = `${base.split("?")[0]}?${query.toString()}`;
      try {
        const res = await resourceService.list<ListPayload<ParentRow>>(path);
        const items = parseListPayload<ParentRow>(res.data).items;
        if (target === "maintenance") setMaintPicker(items);
        else setAuditPicker(items);
      } catch {
        if (target === "maintenance") setMaintPicker([]);
        else setAuditPicker([]);
      }
    },
    [auditsPath, maintenancesPath],
  );

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await checklistService.search({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
        asset_id: assetFilter || undefined,
        q: search.trim() || undefined,
      });
      setRows(payload.items);
      setTotal(payload.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load checklists");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, assetFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!showCreate) return;
    const timer = window.setTimeout(() => {
      void searchParents("maintenance", maintSearch, draft.asset_id || undefined);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [showCreate, maintSearch, draft.asset_id, searchParents]);

  useEffect(() => {
    if (!showCreate) return;
    const timer = window.setTimeout(() => {
      void searchParents("audit", auditSearch, draft.asset_id || undefined);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [showCreate, auditSearch, draft.asset_id, searchParents]);

  useEffect(() => {
    if (!selected) return;
    setEdit({
      checklist_name: selected.checklist_name,
      items_json: JSON.stringify(selected.items_json ?? { items: [] }, null, 2),
    });
    setItemsJsonError(null);
  }, [selected]);

  async function createChecklist() {
    if (!draft.checklist_code.trim() || !draft.checklist_name.trim()) {
      setError("Code and name are required.");
      return;
    }
    if (!draft.asset_id && !draft.maintenance_id && !draft.audit_id) {
      setError("Select at least one parent link (asset, maintenance, or audit).");
      return;
    }
    const items = parseItemsJson(draft.items_json);
    if (!items) {
      setItemsJsonError("Enter valid items_json with an items array.");
      return;
    }
    setActionLoading(true);
    setError(null);
    setItemsJsonError(null);
    try {
      await checklistService.create({
        checklist_code: draft.checklist_code.trim(),
        checklist_name: draft.checklist_name.trim(),
        asset_id: draft.asset_id || undefined,
        maintenance_id: draft.maintenance_id || undefined,
        audit_id: draft.audit_id || undefined,
        items_json: items,
      });
      setShowCreate(false);
      setDraft({
        checklist_code: "",
        checklist_name: "",
        asset_id: "",
        maintenance_id: "",
        audit_id: "",
        items_json: JSON.stringify({ items: DEFAULT_ITEMS }, null, 2),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create checklist");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveDraft() {
    if (!selected || !canEdit) return;
    const items = parseItemsJson(edit.items_json);
    if (!items) {
      setItemsJsonError("Enter valid items_json with an items array.");
      return;
    }
    setActionLoading(true);
    setError(null);
    setItemsJsonError(null);
    try {
      const updated = await checklistService.update(selected.id, {
        checklist_name: edit.checklist_name.trim(),
        items_json: items,
        version: selected.version,
      });
      setSelected(updated);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update checklist");
    } finally {
      setActionLoading(false);
    }
  }

  async function runAction(action: "complete" | "cancel") {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated =
        action === "complete"
          ? await checklistService.complete(selected.id)
          : await checklistService.cancel(selected.id);
      setSelected(updated);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Failed to ${action} checklist`);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset checklists"
        description="Structured inspection checklists for assets, maintenance work orders, and physical audits."
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Checklists</CardTitle>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => setShowCreate((v) => !v)}
              >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                New checklist
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
                aria-label="Search checklists"
                placeholder="Search code or name"
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
                      Code
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Name
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
                  {loading ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={5}>
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={5}>
                        No checklists found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
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
                          <td className={tableSerialCellClassName()}>{tableRowSerial(page, pageSize, index)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.checklist_code}</td>
                          <td className="px-3 py-2">{row.checklist_name}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {asset?.asset_code ?? row.asset_id ?? "—"}
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
                <CardTitle>New checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="chk-code">Checklist code</Label>
                  <Input
                    id="chk-code"
                    value={draft.checklist_code}
                    onChange={(e) => setDraft((s) => ({ ...s, checklist_code: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chk-name">Checklist name</Label>
                  <Input
                    id="chk-name"
                    value={draft.checklist_name}
                    onChange={(e) => setDraft((s) => ({ ...s, checklist_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chk-asset">Asset (optional if maintenance/audit linked)</Label>
                  <Select
                    value={draft.asset_id || "__none"}
                    onValueChange={(value) =>
                      setDraft((s) => ({
                        ...s,
                        asset_id: value === "__none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger id="chk-asset" className="cursor-pointer">
                      <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none" className="cursor-pointer">
                        None
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
                  <Label htmlFor="chk-maint-search">Maintenance work order</Label>
                  <Input
                    id="chk-maint-search"
                    placeholder="Search completed work orders"
                    value={maintSearch}
                    onChange={(e) => setMaintSearch(e.target.value)}
                  />
                  <Select
                    value={draft.maintenance_id || "__none"}
                    onValueChange={(value) =>
                      setDraft((s) => ({
                        ...s,
                        maintenance_id: value === "__none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder="Select maintenance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none" className="cursor-pointer">
                        None
                      </SelectItem>
                      {maintPicker.map((row) => (
                        <SelectItem key={row.id} value={row.id} className="cursor-pointer">
                          {row.document_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chk-audit-search">Physical audit</Label>
                  <Input
                    id="chk-audit-search"
                    placeholder="Search audits"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                  />
                  <Select
                    value={draft.audit_id || "__none"}
                    onValueChange={(value) =>
                      setDraft((s) => ({
                        ...s,
                        audit_id: value === "__none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder="Select audit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none" className="cursor-pointer">
                        None
                      </SelectItem>
                      {auditPicker.map((row) => (
                        <SelectItem key={row.id} value={row.id} className="cursor-pointer">
                          {row.document_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chk-items">Items JSON</Label>
                  <textarea
                    id="chk-items"
                    rows={6}
                    value={draft.items_json}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDraft((s) => ({ ...s, items_json: value }));
                      setItemsJsonError(parseItemsJson(value) ? null : "Invalid items_json");
                    }}
                    className={`flex min-h-[120px] w-full rounded-md border bg-background px-3 py-2 font-mono text-xs shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      itemsJsonError ? "border-destructive" : "border-input"
                    }`}
                  />
                  {itemsJsonError ? (
                    <p className="text-xs text-destructive">{itemsJsonError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Object with items array; each item needs label; set required and result on
                      complete.
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  className="w-full cursor-pointer transition-colors duration-200"
                  disabled={actionLoading}
                  onClick={() => void createChecklist()}
                >
                  {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create draft
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
                <p className="text-muted-foreground">Select a checklist to view or edit.</p>
              ) : (
                <>
                  <div>
                    <span className="text-muted-foreground">Code:</span> {selected.checklist_code}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Completed:</span>{" "}
                    {formatDateTime(selected.completed_at)}
                  </div>
                  {canEdit ? (
                    <div className="space-y-3 border-t pt-3">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">Name</Label>
                        <Input
                          id="edit-name"
                          value={edit.checklist_name}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, checklist_name: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-items">Items JSON</Label>
                        <textarea
                          id="edit-items"
                          rows={8}
                          value={edit.items_json}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEdit((s) => ({ ...s, items_json: value }));
                            setItemsJsonError(parseItemsJson(value) ? null : "Invalid items_json");
                          }}
                          className={`flex min-h-[160px] w-full rounded-md border bg-background px-3 py-2 font-mono text-xs shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            itemsJsonError ? "border-destructive" : "border-input"
                          }`}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void saveDraft()}
                      >
                        <SquarePen className="mr-2 h-4 w-4" />
                        Save draft
                      </Button>
                    </div>
                  ) : (
                    <pre className="overflow-x-auto rounded-md bg-muted/40 p-2 text-xs">
                      {JSON.stringify(selected.items_json ?? {}, null, 2)}
                    </pre>
                  )}
                  <div className="flex gap-2 border-t pt-3">
                    <Button
                      type="button"
                      className="flex-1 cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || !canComplete}
                      onClick={() => void runAction("complete")}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 cursor-pointer transition-colors duration-200"
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
