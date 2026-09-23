"use client";

import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableRowSerialFromIndex,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCw, Save } from "lucide-react";

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
  filterActiveCategories,
  type AssetCategoryRow,
} from "@/services/assets-service";
import { listItAssetTypes, type ItAssetType } from "@/services/asset-type-service";
import { ApiClientError, resourceService } from "@/services/api-client";

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  status: string;
  workflow_status?: string | null;
  branch_id: string;
  asset_category_id?: string;
  asset_type_id?: string | null;
  asset_type?: string;
  purchase_cost?: string | number | null;
  currency_code?: string;
  version: number;
};

type CategoryRow = {
  id: string;
  category_code: string;
  category_name: string;
  status?: string;
};

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

const STATUS_OPTIONS = ["", "draft", "submitted", "active", "cancelled"] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function parseListItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as ListPayload<T>).items;
    return Array.isArray(items) ? items : [];
  }
  return [];
}

export function AssetRegistrationWorkspace() {
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [assetTypes, setAssetTypes] = useState<ItAssetType[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AssetRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [draft, setDraft] = useState({
    asset_name: "",
    asset_type_id: "",
    currency_code: "USD",
    purchase_cost: "",
    branch_id: "",
    asset_category_id: "",
  });
  const [edit, setEdit] = useState({
    asset_name: "",
    asset_type_id: "",
    purchase_cost: "",
    currency_code: "USD",
    asset_category_id: "",
  });

  const apiPath = "/assets/assets";
  const categoryPath = "/assets/asset-categories";

  const loadCategories = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const [catRes, types] = await Promise.all([
        resourceService.list(`${categoryPath}?status=active&page=1&page_size=500`),
        listItAssetTypes({ active: true }).catch(() => [] as ItAssetType[]),
      ]);
      const items = parseListItems<CategoryRow | AssetCategoryRow>(catRes.data);
      setCategories(filterActiveCategories(items));
      setAssetTypes(types);
      const first = filterActiveCategories(items)[0];
      if (first) {
        setDraft((d) => (d.asset_category_id ? d : { ...d, asset_category_id: first.id }));
      }
      if (types[0]) {
        setDraft((d) => (d.asset_type_id ? d : { ...d, asset_type_id: types[0]!.id }));
      }
    } catch {
      setCategories([]);
      setAssetTypes([]);
    }
  }, [categoryPath]);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("q", search.trim());
      const res = await resourceService.list(`${apiPath}?${params.toString()}`);
      const payload = res.data as ListPayload<AssetRow> | AssetRow[];
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
      setError(err instanceof ApiClientError ? err.message : "Failed to load assets");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiPath, page, pageSize, search, statusFilter]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setEdit({
      asset_name: selected.asset_name ?? "",
      asset_type_id: selected.asset_type_id ?? "",
      purchase_cost: String(selected.purchase_cost ?? ""),
      currency_code: selected.currency_code ?? "USD",
      asset_category_id: selected.asset_category_id ?? "",
    });
  }, [selected]);

  const statusBadge = useMemo(
    () => (row: AssetRow) => {
      const wf = row.workflow_status ? ` / ${row.workflow_status}` : "";
      return (
        <Badge variant="secondary" className="font-mono text-xs">
          {row.status}
          {wf}
        </Badge>
      );
    },
    [],
  );

  function validateCreatePayload(): string | null {
    if (!isUuid(draft.branch_id)) return "Enter a valid branch UUID.";
    if (!draft.asset_category_id) return "No active asset category is available.";
    if (!draft.asset_type_id) return "Select an asset type.";
    if (!draft.asset_name.trim()) return "Asset name is required.";
    const cost = Number(draft.purchase_cost);
    if (!Number.isFinite(cost) || cost < 0) return "Purchase cost must be zero or greater.";
    return null;
  }

  async function runAction(action: string) {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.action(apiPath, selected.id, action);
      await load();
      const fresh = await resourceService.get<AssetRow>(apiPath, selected.id);
      setSelected(fresh.data as AssetRow);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function createDraft() {
    const validationError = validateCreatePayload();
    if (validationError) {
      setError(validationError);
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.create(apiPath, {
        branch_id: draft.branch_id.trim(),
        asset_category_id: draft.asset_category_id,
        asset_name: draft.asset_name.trim(),
        asset_type_id: draft.asset_type_id,
        purchase_date: new Date().toISOString().slice(0, 10),
        purchase_cost: Number(draft.purchase_cost),
        currency_code: draft.currency_code,
      });
      setDraft((d) => ({ ...d, asset_name: "", purchase_cost: "" }));
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Create failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveDraftEdits() {
    if (!selected || selected.status !== "draft") {
      setError("Only draft registrations can be edited.");
      return;
    }
    if (!edit.asset_category_id) {
      setError("No active asset category is available.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.update(apiPath, selected.id, {
        asset_name: edit.asset_name.trim(),
        asset_type_id: edit.asset_type_id || undefined,
        asset_category_id: edit.asset_category_id,
        purchase_cost: Number(edit.purchase_cost),
        currency_code: edit.currency_code,
        version: selected.version,
      });
      await load();
      const fresh = await resourceService.get<AssetRow>(apiPath, selected.id);
      setSelected(fresh.data as AssetRow);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Update failed");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset registration"
        description="Draft → submit → workflow approval → active register (master sync on final approve)."
      />

      {error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Register</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search code, name, serial…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-48"
                aria-label="Search assets"
              />
              <Select
                value={statusFilter || "__all"}
                onValueChange={(v) => setStatusFilter(v === "__all" ? "" : v)}
              >
                <SelectTrigger className="h-9 w-32 cursor-pointer" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all" className="cursor-pointer">
                    All
                  </SelectItem>
                  {STATUS_OPTIONS.filter(Boolean).map((s) => (
                    <SelectItem key={s} value={s} className="cursor-pointer">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="cursor-pointer"
                onClick={() => void load()}
                aria-label="Refresh list"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="py-2 pr-2" scope="col">
                        Code
                      </th>
                      <th className="py-2 pr-2" scope="col">
                        Name
                      </th>
                      <th className="py-2 pr-2" scope="col">
                        Status
                      </th>
                      <th className="py-2" scope="col">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr
                        key={row.id}
                        className={`cursor-pointer border-b transition-colors hover:bg-muted/50 ${
                          selected?.id === row.id ? "bg-muted/60" : ""
                        }`}
                        onClick={() => setSelected(row)}
                      >
                        <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
                        <td className="py-2 pr-2 font-mono text-xs">{row.asset_code}</td>
                        <td className="py-2 pr-2">{row.asset_name}</td>
                        <td className="py-2 pr-2">{statusBadge(row)}</td>
                        <td className="py-2">
                          <Link
                            href={`/assets/information-portal/${row.id}`}
                            className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors duration-200 hover:bg-muted cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-muted-foreground">
                  {total} total · page {page}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={page * pageSize >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New draft</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="branch_id">Branch ID</Label>
                <Input
                  id="branch_id"
                  value={draft.branch_id}
                  onChange={(e) => setDraft((d) => ({ ...d, branch_id: e.target.value }))}
                  placeholder="UUID"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="asset_name">Asset name</Label>
                <Input
                  id="asset_name"
                  value={draft.asset_name}
                  onChange={(e) => setDraft((d) => ({ ...d, asset_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="asset_type_id">Asset type</Label>
                <Select
                  value={draft.asset_type_id}
                  onValueChange={(v) => setDraft((d) => ({ ...d, asset_type_id: v }))}
                >
                  <SelectTrigger id="asset_type_id" className="cursor-pointer">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="cursor-pointer">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="purchase_cost">Purchase cost</Label>
                <Input
                  id="purchase_cost"
                  type="number"
                  min={0}
                  value={draft.purchase_cost}
                  onChange={(e) => setDraft((d) => ({ ...d, purchase_cost: e.target.value }))}
                />
              </div>
              <Button
                type="button"
                className="w-full cursor-pointer"
                disabled={actionLoading}
                onClick={() => void createDraft()}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Save draft
              </Button>
            </CardContent>
          </Card>

          {selected ? (
            <>
              {selected.status === "draft" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Edit draft</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="edit_name">Asset name</Label>
                      <Input
                        id="edit_name"
                        value={edit.asset_name}
                        onChange={(e) => setEdit((x) => ({ ...x, asset_name: e.target.value }))}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full cursor-pointer"
                      disabled={actionLoading}
                      onClick={() => void saveDraftEdits()}
                    >
                      <Save className="mr-2 h-4 w-4" aria-hidden />
                      Update draft
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Workflow actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="font-mono text-xs text-muted-foreground">{selected.asset_code}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="cursor-pointer"
                    disabled={actionLoading || selected.status !== "draft"}
                    onClick={() => void runAction("submit")}
                  >
                    Submit
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="cursor-pointer"
                    disabled={actionLoading || selected.status !== "submitted"}
                    onClick={() => void runAction("approve")}
                  >
                    Approve step
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={actionLoading || selected.status !== "submitted"}
                    onClick={() => void runAction("reject")}
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={actionLoading || selected.status !== "draft"}
                    onClick={() => void runAction("cancel")}
                  >
                    Cancel draft
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
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
                    className="cursor-pointer"
                    disabled={actionLoading}
                    onClick={() => void runAction("resubmit")}
                  >
                    Resubmit
                  </Button>
                  <Link
                    href={`/assets/asset-documents?asset_id=${selected.id}`}
                    className="inline-flex cursor-pointer items-center text-sm font-medium text-primary underline-offset-4 transition-colors duration-200 hover:underline"
                  >
                    Attachments
                  </Link>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
