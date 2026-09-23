"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  FileUp,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  User,
  Wrench,
  X,
} from "lucide-react";

import { NonItAssignDialog } from "@/components/assets/non-it/non-it-assign-dialog";
import { NonItDisposeDialog } from "@/components/assets/non-it/non-it-dispose-dialog";
import { NonItImportDialog } from "@/components/assets/non-it/non-it-import-dialog";
import { NonItMaintenanceCompleteDialog } from "@/components/assets/non-it/non-it-maintenance-complete-dialog";
import { NonItMaintenanceStartDialog } from "@/components/assets/non-it/non-it-maintenance-start-dialog";
import { InventoryFilterPopover } from "@/components/assets/inventory/inventory-filter-popover";
import {
  EmptyState,
  isNonItAssetStatus,
  StatusBadge,
  TableRowsSkeleton,
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  listNonItAssetTypes,
  listNonItAssets,
  listNonItLocations,
  unassignNonItAsset,
  type NonItAsset,
  type NonItAssetType,
  type NonItLocation,
} from "@/services/nonit-asset-service";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "IN_STOCK", label: "In stock" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "DISPOSED", label: "Disposed" },
] as const;

const ASSIGNMENT_OPTIONS = [
  { value: "assigned", label: "Assigned" },
  { value: "unassigned", label: "Unassigned" },
] as const;

const TABLE_COLUMNS = ["Asset", "Type", "Status", "Assignment"] as const;

function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

type Filters = {
  q: string;
  asset_type_id: string;
  location_id: string;
  status: string;
  assignment: string;
};

const EMPTY_FILTERS: Filters = {
  q: "",
  asset_type_id: "",
  location_id: "",
  status: "",
  assignment: "",
};

function countAdvancedFilters(filters: Filters): number {
  let n = 0;
  if (filters.asset_type_id) n += 1;
  if (filters.location_id) n += 1;
  if (filters.assignment) n += 1;
  return n;
}

function statusFromSearch(raw: string | null): string {
  if (!raw) return "";
  return isNonItAssetStatus(raw) ? raw : "";
}

function AssignmentCell({ row }: { row: NonItAsset }) {
  if (!row.assignment_display) {
    return <span className="text-muted-foreground">—</span>;
  }
  const isLocation = Boolean(row.current_location_id);
  const Icon = isLocation ? MapPin : User;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
        <Icon className="size-3" aria-hidden />
      </span>
      <span className="truncate text-foreground">{row.assignment_display}</span>
    </div>
  );
}

export function NonItAssetsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = statusFromSearch(searchParams.get("status"));

  const [types, setTypes] = useState<NonItAssetType[]>([]);
  const [locations, setLocations] = useState<NonItLocation[]>([]);
  const [rows, setRows] = useState<NonItAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [draft, setDraft] = useState<Filters>({ ...EMPTY_FILTERS, status: initialStatus });
  const [applied, setApplied] = useState<Filters>({ ...EMPTY_FILTERS, status: initialStatus });
  const [quickSearch, setQuickSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [assignAsset, setAssignAsset] = useState<NonItAsset | null>(null);
  const [maintStartAsset, setMaintStartAsset] = useState<NonItAsset | null>(null);
  const [maintDoneAsset, setMaintDoneAsset] = useState<NonItAsset | null>(null);
  const [disposeAsset, setDisposeAsset] = useState<NonItAsset | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    const next = statusFromSearch(searchParams.get("status"));
    setApplied((prev) => (prev.status === next ? prev : { ...prev, status: next }));
    setDraft((prev) => (prev.status === next ? prev : { ...prev, status: next }));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [typeItems, locItems] = await Promise.all([
          listNonItAssetTypes(),
          listNonItLocations({ active: true }),
        ]);
        if (!cancelled) {
          setTypes(typeItems);
          setLocations(locItems);
        }
      } catch {
        if (!cancelled) {
          setTypes([]);
          setLocations([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listNonItAssets({
        page,
        page_size: pageSize,
        asset_type_id: applied.asset_type_id || undefined,
        location_id: applied.location_id || undefined,
        status: applied.status || undefined,
        assignment: applied.assignment || undefined,
        q: applied.q || undefined,
      });
      setRows(result.items);
      setTotal(result.total);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(formatApiError(err, "Failed to load Non-IT assets"));
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const advancedFilterCount = useMemo(() => countAdvancedFilters(applied), [applied]);
  const filtersActive =
    Boolean(applied.q.trim()) ||
    Boolean(applied.status) ||
    advancedFilterCount > 0;

  const activeChips = useMemo(() => {
    const chips: { key: keyof Filters; label: string }[] = [];
    if (applied.q.trim()) chips.push({ key: "q", label: `Search: ${applied.q.trim()}` });
    if (applied.asset_type_id) {
      const t = types.find((x) => x.id === applied.asset_type_id);
      chips.push({ key: "asset_type_id", label: `Type: ${t?.name ?? applied.asset_type_id}` });
    }
    if (applied.location_id) {
      const loc = locations.find((x) => x.id === applied.location_id);
      chips.push({
        key: "location_id",
        label: `Location: ${loc?.name ?? applied.location_id}`,
      });
    }
    if (applied.assignment) {
      const a = ASSIGNMENT_OPTIONS.find((x) => x.value === applied.assignment);
      chips.push({
        key: "assignment",
        label: `Assignment: ${a?.label ?? applied.assignment}`,
      });
    }
    return chips;
  }, [applied, types, locations]);

  function applyFilters(next: Filters) {
    setApplied(next);
    setDraft(next);
    setPage(1);
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    const qs = params.toString();
    router.replace(qs ? `/assets/non-it/inventory?${qs}` : "/assets/non-it/inventory");
  }

  function dismissChip(key: keyof Filters) {
    const next = { ...applied, [key]: "" };
    applyFilters(next);
    if (key === "q") setQuickSearch("");
  }

  function resetFilters() {
    setQuickSearch("");
    applyFilters(EMPTY_FILTERS);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const emptyTitle = filtersActive ? "No results" : "No Non-IT assets yet";
  const emptyDescription = filtersActive
    ? "Try adjusting filters or search terms."
    : "Import an Excel file or add an asset to seed inventory.";

  async function afterMutation() {
    await load();
  }

  return (
    <div className="relative space-y-5" data-testid="nonit-inventory-workspace">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-2 h-40 overflow-hidden rounded-xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(3,105,161,0.08),_transparent_55%)]" />
      </div>

      <div className="relative space-y-5">
        <PageHeader
          title="Non-IT Inventory"
          description="Search, filter, and manage furniture and facilities assets."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer gap-2 transition-colors duration-200"
                onClick={() => setImportOpen(true)}
              >
                <FileUp className="size-4" aria-hidden />
                Import Excel
              </Button>
              <Button
                type="button"
                className="cursor-pointer gap-2 bg-[#0369A1] text-white transition-colors duration-200 hover:bg-[#0369A1]/90"
                onClick={() => router.push("/assets/non-it/new")}
              >
                <Plus className="size-4" aria-hidden />
                Add asset
              </Button>
            </div>
          }
        />

        <Card className="overflow-hidden border-border/70 bg-background/95 shadow-md">
          <div className="space-y-3 border-b border-border/50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 sm:max-w-md">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      applyFilters({ ...applied, q: quickSearch.trim() });
                    }
                  }}
                  placeholder="Search code, type, assignee, location…"
                  className="h-10 pl-9"
                  aria-label="Search Non-IT assets"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  id="nonit-status-filter"
                  data-testid="nonit-status-dropdown"
                  aria-label="Status"
                  className="flex h-10 min-w-[9.5rem] cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200"
                  value={applied.status}
                  onChange={(e) => applyFilters({ ...applied, status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <InventoryFilterPopover activeCount={advancedFilterCount}>
                  {({ close }) => (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label
                          className="text-xs font-medium text-muted-foreground"
                          htmlFor="nonit-filter-type"
                        >
                          Type
                        </label>
                        <select
                          id="nonit-filter-type"
                          className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-sm"
                          value={draft.asset_type_id}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, asset_type_id: e.target.value }))
                          }
                        >
                          <option value="">All types</option>
                          {types.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.prefix})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label
                          className="text-xs font-medium text-muted-foreground"
                          htmlFor="nonit-filter-location"
                        >
                          Location
                        </label>
                        <select
                          id="nonit-filter-location"
                          className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-sm"
                          value={draft.location_id}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, location_id: e.target.value }))
                          }
                        >
                          <option value="">All locations</option>
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label
                          className="text-xs font-medium text-muted-foreground"
                          htmlFor="nonit-filter-assignment"
                        >
                          Assignment
                        </label>
                        <select
                          id="nonit-filter-assignment"
                          className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-sm"
                          value={draft.assignment}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, assignment: e.target.value }))
                          }
                        >
                          <option value="">Any</option>
                          {ASSIGNMENT_OPTIONS.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          className="cursor-pointer transition-colors duration-200"
                          onClick={() => {
                            resetFilters();
                            close();
                          }}
                        >
                          Reset
                        </Button>
                        <Button
                          type="button"
                          className="cursor-pointer bg-[#0369A1] text-white transition-colors duration-200 hover:bg-[#0369A1]/90"
                          onClick={() => {
                            applyFilters({
                              ...draft,
                              status: applied.status,
                              q: quickSearch.trim() || draft.q,
                            });
                            close();
                          }}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  )}
                </InventoryFilterPopover>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 cursor-pointer text-muted-foreground transition-colors duration-200"
                  aria-label="Refresh"
                  disabled={loading}
                  onClick={() => {
                    void load();
                  }}
                >
                  <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
                </Button>
              </div>
            </div>

            {activeChips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5" data-testid="nonit-filter-chips">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs transition-colors duration-200 hover:bg-muted"
                    onClick={() => dismissChip(chip.key)}
                  >
                    {chip.label}
                    <X className="size-3" aria-hidden />
                  </button>
                ))}
                <button
                  type="button"
                  className="cursor-pointer px-1.5 text-xs font-medium text-[#0369A1] transition-colors duration-200 hover:underline"
                  onClick={resetFilters}
                >
                  Clear all
                </button>
              </div>
            ) : null}
          </div>

          {error ? (
            <div
              className="flex flex-col gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              role="alert"
            >
              <p className="text-sm text-destructive">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => void load()}
              >
                Retry
              </Button>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm" data-testid="nonit-inventory-table">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className={tableSerialHeaderClassName()} scope="col">
                    {TABLE_SERIAL_HEADER_LABEL}
                  </th>
                  {TABLE_COLUMNS.map((col) => (
                    <th key={col} className="px-4 py-2.5 font-semibold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length + 2} className="p-4">
                      <TableRowsSkeleton rows={6} />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length + 2} className="p-8">
                      <div className="space-y-4">
                        <EmptyState
                          variant={filtersActive ? "no-results" : "no-assets"}
                          title={emptyTitle}
                          description={emptyDescription}
                        />
                        <div className="flex flex-wrap justify-center gap-2">
                          {filtersActive ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="cursor-pointer"
                              onClick={resetFilters}
                            >
                              Clear filters
                            </Button>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="cursor-pointer gap-1.5"
                                onClick={() => setImportOpen(true)}
                              >
                                <FileUp className="size-3.5" aria-hidden />
                                Import Excel
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="cursor-pointer gap-1.5 bg-[#0369A1] text-white hover:bg-[#0369A1]/90"
                                onClick={() => router.push("/assets/non-it/new")}
                              >
                                <Plus className="size-3.5" aria-hidden />
                                Add asset
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-t border-border/50 transition-colors duration-200 hover:bg-muted/20 motion-reduce:transition-none"
                    >
                      <td className={tableSerialCellClassName()}>{tableRowSerial(page, pageSize, index)}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/assets/non-it/${row.id}`}
                          className="group inline-flex cursor-pointer flex-col gap-0.5 transition-colors duration-200"
                        >
                          <span className="font-mono text-xs font-semibold text-foreground group-hover:text-[#0369A1]">
                            {row.asset_code}
                          </span>
                          {row.remarks ? (
                            <span className="line-clamp-1 text-[11px] text-muted-foreground">
                              {row.remarks}
                            </span>
                          ) : null}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {row.asset_type_name ?? "—"}
                          </p>
                          {row.asset_type_prefix ? (
                            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                              {row.asset_type_prefix}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge kind="nonIt" status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        <AssignmentCell row={row} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1">
                          {row.status !== "DISPOSED" &&
                            (row.status === "IN_STOCK" || row.status === "ASSIGNED") && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 cursor-pointer px-2.5 text-xs transition-colors duration-200"
                                disabled={actionBusy}
                                onClick={() => setAssignAsset(row)}
                              >
                                {row.status === "ASSIGNED" ? "Reassign" : "Assign"}
                              </Button>
                            )}
                          {row.status !== "DISPOSED" &&
                            (row.status === "ASSIGNED" ||
                              row.current_employee_id ||
                              row.current_location_id) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 cursor-pointer px-2.5 text-xs transition-colors duration-200"
                                disabled={actionBusy}
                                onClick={() => {
                                  void (async () => {
                                    if (!window.confirm(`Unassign ${row.asset_code}?`)) return;
                                    setActionBusy(true);
                                    setError(null);
                                    try {
                                      await unassignNonItAsset(row.id, {
                                        version: row.version,
                                      });
                                      await afterMutation();
                                    } catch (err) {
                                      setError(formatApiError(err, "Unassign failed"));
                                    } finally {
                                      setActionBusy(false);
                                    }
                                  })();
                                }}
                              >
                                Unassign
                              </Button>
                            )}
                          {row.status !== "DISPOSED" &&
                            (row.status === "IN_STOCK" || row.status === "ASSIGNED") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 cursor-pointer gap-1 px-2.5 text-xs transition-colors duration-200"
                                disabled={actionBusy}
                                onClick={() => setMaintStartAsset(row)}
                              >
                                <Wrench className="size-3" aria-hidden />
                                Maint.
                              </Button>
                            )}
                          {row.status === "MAINTENANCE" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 cursor-pointer px-2.5 text-xs transition-colors duration-200"
                              disabled={actionBusy}
                              onClick={() => setMaintDoneAsset(row)}
                            >
                              Complete
                            </Button>
                          )}
                          {row.status !== "DISPOSED" &&
                            (row.status === "IN_STOCK" ||
                              row.status === "ASSIGNED" ||
                              row.status === "MAINTENANCE") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 cursor-pointer px-2.5 text-xs text-destructive transition-colors duration-200 hover:text-destructive"
                                disabled={actionBusy}
                                onClick={() => setDisposeAsset(row)}
                              >
                                Dispose
                              </Button>
                            )}
                          <Button
                            asChild
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 cursor-pointer gap-1 px-2.5 text-xs transition-colors duration-200"
                          >
                            <Link href={`/assets/non-it/${row.id}`}>
                              <Eye className="size-3" aria-hidden />
                              View
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {rows.length} of {total} assets
              {totalPages > 1 ? ` · page ${page} of ${totalPages}` : null}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <NonItImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        types={types}
        onImported={() => {
          setPage(1);
          void afterMutation();
        }}
      />

      {assignAsset ? (
        <NonItAssignDialog
          open={Boolean(assignAsset)}
          asset={assignAsset}
          onOpenChange={(open) => {
            if (!open) setAssignAsset(null);
          }}
          onDone={() => {
            setAssignAsset(null);
            void afterMutation();
          }}
        />
      ) : null}
      {maintStartAsset ? (
        <NonItMaintenanceStartDialog
          open
          asset={maintStartAsset}
          onOpenChange={(open) => {
            if (!open) setMaintStartAsset(null);
          }}
          onDone={() => {
            setMaintStartAsset(null);
            void afterMutation();
          }}
        />
      ) : null}
      {maintDoneAsset ? (
        <NonItMaintenanceCompleteDialog
          open
          asset={maintDoneAsset}
          onOpenChange={(open) => {
            if (!open) setMaintDoneAsset(null);
          }}
          onDone={() => {
            setMaintDoneAsset(null);
            void afterMutation();
          }}
        />
      ) : null}
      {disposeAsset ? (
        <NonItDisposeDialog
          open
          asset={disposeAsset}
          onOpenChange={(open) => {
            if (!open) setDisposeAsset(null);
          }}
          onDone={() => {
            setDisposeAsset(null);
            void afterMutation();
          }}
        />
      ) : null}
    </div>
  );
}
