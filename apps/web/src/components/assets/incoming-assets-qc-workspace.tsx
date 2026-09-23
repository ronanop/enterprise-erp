"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";

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
  incomingAssetQcService,
  type IncomingAssetQcLineRow,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

const QC_STATUS_OPTIONS = [
  { value: "", label: "All QC statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
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

function qcBadge(status: string) {
  const map: Record<string, string> = {
    PENDING: "border-slate-200 bg-slate-50 text-slate-800",
    IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-950",
    ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-900",
    REJECTED: "border-red-200 bg-red-50 text-red-900",
    PENDING_QC: "border-slate-200 bg-slate-50 text-slate-800",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", map[status] ?? "")}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function IncomingAssetsQcWorkspace() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchFilter, setBranchFilter] = useState(BRANCH_ALL_VALUE);
  const [qcStatusFilter, setQcStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [rows, setRows] = useState<IncomingAssetQcLineRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selected, setSelected] = useState<IncomingAssetQcLineRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<"accept" | "reject" | "accept_all" | "reject_all" | null>(
    null,
  );
  const [confirmUnitId, setConfirmUnitId] = useState<string | null>(null);

  const branchLabel = useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.label]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [branches]);

  const summary = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let accepted = 0;
    let rejected = 0;
    for (const row of rows) {
      if (row.qc_status === "PENDING") pending += 1;
      else if (row.qc_status === "IN_PROGRESS") inProgress += 1;
      else if (row.qc_status === "ACCEPTED") accepted += 1;
      else if (row.qc_status === "REJECTED") rejected += 1;
    }
    return { pending, inProgress, accepted, rejected };
  }, [rows]);

  const load = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      setError("Sign in to view Incoming QC.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const branchId = branchFilter === BRANCH_ALL_VALUE ? undefined : branchFilter;
      const list = await incomingAssetQcService.search({
        page,
        page_size: pageSize,
        branch_id: branchId,
        qc_status: qcStatusFilter || undefined,
        q: search.trim() || undefined,
      });
      setRows(list.items);
      setTotal(list.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load QC queue");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [branchFilter, page, pageSize, qcStatusFilter, search]);

  useEffect(() => {
    void listBranchOptions()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(row: IncomingAssetQcLineRow) {
    setSuccess(null);
    setError(null);
    setSelected(row);
    setQuantity(String(toNumber(row.pending_qc_quantity) || ""));
    setRejectionReason("");
    setNotes("");
    setDetailLoading(true);
    try {
      const detail = await incomingAssetQcService.get(row.id);
      setSelected(detail);
      setQuantity(String(toNumber(detail.pending_qc_quantity) || ""));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load QC detail");
    } finally {
      setDetailLoading(false);
    }
  }

  function requestDisposition(
    kind: "accept" | "reject" | "accept_all" | "reject_all",
    unitId?: string,
  ) {
    if (!selected) return;
    const pending = toNumber(selected.pending_qc_quantity);
    if (pending <= 0) {
      setError("No pending QC quantity remaining.");
      return;
    }
    if ((kind === "reject" || kind === "reject_all") && !rejectionReason.trim() && !unitId) {
      setError("Rejection reason is required.");
      return;
    }
    if (kind === "accept" || kind === "reject") {
      if (!unitId) {
        const qty = Number(quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          setError("Enter a quantity greater than zero.");
          return;
        }
        if (qty > pending) {
          setError(`Quantity cannot exceed pending QC (${formatQty(pending)}).`);
          return;
        }
      }
    }
    setConfirmKind(kind);
    setConfirmUnitId(unitId ?? null);
    setConfirmOpen(true);
  }

  async function submitDisposition() {
    if (!selected || !confirmKind) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      let updated: IncomingAssetQcLineRow;
      if (confirmUnitId) {
        const bodyBase = {
          unit_ids: [confirmUnitId],
          notes: notes.trim() || undefined,
        };
        updated =
          confirmKind === "accept" || confirmKind === "accept_all"
            ? await incomingAssetQcService.accept(selected.id, bodyBase)
            : await incomingAssetQcService.reject(selected.id, {
                ...bodyBase,
                rejection_reason: rejectionReason.trim() || "Rejected",
              });
      } else if (confirmKind === "accept_all") {
        updated = await incomingAssetQcService.accept(selected.id, {
          mark_all_pending: true,
          notes: notes.trim() || undefined,
        });
      } else if (confirmKind === "reject_all") {
        updated = await incomingAssetQcService.reject(selected.id, {
          mark_all_pending: true,
          rejection_reason: rejectionReason.trim(),
          notes: notes.trim() || undefined,
        });
      } else if (confirmKind === "accept") {
        updated = await incomingAssetQcService.accept(selected.id, {
          quantity: Number(quantity),
          notes: notes.trim() || undefined,
        });
      } else {
        updated = await incomingAssetQcService.reject(selected.id, {
          quantity: Number(quantity),
          rejection_reason: rejectionReason.trim(),
          notes: notes.trim() || undefined,
        });
      }
      setSelected(updated);
      setQuantity(String(toNumber(updated.pending_qc_quantity) || ""));
      setSuccess(
        confirmKind.startsWith("accept")
          ? "Accepted for registration eligibility. No asset record was created."
          : "Rejected. No asset record was created.",
      );
      setConfirmOpen(false);
      setConfirmKind(null);
      setConfirmUnitId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "QC action failed");
      setConfirmOpen(false);
    } finally {
      setActionLoading(false);
    }
  }

  async function startQc() {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await incomingAssetQcService.start(selected.id);
      setSelected(updated);
      setSuccess("QC started.");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to start QC");
    } finally {
      setActionLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pendingQc = selected ? toNumber(selected.pending_qc_quantity) : 0;
  const canInspect = Boolean(selected && pendingQc > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Incoming Assets — QC"
        description="Inspect arrived units. Accept makes them eligible for Add Asset; Reject does not create an asset."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" className="cursor-pointer" asChild>
              <Link href="/assets/asset-registration">Pending Registration</Link>
            </Button>
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
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Pending QC (page)" value={summary.pending} loading={loading} />
        <StatCard title="In progress (page)" value={summary.inProgress} loading={loading} />
        <StatCard title="Accepted (page)" value={summary.accepted} icon={CheckCircle2} loading={loading} />
        <StatCard title="Rejected (page)" value={summary.rejected} icon={XCircle} loading={loading} />
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardContent className="flex flex-col gap-3 pt-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor="qc-search">Search</Label>
            <div className="flex gap-2">
              <Input
                id="qc-search"
                value={searchInput}
                placeholder="GRN, PO, product…"
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
            <Label>QC status</Label>
            <Select
              value={qcStatusFilter || "all"}
              onValueChange={(v) => {
                setQcStatusFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="QC status" />
              </SelectTrigger>
              <SelectContent>
                {QC_STATUS_OPTIONS.map((opt) => (
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(22rem,1fr)]">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">QC queue (arrived lines)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="px-3 py-2 font-medium">GRN</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium text-right">Arrived</th>
                    <th className="px-3 py-2 font-medium text-right">Pending QC</th>
                    <th className="px-3 py-2 font-medium text-right">Accepted</th>
                    <th className="px-3 py-2 font-medium text-right">Rejected</th>
                    <th className="px-3 py-2 font-medium">QC</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-3 py-10 text-center text-muted-foreground" colSpan={9}>
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8" colSpan={9}>
                        <EmptyState
                          variant="no-queue"
                          title="No arrived lines for QC"
                          description="Mark items Arrived on Incoming Assets first."
                          compact
                        />
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-t transition-colors duration-200 hover:bg-muted/40",
                          selected?.id === row.id && "bg-muted/50",
                        )}
                      >
                        <td className={tableSerialCellClassName()}>{tableRowSerial(page, pageSize, index)}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{row.grn_document_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.po_document_number ?? "—"} · {branchLabel(row.branch_id)}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{row.product_name ?? "Product"}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.product_code ?? "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatQty(row.arrived_quantity)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatQty(row.pending_qc_quantity)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatQty(row.accepted_quantity)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatQty(row.rejected_quantity)}
                        </td>
                        <td className="px-3 py-2">{qcBadge(row.qc_status)}</td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => void openDetail(row)}
                          >
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))
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
              {selected ? "Inspect / disposition" : "Select a line"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <EmptyState
                variant="no-queue"
                title="Nothing selected"
                description="Open Inspect on an arrived line to accept or reject."
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
                    <div className="text-xs text-muted-foreground">QC status</div>
                    <div>{qcBadge(selected.qc_status)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Arrived</div>
                    <div className="tabular-nums">{formatQty(selected.arrived_quantity)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Pending QC</div>
                    <div className="tabular-nums font-medium">{formatQty(pendingQc)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Accepted</div>
                    <div className="tabular-nums">{formatQty(selected.accepted_quantity)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Rejected</div>
                    <div className="tabular-nums">{formatQty(selected.rejected_quantity)}</div>
                  </div>
                </div>

                {canInspect ? (
                  <div className="space-y-3 border-t border-border/60 pt-3">
                    {selected.qc_status === "PENDING" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="cursor-pointer"
                        disabled={actionLoading}
                        onClick={() => void startQc()}
                      >
                        Start QC
                      </Button>
                    ) : null}
                    <div className="space-y-1.5">
                      <Label htmlFor="qc-qty">Quantity</Label>
                      <Input
                        id="qc-qty"
                        type="number"
                        min={0}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="qc-reason">Rejection reason</Label>
                      <Input
                        id="qc-reason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Required when rejecting"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="qc-notes">Notes</Label>
                      <Input
                        id="qc-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="cursor-pointer"
                        disabled={actionLoading}
                        onClick={() => requestDisposition("accept")}
                      >
                        Accept qty
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="cursor-pointer"
                        disabled={actionLoading}
                        onClick={() => requestDisposition("accept_all")}
                      >
                        Accept all pending
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="cursor-pointer"
                        disabled={actionLoading}
                        onClick={() => requestDisposition("reject")}
                      >
                        Reject qty
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer"
                        disabled={actionLoading}
                        onClick={() => requestDisposition("reject_all")}
                      >
                        Reject all pending
                      </Button>
                    </div>

                    {(selected.units ?? []).some((u) => u.status === "ARRIVED") ? (
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-muted/40 text-xs text-muted-foreground">
                            <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="px-2 py-1.5">Unit</th>
                              <th className="px-2 py-1.5">Arrival</th>
                              <th className="px-2 py-1.5">QC</th>
                              <th className="px-2 py-1.5">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selected.units ?? [])
                              .filter((u) => u.status === "ARRIVED")
                              .map((unit, index) => (
                                <tr key={unit.id} className="border-t">
                                  <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
                                  <td className="px-2 py-1.5 font-mono text-xs">
                                    {unit.serial_number || `Unit ${unit.unit_index}`}
                                  </td>
                                  <td className="px-2 py-1.5">{unit.status}</td>
                                  <td className="px-2 py-1.5">
                                    {qcBadge(unit.qc_status || "PENDING_QC")}
                                  </td>
                                  <td className="px-2 py-1.5">
                                    {unit.qc_status === "PENDING_QC" ? (
                                      <div className="flex gap-1">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="cursor-pointer"
                                          disabled={actionLoading}
                                          onClick={() =>
                                            requestDisposition("accept", unit.id)
                                          }
                                        >
                                          Accept
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="destructive"
                                          className="cursor-pointer"
                                          disabled={actionLoading}
                                          onClick={() => {
                                            if (!rejectionReason.trim()) {
                                              setError(
                                                "Enter a rejection reason before rejecting a unit.",
                                              );
                                              return;
                                            }
                                            requestDisposition("reject", unit.id);
                                          }}
                                        >
                                          Reject
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    QC complete for arrived quantity. Accepted units are eligible for Add Asset
                    (later phase). Rejected units will not become assets.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={
          confirmKind?.startsWith("accept") ? "Confirm accept" : "Confirm reject"
        }
        description={
          confirmKind?.startsWith("accept")
            ? "Accepting records QC disposition only. No asset register record will be created."
            : "Rejecting records QC disposition only. No asset register record will be created."
        }
        confirmLabel={confirmKind?.startsWith("accept") ? "Accept" : "Reject"}
        tone={confirmKind?.startsWith("reject") ? "destructive" : "default"}
        busy={actionLoading}
        onCancel={() => {
          if (!actionLoading) {
            setConfirmOpen(false);
            setConfirmKind(null);
            setConfirmUnitId(null);
          }
        }}
        onConfirm={() => void submitDisposition()}
      />
    </div>
  );
}
