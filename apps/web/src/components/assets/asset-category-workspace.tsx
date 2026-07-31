"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  SquarePen,
  Tags,
  Trash2,
  X,
} from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import {
  type AssetCategoryRow,
  assetCategoryService,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

const STATUS_OPTIONS = ["", "active", "inactive"] as const;
const DEPR_METHODS = ["", "straight_line", "wdv", "units_of_production"] as const;

type ModalMode = "create" | "edit" | "view";

function deprLabel(method: string | null | undefined) {
  if (!method) return "None";
  return method.replace(/_/g, " ");
}

export function AssetCategoryWorkspace() {
  const [rows, setRows] = useState<AssetCategoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [modalRow, setModalRow] = useState<AssetCategoryRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssetCategoryRow | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<AssetCategoryRow | null>(null);
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

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  function openCreate() {
    setError(null);
    setModalRow(null);
    setDraft({
      category_code: "",
      category_name: "",
      default_useful_life_months: "",
      default_depreciation_method: "",
    });
    setModalMode("create");
  }

  function openView(row: AssetCategoryRow) {
    setError(null);
    setModalRow(row);
    setModalMode("view");
  }

  function openEdit(row: AssetCategoryRow) {
    setError(null);
    setModalRow(row);
    setEdit({
      category_name: row.category_name ?? "",
      default_useful_life_months:
        row.default_useful_life_months != null ? String(row.default_useful_life_months) : "",
      default_depreciation_method: row.default_depreciation_method ?? "",
    });
    setModalMode("edit");
  }

  function closeModal() {
    if (actionLoading) return;
    setModalMode(null);
    setModalRow(null);
    setError(null);
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
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Create failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveEdit() {
    if (!modalRow) return;
    if (!edit.category_name.trim()) {
      setError("Category name is required.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const life = edit.default_useful_life_months.trim();
      await assetCategoryService.update(modalRow.id, {
        category_name: edit.category_name.trim(),
        default_useful_life_months: life ? Number(life) : null,
        default_depreciation_method: edit.default_depreciation_method || null,
        version: modalRow.version,
      });
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Update failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmDeactivate() {
    if (!deleteTarget) return;
    setActionLoading(true);
    setError(null);
    try {
      await assetCategoryService.deactivate(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Deactivate failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmReactivate() {
    if (!reactivateTarget) return;
    setActionLoading(true);
    setError(null);
    try {
      await assetCategoryService.reactivate(reactivateTarget.id);
      setReactivateTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Reactivate failed");
    } finally {
      setActionLoading(false);
    }
  }

  const modalTitle =
    modalMode === "create"
      ? "Create category"
      : modalMode === "edit"
        ? "Edit category"
        : modalMode === "view"
          ? "Category details"
          : "";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Asset Categories"
        description="Company taxonomy for asset registration — create, edit, deactivate, and reactivate. Business delete is deactivate only."
        actions={
          <div className="flex flex-wrap gap-2">
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
            <Button
              type="button"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={openCreate}
            >
              <Plus className="size-4" aria-hidden />
              Add category
            </Button>
          </div>
        }
      />

      {error && !modalMode ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader className="space-y-3 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tags className="size-4" aria-hidden />
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
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Life (mo)</th>
                  <th className="px-3 py-2 font-medium">Depreciation</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto size-5 animate-spin" aria-hidden />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      No categories found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t transition-colors duration-150 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{row.category_code}</td>
                      <td className="px-3 py-2">{row.category_name}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.default_useful_life_months ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {deprLabel(row.default_depreciation_method)}
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
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            title="View"
                            aria-label={`View ${row.category_code}`}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "icon" }),
                              "cursor-pointer",
                            )}
                            onClick={() => openView(row)}
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            type="button"
                            title="Edit"
                            aria-label={`Edit ${row.category_code}`}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "icon" }),
                              "cursor-pointer",
                            )}
                            onClick={() => openEdit(row)}
                          >
                            <SquarePen className="size-4" />
                          </button>
                          {row.status === "active" ? (
                            <button
                              type="button"
                              title="Deactivate"
                              aria-label={`Deactivate ${row.category_code}`}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "icon" }),
                                "cursor-pointer text-destructive hover:text-destructive",
                              )}
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              title="Reactivate"
                              aria-label={`Reactivate ${row.category_code}`}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "icon" }),
                                "cursor-pointer",
                              )}
                              onClick={() => setReactivateTarget(row)}
                            >
                              <RotateCcw className="size-4" />
                            </button>
                          )}
                        </div>
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

      {modalMode ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
          role="presentation"
          onClick={() => closeModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-modal-title"
            className="w-full max-w-lg rounded-xl border border-border/80 bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="category-modal-title" className="text-sm font-medium tracking-tight">
                {modalTitle}
              </h2>
              <button
                type="button"
                aria-label="Close"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "size-8 shrink-0 cursor-pointer",
                )}
                onClick={() => closeModal()}
                disabled={actionLoading}
              >
                <X className="size-4" />
              </button>
            </div>

            {error && modalMode ? (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            {modalMode === "view" && modalRow ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Code</dt>
                  <dd className="font-mono">{modalRow.category_code}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Name</dt>
                  <dd>{modalRow.category_name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Useful life (months)</dt>
                  <dd>{modalRow.default_useful_life_months ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Depreciation method</dt>
                  <dd>{deprLabel(modalRow.default_depreciation_method)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="capitalize">{modalRow.status}</dd>
                </div>
              </dl>
            ) : null}

            {modalMode === "create" ? (
              <CategoryFormFields
                codeEditable
                code={draft.category_code}
                name={draft.category_name}
                life={draft.default_useful_life_months}
                depr={draft.default_depreciation_method}
                onCodeChange={(v) => setDraft((d) => ({ ...d, category_code: v }))}
                onNameChange={(v) => setDraft((d) => ({ ...d, category_name: v }))}
                onLifeChange={(v) => setDraft((d) => ({ ...d, default_useful_life_months: v }))}
                onDeprChange={(v) => setDraft((d) => ({ ...d, default_depreciation_method: v }))}
              />
            ) : null}

            {modalMode === "edit" && modalRow ? (
              <CategoryFormFields
                codeEditable={false}
                code={modalRow.category_code}
                name={edit.category_name}
                life={edit.default_useful_life_months}
                depr={edit.default_depreciation_method}
                onNameChange={(v) => setEdit((d) => ({ ...d, category_name: v }))}
                onLifeChange={(v) => setEdit((d) => ({ ...d, default_useful_life_months: v }))}
                onDeprChange={(v) => setEdit((d) => ({ ...d, default_depreciation_method: v }))}
              />
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => closeModal()}
                disabled={actionLoading}
              >
                {modalMode === "view" ? "Close" : "Cancel"}
              </Button>
              {modalMode === "view" && modalRow ? (
                <Button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => openEdit(modalRow)}
                >
                  <SquarePen className="size-4" aria-hidden />
                  Edit
                </Button>
              ) : null}
              {modalMode === "create" ? (
                <Button
                  type="button"
                  className="cursor-pointer"
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
              ) : null}
              {modalMode === "edit" ? (
                <Button
                  type="button"
                  className="cursor-pointer"
                  disabled={actionLoading}
                  onClick={() => void saveEdit()}
                >
                  {actionLoading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden />
                  )}
                  Save
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Deactivate ${deleteTarget.category_code}?` : ""}
        description="Business delete only — the category stays in the database as inactive. Blocked if operational assets still reference it."
        confirmLabel="Deactivate"
        tone="destructive"
        busy={actionLoading}
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(reactivateTarget)}
        title={reactivateTarget ? `Reactivate ${reactivateTarget.category_code}?` : ""}
        description="Restores the category to active so it appears in registration dropdowns."
        confirmLabel="Reactivate"
        busy={actionLoading}
        onConfirm={() => void confirmReactivate()}
        onCancel={() => setReactivateTarget(null)}
      />
    </div>
  );
}

function CategoryFormFields({
  codeEditable,
  code,
  name,
  life,
  depr,
  onCodeChange,
  onNameChange,
  onLifeChange,
  onDeprChange,
}: {
  codeEditable?: boolean;
  code: string;
  name: string;
  life: string;
  depr: string;
  onCodeChange?: (v: string) => void;
  onNameChange: (v: string) => void;
  onLifeChange: (v: string) => void;
  onDeprChange: (v: string) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cat_code">Code</Label>
        <Input
          id="cat_code"
          value={code}
          disabled={!codeEditable}
          onChange={(e) => onCodeChange?.(e.target.value)}
          placeholder="IT"
          className="font-mono uppercase"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cat_name">Name</Label>
        <Input
          id="cat_name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
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
            value={life}
            onChange={(e) => onLifeChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat_depr">Depreciation method</Label>
          <Select
            value={depr || "__none"}
            onValueChange={(v) => onDeprChange(v === "__none" ? "" : v)}
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
                  {deprLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
