"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Power,
  PowerOff,
  RefreshCw,
  SquarePen,
  Tags,
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
import {
  ASSETS_SURFACE_CARD,
  AssetsPremiumPage,
} from "@/components/assets/shared/premium-surface";
import { isAuthenticated } from "@/lib/auth";
import {
  type AssetCategoryRow,
  assetCategoryService,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

const STATUS_OPTIONS = ["", "active", "inactive"] as const;
const DEPR_METHODS = ["", "straight_line", "wdv", "units_of_production"] as const;

type ConfirmAction = "deactivate" | "reactivate" | null;

export function AssetCategoryWorkspace() {
  const [rows, setRows] = useState<AssetCategoryRow[]>([]);
  const [selected, setSelected] = useState<AssetCategoryRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [draft, setDraft] = useState({
    category_code: "",
    category_name: "",
    default_useful_life_months: "",
    default_depreciation_method: "",
  });
  const [edit, setEdit] = useState({
    category_name: "",
    default_useful_life_months: "",
    default_depreciation_method: "",
  });

  const canDeactivate = selected?.status === "active";
  const canReactivate = selected?.status === "inactive";

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await assetCategoryService.search({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
        q: search.trim() || undefined,
      });
      setRows(payload.items);
      setTotal(payload.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load categories");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setEdit({
      category_name: selected.category_name ?? "",
      default_useful_life_months:
        selected.default_useful_life_months != null
          ? String(selected.default_useful_life_months)
          : "",
      default_depreciation_method: selected.default_depreciation_method ?? "",
    });
    setConfirmAction(null);
  }, [selected]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  async function refreshSelected(id: string) {
    try {
      const row = await assetCategoryService.get(id);
      setSelected(row);
    } catch {
      setSelected(null);
    }
  }

  async function createCategory() {
    if (!draft.category_code.trim()) {
      setError("Category code is required.");
      return;
    }
    if (!draft.category_name.trim()) {
      setError("Category name is required.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const life = draft.default_useful_life_months.trim();
      await assetCategoryService.create({
        category_code: draft.category_code.trim().toUpperCase(),
        category_name: draft.category_name.trim(),
        default_useful_life_months: life ? Number(life) : undefined,
        default_depreciation_method: draft.default_depreciation_method || undefined,
      });
      setDraft({
        category_code: "",
        category_name: "",
        default_useful_life_months: "",
        default_depreciation_method: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Create failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveEdit() {
    if (!selected) return;
    if (!edit.category_name.trim()) {
      setError("Category name is required.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const life = edit.default_useful_life_months.trim();
      await assetCategoryService.update(selected.id, {
        category_name: edit.category_name.trim(),
        default_useful_life_months: life ? Number(life) : null,
        default_depreciation_method: edit.default_depreciation_method || null,
        version: selected.version,
      });
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Update failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function runConfirmAction() {
    if (!selected || !confirmAction) return;
    setActionLoading(true);
    setError(null);
    try {
      if (confirmAction === "deactivate") {
        await assetCategoryService.deactivate(selected.id);
      } else {
        await assetCategoryService.reactivate(selected.id);
      }
      setConfirmAction(null);
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : confirmAction === "deactivate"
            ? "Deactivate failed"
            : "Reactivate failed",
      );
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AssetsPremiumPage>
      <PageHeader
        title="Asset Categories"
        description="Company taxonomy for IT asset registration — create, edit, deactivate, and reactivate."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => void load()}
            disabled={loading || actionLoading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Refresh
          </Button>
        }
      />

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className={`lg:col-span-7 ${ASSETS_SURFACE_CARD}`}>
          <CardHeader className="space-y-3 border-b border-border/50 pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="flex size-7 items-center justify-center rounded-lg bg-[rgba(3,105,161,0.1)] text-[#0369A1]">
                <Tags className="size-3.5" aria-hidden />
              </span>
              Categories
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Input
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Search code or name"
                className="max-w-xs"
              />
              <Select
                value={statusFilter || "__all"}
                onValueChange={(v) => {
                  setPage(1);
                  setStatusFilter(v === "__all" ? "" : v);
                }}
              >
                <SelectTrigger className="w-40 cursor-pointer">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all" className="cursor-pointer">
                    All statuses
                  </SelectItem>
                  {STATUS_OPTIONS.filter(Boolean).map((s) => (
                    <SelectItem key={s} value={s} className="cursor-pointer">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Life (mo)</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        <Loader2 className="mx-auto size-5 animate-spin" aria-hidden />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        No categories found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                      <tr
                        key={row.id}
                        className={`cursor-pointer border-t transition-colors duration-150 hover:bg-muted/40 ${
                          selected?.id === row.id ? "bg-muted/50" : ""
                        }`}
                        onClick={() => setSelected(row)}
                      >
                        <td className={tableSerialCellClassName()}>{tableRowSerial(page, pageSize, index)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.category_code}</td>
                        <td className="px-3 py-2">{row.category_name}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {row.default_useful_life_months ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="secondary"
                            className={
                              row.status === "active"
                                ? "bg-emerald-100 text-emerald-900"
                                : "bg-amber-100 text-amber-900"
                            }
                          >
                            {row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {total} total · page {page} of {pageCount}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={page >= pageCount || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-5">
          <Card className={ASSETS_SURFACE_CARD}>
            <CardHeader className="border-b border-border/50 pb-3 pt-4">
              <CardTitle className="text-sm font-semibold tracking-tight">Create category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="cat_code">Code</Label>
                <Input
                  id="cat_code"
                  value={draft.category_code}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, category_code: e.target.value }))
                  }
                  placeholder="IT"
                  className="font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat_name">Name</Label>
                <Input
                  id="cat_name"
                  value={draft.category_name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, category_name: e.target.value }))
                  }
                  placeholder="Information Technology"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cat_life">Useful life (months)</Label>
                  <Input
                    id="cat_life"
                    type="number"
                    min={0}
                    value={draft.default_useful_life_months}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        default_useful_life_months: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat_depr">Depreciation method</Label>
                  <Select
                    value={draft.default_depreciation_method || "__none"}
                    onValueChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        default_depreciation_method: v === "__none" ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger id="cat_depr" className="cursor-pointer">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none" className="cursor-pointer">
                        None
                      </SelectItem>
                      {DEPR_METHODS.filter(Boolean).map((m) => (
                        <SelectItem key={m} value={m} className="cursor-pointer">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="button"
                className="cursor-pointer transition-colors duration-200"
                disabled={actionLoading}
                onClick={() => void createCategory()}
              >
                {actionLoading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden />
                )}
                Create
              </Button>
            </CardContent>
          </Card>

          <Card className={ASSETS_SURFACE_CARD}>
            <CardHeader className="border-b border-border/50 pb-3 pt-4">
              <CardTitle className="text-sm font-semibold tracking-tight">
                {selected ? "Edit category" : "Select a category"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">
                  Select a row to edit, deactivate, or reactivate.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Code</Label>
                    <Input
                      value={selected.category_code}
                      disabled
                      className="font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit_name">Name</Label>
                    <Input
                      id="edit_name"
                      value={edit.category_name}
                      onChange={(e) =>
                        setEdit((d) => ({ ...d, category_name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit_life">Useful life (months)</Label>
                      <Input
                        id="edit_life"
                        type="number"
                        min={0}
                        value={edit.default_useful_life_months}
                        onChange={(e) =>
                          setEdit((d) => ({
                            ...d,
                            default_useful_life_months: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit_depr">Depreciation method</Label>
                      <Select
                        value={edit.default_depreciation_method || "__none"}
                        onValueChange={(v) =>
                          setEdit((d) => ({
                            ...d,
                            default_depreciation_method: v === "__none" ? "" : v,
                          }))
                        }
                      >
                        <SelectTrigger id="edit_depr" className="cursor-pointer">
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none" className="cursor-pointer">
                            None
                          </SelectItem>
                          {DEPR_METHODS.filter(Boolean).map((m) => (
                            <SelectItem key={m} value={m} className="cursor-pointer">
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading}
                      onClick={() => void saveEdit()}
                    >
                      <SquarePen className="size-4" aria-hidden />
                      Save
                    </Button>
                    {canDeactivate ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => setConfirmAction("deactivate")}
                      >
                        <PowerOff className="size-4" aria-hidden />
                        Deactivate
                      </Button>
                    ) : null}
                    {canReactivate ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => setConfirmAction("reactivate")}
                      >
                        <Power className="size-4" aria-hidden />
                        Reactivate
                      </Button>
                    ) : null}
                  </div>

                  {confirmAction ? (
                    <div
                      role="alertdialog"
                      aria-labelledby="cat-confirm-title"
                      className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2"
                    >
                      <p id="cat-confirm-title" className="text-sm font-medium text-amber-950">
                        {confirmAction === "deactivate"
                          ? `Deactivate ${selected.category_code}?`
                          : `Reactivate ${selected.category_code}?`}
                      </p>
                      <p className="text-xs text-amber-900">
                        {confirmAction === "deactivate"
                          ? "Business delete only — the category stays in the database as inactive. Blocked if operational assets still reference it."
                          : "Restores the category to active so it appears in registration dropdowns."}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="cursor-pointer"
                          disabled={actionLoading}
                          onClick={() => void runConfirmAction()}
                        >
                          {actionLoading ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : null}
                          Confirm
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          disabled={actionLoading}
                          onClick={() => setConfirmAction(null)}
                        >
                          Cancel
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
    </AssetsPremiumPage>
  );
}
