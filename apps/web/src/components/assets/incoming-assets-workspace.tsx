"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  PackageCheck,
  PackageOpen,
  RefreshCw,
} from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
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
  BRANCH_ALL_VALUE,
  BranchSelector,
  EmptyState,
  StatCard,
  type BranchOption,
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableRowSerialFromIndex,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import { listBranchOptions } from "@/lib/org-options";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  incomingAssetService,
  type IncomingAssetLineRow,
  type IncomingAssetSummary,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "EXPECTED", label: "Expected" },
  { value: "PARTIALLY_ARRIVED", label: "Partially arrived" },
  { value: "ARRIVED", label: "Arrived" },
] as const;

function toNumber(value: number | string | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatQty(value: number | string | null | undefined): string {
  const n = toNumber(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

function arrivalBadge(status: string) {
  const map: Record<string, string> = {
    EXPECTED: "border-slate-200 bg-slate-50 text-slate-800",
    PARTIALLY_ARRIVED: "border-amber-200 bg-amber-50 text-amber-950",
    ARRIVED: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  const label =
    status === "PARTIALLY_ARRIVED"
      ? "PARTIALLY ARRIVED"
      : status === "EXPECTED"
        ? "EXPECTED"
        : status === "ARRIVED"
          ? "ARRIVED"
          : status;
  return (
    <Badge variant="outline" className={cn("font-medium", map[status] ?? "")}>
      {label}
    </Badge>
  );
}

function emptySummary(): IncomingAssetSummary {
  return {
    expected_lines: 0,
    pending_arrival_lines: 0,
    partially_arrived_lines: 0,
    arrived_lines: 0,
    expected_quantity_total: 0,
    arrived_quantity_total: 0,
    pending_quantity_total: 0,
  };
}

export function IncomingAssetsWorkspace() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchFilter, setBranchFilter] = useState(BRANCH_ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [rows, setRows] = useState<IncomingAssetLineRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<IncomingAssetSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selected, setSelected] = useState<IncomingAssetLineRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [receiveMode, setReceiveMode] = useState<"quantity" | "individual">("quantity");
  const [quantity, setQuantity] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<{
    markAll?: boolean;
    quantity?: number;
    unitIndex?: number;
  } | null>(null);

  const branchLabel = useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.label]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [branches]);

  const loadMeta = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const opts = await listBranchOptions();
      setBranches(opts);
    } catch {
      setBranches([]);
    }
  }, []);

  const load = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      setError("Sign in to view incoming assets.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const branchId = branchFilter === BRANCH_ALL_VALUE ? undefined : branchFilter;
      const [list, sum] = await Promise.all([
        incomingAssetService.search({
          page,
          page_size: pageSize,
          branch_id: branchId,
          status: statusFilter || undefined,
          document_date_from: dateFrom || undefined,
          document_date_to: dateTo || undefined,
          q: search.trim() || undefined,
        }),
        incomingAssetService.summary({ branch_id: branchId }),
      ]);
      setRows(list.items);
      setTotal(list.total);
      setSummary(sum);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load incoming assets",
      );
      setRows([]);
      setTotal(0);
      setSummary(emptySummary());
    } finally {
      setLoading(false);
    }
  }, [branchFilter, dateFrom, dateTo, page, pageSize, search, statusFilter]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openReceive(row: IncomingAssetLineRow) {
    setSuccess(null);
    setError(null);
    setReceiveMode("quantity");
    setDetailLoading(true);
    setSelected(row);
    setQuantity(String(toNumber(row.pending_quantity) || ""));
    try {
      const detail = await incomingAssetService.get(row.id);
      setSelected(detail);
      setQuantity(String(toNumber(detail.pending_quantity) || ""));
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load incoming line detail",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function requestArrive(payload: {
    markAll?: boolean;
    quantity?: number;
    unitIndex?: number;
  }) {
    if (!selected) return;
    const pending = toNumber(selected.pending_quantity);
    if (pending <= 0) {
      setError("This line is already fully arrived.");
      return;
    }
    if (payload.markAll) {
      setConfirmPayload({ markAll: true });
      setConfirmOpen(true);
      return;
    }
    if (payload.unitIndex != null) {
      setConfirmPayload({ unitIndex: payload.unitIndex, quantity: 1 });
      setConfirmOpen(true);
      return;
    }
    const qty = payload.quantity ?? Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }
    if (qty > pending) {
      setError(`Quantity cannot exceed remaining (${formatQty(pending)}).`);
      return;
    }
    setConfirmPayload({ quantity: qty });
    setConfirmOpen(true);
  }

  async function submitArrive() {
    if (!selected || !confirmPayload) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      let updated: IncomingAssetLineRow;
      if (confirmPayload.markAll) {
        updated = await incomingAssetService.arrive(selected.id, { mark_all: true });
      } else if (confirmPayload.unitIndex != null) {
        updated = await incomingAssetService.arrive(selected.id, {
          units: [{ unit_index: confirmPayload.unitIndex }],
        });
      } else {
        updated = await incomingAssetService.arrive(selected.id, {
          quantity: confirmPayload.quantity,
        });
      }
      setSelected(updated);
      setQuantity(String(toNumber(updated.pending_quantity) || ""));
      setSuccess(
        `Marked ${formatQty(
          confirmPayload.markAll
            ? toNumber(selected.pending_quantity)
            : (confirmPayload.quantity ?? 1),
        )} as arrived.`,
      );
      setConfirmOpen(false);
      setConfirmPayload(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to mark arrival");
      setConfirmOpen(false);
    } finally {
      setActionLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pendingSelected = selected ? toNumber(selected.pending_quantity) : 0;
  const canReceive = Boolean(selected && pendingSelected > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Incoming Assets"
        description="Assets received from Procurement/SCM and waiting for IT receiving/QC."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Expected"
          value={summary.expected_lines}
          icon={ClipboardList}
          loading={loading}
          onClick={() => {
            setStatusFilter("");
            setPage(1);
          }}
        />
        <StatCard
          title="Pending Arrival"
          value={summary.pending_arrival_lines}
          icon={PackageOpen}
          loading={loading}
          onClick={() => {
            setStatusFilter("EXPECTED");
            setPage(1);
          }}
        />
        <StatCard
          title="Partially Arrived"
          value={summary.partially_arrived_lines}
          icon={PackageCheck}
          loading={loading}
          onClick={() => {
            setStatusFilter("PARTIALLY_ARRIVED");
            setPage(1);
          }}
        />
        <StatCard
          title="Arrived"
          value={summary.arrived_lines}
          icon={CheckCircle2}
          loading={loading}
          onClick={() => {
            setStatusFilter("ARRIVED");
            setPage(1);
          }}
        />
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardContent className="flex flex-col gap-3 pt-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor="incoming-search">Search</Label>
            <div className="flex gap-2">
              <Input
                id="incoming-search"
                placeholder="GRN, PO, product…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearch(searchInput);
                    setPage(1);
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                className="cursor-pointer"
                onClick={() => {
                  setSearch(searchInput);
                  setPage(1);
                }}
              >
                Search
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <BranchSelector
              value={branchFilter}
              onChange={(v) => {
                setBranchFilter(v);
                setPage(1);
              }}
              branches={branches}
              allLabel="All branches"
            />
          </div>
          <div className="w-full space-y-1.5 sm:w-48">
            <Label>Status</Label>
            <Select
              value={statusFilter || "all"}
              onValueChange={(v) => {
                setStatusFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value || "all"}
                    value={opt.value || "all"}
                    className="cursor-pointer"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="incoming-from">From</Label>
            <Input
              id="incoming-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="incoming-to">To</Label>
            <Input
              id="incoming-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)]">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Incoming queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="px-3 py-2 font-medium">GRN</th>
                    <th className="px-3 py-2 font-medium">PO</th>
                    <th className="px-3 py-2 font-medium">Asset / Product</th>
                    <th className="px-3 py-2 font-medium">Vendor</th>
                    <th className="px-3 py-2 font-medium text-right">Expected</th>
                    <th className="px-3 py-2 font-medium text-right">Arrived</th>
                    <th className="px-3 py-2 font-medium text-right">Pending</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-3 py-10 text-center text-muted-foreground" colSpan={10}>
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8" colSpan={10}>
                        <EmptyState
                          variant="no-queue"
                          title="No incoming assets"
                          description="Eligible GRN lines from Procurement will appear here after sync."
                          compact
                        />
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                      const selectedRow = selected?.id === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "border-t transition-colors duration-200 hover:bg-muted/40",
                            selectedRow && "bg-muted/50",
                          )}
                        >
                          <td className={tableSerialCellClassName()}>{tableRowSerial(page, pageSize, index)}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{row.grn_document_number}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(row.document_date)} · {branchLabel(row.branch_id)}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.po_document_number ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">
                              {row.product_name ?? "Product"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.product_code ?? row.product_id.slice(0, 8)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {row.vendor_id ? row.vendor_id.slice(0, 8) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatQty(row.expected_quantity)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatQty(row.arrived_quantity)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatQty(row.pending_quantity)}
                          </td>
                          <td className="px-3 py-2">{arrivalBadge(row.status)}</td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() => void openReceive(row)}
                            >
                              {toNumber(row.pending_quantity) > 0 ? "Receive" : "View"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
              <span>
                {total} line{total === 1 ? "" : "s"} · page {page} of {totalPages}
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
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              {selected ? "Receive / view" : "Select a line"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <EmptyState
                variant="no-queue"
                title="Nothing selected"
                description="Choose Receive on a row to mark physical arrival."
                compact
              />
            ) : detailLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">GRN</div>
                    <div className="font-medium">{selected.grn_document_number}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">PO</div>
                    <div className="font-medium">{selected.po_document_number ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Date</div>
                    <div>{formatDate(selected.document_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Branch</div>
                    <div>{branchLabel(selected.branch_id)}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Product</div>
                    <div className="font-medium">
                      {selected.product_name ?? "Product"}
                      {selected.product_code ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {selected.product_code}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Expected</div>
                    <div className="tabular-nums">{formatQty(selected.expected_quantity)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Already arrived</div>
                    <div className="tabular-nums">{formatQty(selected.arrived_quantity)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Remaining</div>
                    <div className="tabular-nums font-medium">{formatQty(pendingSelected)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div>{arrivalBadge(selected.status)}</div>
                  </div>
                </div>

                {canReceive ? (
                  <div className="space-y-3 border-t border-border/60 pt-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={receiveMode === "quantity" ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setReceiveMode("quantity")}
                      >
                        Quantity
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={receiveMode === "individual" ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setReceiveMode("individual")}
                        disabled={!selected.units?.length}
                      >
                        Receive individually
                      </Button>
                    </div>

                    {receiveMode === "quantity" ? (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="arrive-qty">Quantity</Label>
                          <Input
                            id="arrive-qty"
                            type="number"
                            min={0}
                            step="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => {
                              setSelected(null);
                              setSuccess(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="cursor-pointer"
                            disabled={actionLoading}
                            onClick={() => requestArrive({ markAll: true })}
                          >
                            Mark all arrived
                          </Button>
                          <Button
                            type="button"
                            className="cursor-pointer"
                            disabled={actionLoading}
                            onClick={() => requestArrive({})}
                          >
                            Mark arrived
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-muted/40 text-xs text-muted-foreground">
                            <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="px-2 py-1.5">Unit / Serial</th>
                              <th className="px-2 py-1.5">Status</th>
                              <th className="px-2 py-1.5">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selected.units ?? []).map((unit, index) => (
                              <tr key={unit.id} className="border-t">
                                <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
                                <td className="px-2 py-1.5 font-mono text-xs">
                                  {unit.serial_number || `Unit ${unit.unit_index}`}
                                </td>
                                <td className="px-2 py-1.5">
                                  <Badge variant="outline">{unit.status}</Badge>
                                </td>
                                <td className="px-2 py-1.5">
                                  {unit.status === "PENDING" ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="cursor-pointer"
                                      disabled={actionLoading}
                                      onClick={() =>
                                        requestArrive({ unitIndex: unit.unit_index })
                                      }
                                    >
                                      Arrive
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Fully arrived. QC / Accept will be handled in a later phase. No asset
                    record is created here.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm arrival"
        description={
          confirmPayload?.markAll
            ? `Mark all remaining (${formatQty(pendingSelected)}) as arrived? This only records IT physical receiving — it does not create an asset.`
            : confirmPayload?.unitIndex != null
              ? `Mark unit ${confirmPayload.unitIndex} as arrived?`
              : `Mark quantity ${formatQty(confirmPayload?.quantity ?? 0)} as arrived? This does not create an asset record.`
        }
        confirmLabel="Mark arrived"
        busy={actionLoading}
        onCancel={() => {
          if (!actionLoading) {
            setConfirmOpen(false);
            setConfirmPayload(null);
          }
        }}
        onConfirm={() => void submitArrive()}
      />
    </div>
  );
}
