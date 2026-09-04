"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  Loader2,
  PackagePlus,
  RefreshCw,
  Upload,
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
  assetRegistrationQueueService,
  type RegistrationExcelRow,
  type RegistrationExcelRowResult,
  type RegistrationQueueItem,
  type RegistrationQueueSummary,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

const REG_STATUS_OPTIONS = [
  { value: "", label: "All registration statuses" },
  { value: "PENDING_REGISTRATION", label: "Pending registration" },
  { value: "REGISTERED", label: "Registered" },
  { value: "PARTIALLY_REGISTERED", label: "Partially registered (line)" },
] as const;

function regBadge(status: string) {
  const map: Record<string, string> = {
    PENDING_REGISTRATION: "border-amber-200 bg-amber-50 text-amber-950",
    PARTIALLY_REGISTERED: "border-sky-200 bg-sky-50 text-sky-950",
    REGISTERED: "border-emerald-200 bg-emerald-50 text-emerald-900",
    ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", map[status] ?? "")}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function parseCsv(text: string): RegistrationExcelRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    return {
      incoming_unit_id: row.incoming_unit_id || null,
      asset_name: row.asset_name || null,
      serial_number: row.serial_number || null,
      branch_id: row.branch_id || null,
      asset_category_id: row.asset_category_id || null,
      asset_type: row.asset_type || null,
      purchase_date: row.purchase_date || null,
      purchase_cost: row.purchase_cost || null,
      currency_code: row.currency_code || null,
      make: row.make || null,
      model: row.model || null,
      configuration: row.configuration || null,
      location: row.location || null,
    };
  });
}

export function AssetRegistrationQueueWorkspace() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchFilter, setBranchFilter] = useState(BRANCH_ALL_VALUE);
  const [regStatus, setRegStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [rows, setRows] = useState<RegistrationQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<RegistrationQueueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [bulkMode, setBulkMode] = useState(false);
  const [reviewRows, setReviewRows] = useState<RegistrationExcelRowResult[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const branchLabel = useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.label]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [branches]);

  const load = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      setError("Sign in to view Pending Registration.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const branchId = branchFilter === BRANCH_ALL_VALUE ? undefined : branchFilter;
      const [list, sum] = await Promise.all([
        assetRegistrationQueueService.search({
          page,
          page_size: pageSize,
          branch_id: branchId,
          registration_status: regStatus || undefined,
          q: search.trim() || undefined,
        }),
        assetRegistrationQueueService.summary({ branch_id: branchId }),
      ]);
      setRows(list.items);
      setTotal(list.total);
      setSummary(sum);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load registration queue");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [branchFilter, page, pageSize, regStatus, search]);

  useEffect(() => {
    void listBranchOptions()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDownloadTemplate() {
    setError(null);
    try {
      const branchId = branchFilter === BRANCH_ALL_VALUE ? undefined : branchFilter;
      const blob = await assetRegistrationQueueService.downloadTemplate({ branch_id: branchId });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pending-registration-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Template download failed");
    }
  }

  async function onUploadFile(file: File) {
    setError(null);
    setSuccess(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setError("No rows found in file.");
        return;
      }
      setActionLoading(true);
      const result = await assetRegistrationQueueService.validateExcel(parsed);
      setReviewRows(result.rows);
      setBulkMode(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Validation failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function revalidateReview() {
    setActionLoading(true);
    setError(null);
    try {
      const payload: RegistrationExcelRow[] = reviewRows.map((r) => ({
        incoming_unit_id: r.incoming_unit_id,
        asset_name: r.asset_name,
        serial_number: r.serial_number,
        branch_id: r.branch_id,
        asset_category_id: r.asset_category_id,
        asset_type: r.asset_type,
        purchase_date: r.purchase_date,
        purchase_cost: r.purchase_cost,
        currency_code: r.currency_code,
        make: r.make,
        model: r.model,
        configuration: r.configuration,
        location: r.location,
      }));
      const result = await assetRegistrationQueueService.validateExcel(payload);
      setReviewRows(result.rows);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Re-validation failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmRegister() {
    setActionLoading(true);
    setError(null);
    try {
      const valid = reviewRows.filter((r) => r.status === "valid");
      const payload: RegistrationExcelRow[] = valid.map((r) => ({
        incoming_unit_id: r.incoming_unit_id,
        asset_name: r.asset_name,
        serial_number: r.serial_number,
        branch_id: r.branch_id,
        asset_category_id: r.asset_category_id,
        asset_type: r.asset_type,
        purchase_date: r.purchase_date,
        purchase_cost: r.purchase_cost,
        currency_code: r.currency_code,
        make: r.make,
        model: r.model,
        configuration: r.configuration,
        location: r.location,
      }));
      const result = await assetRegistrationQueueService.confirmExcel(payload, true);
      setConfirmOpen(false);
      setBulkMode(false);
      setReviewRows([]);
      const incomplete = result.activation_incomplete;
      setSuccess(
        incomplete > 0
          ? `${result.registered_count} assets created; ${incomplete} activation incomplete.`
          : `${result.registered_count} assets registered successfully.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Confirm failed");
      setConfirmOpen(false);
    } finally {
      setActionLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const validCount = reviewRows.filter((r) => r.status === "valid").length;
  const errorCount = reviewRows.filter((r) => r.status === "error").length;
  const pending = summary?.pending_registration ?? 0;

  if (bulkMode) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Bulk Asset Registration"
          description={`${pending} pending · ${reviewRows.length} Excel rows uploaded`}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => {
                setBulkMode(false);
                setReviewRows([]);
              }}
            >
              Back to queue
            </Button>
          }
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard title="Valid" value={validCount} />
          <StatCard title="Errors" value={errorCount} />
          <StatCard title="Pending registration" value={pending} />
        </div>
        {error ? (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base font-medium">Review</CardTitle>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUploadFile(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" className="cursor-pointer" asChild>
                  <span>
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Re-upload Excel
                  </span>
                </Button>
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="cursor-pointer"
                disabled={actionLoading}
                onClick={() => void revalidateReview()}
              >
                Re-validate
              </Button>
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                disabled={actionLoading || validCount === 0}
                onClick={() => setConfirmOpen(true)}
              >
                Register {validCount} Valid Assets
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {reviewRows.length === 0 ? (
              <EmptyState
                variant="no-results"
                title="No valid assets can be registered from this file."
                compact
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[64rem] text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Unit</th>
                      <th className="px-3 py-2">Asset</th>
                      <th className="px-3 py-2">Serial</th>
                      <th className="px-3 py-2">Make</th>
                      <th className="px-3 py-2">Model</th>
                      <th className="px-3 py-2">Configuration</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">GRN</th>
                      <th className="px-3 py-2">Validation</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewRows.map((row, index) => (
                      <tr key={`${row.row_number}-${idx}`} className="border-t">
                        <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
                        <td className="px-3 py-2">
                          {row.status === "valid" ? "✓" : "✕"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.incoming_unit_id?.slice(0, 8)}…
                        </td>
                        <td className="px-3 py-2">
                          {editingIndex === idx ? (
                            <Input
                              value={row.asset_name ?? ""}
                              onChange={(e) => {
                                const next = [...reviewRows];
                                next[idx] = { ...next[idx], asset_name: e.target.value };
                                setReviewRows(next);
                              }}
                            />
                          ) : (
                            row.asset_name
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editingIndex === idx ? (
                            <Input
                              value={row.serial_number ?? ""}
                              onChange={(e) => {
                                const next = [...reviewRows];
                                next[idx] = { ...next[idx], serial_number: e.target.value };
                                setReviewRows(next);
                              }}
                            />
                          ) : (
                            row.serial_number || "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editingIndex === idx ? (
                            <Input
                              value={row.make ?? ""}
                              onChange={(e) => {
                                const next = [...reviewRows];
                                next[idx] = { ...next[idx], make: e.target.value };
                                setReviewRows(next);
                              }}
                            />
                          ) : (
                            row.make || "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editingIndex === idx ? (
                            <Input
                              value={row.model ?? ""}
                              onChange={(e) => {
                                const next = [...reviewRows];
                                next[idx] = { ...next[idx], model: e.target.value };
                                setReviewRows(next);
                              }}
                            />
                          ) : (
                            row.model || "—"
                          )}
                        </td>
                        <td
                          className="max-w-[140px] truncate px-3 py-2"
                          title={row.configuration ?? undefined}
                        >
                          {editingIndex === idx ? (
                            <Input
                              value={row.configuration ?? ""}
                              onChange={(e) => {
                                const next = [...reviewRows];
                                next[idx] = { ...next[idx], configuration: e.target.value };
                                setReviewRows(next);
                              }}
                            />
                          ) : (
                            row.configuration || "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editingIndex === idx ? (
                            <Input
                              value={row.location ?? ""}
                              onChange={(e) => {
                                const next = [...reviewRows];
                                next[idx] = { ...next[idx], location: e.target.value };
                                setReviewRows(next);
                              }}
                            />
                          ) : (
                            row.location || "—"
                          )}
                        </td>
                        <td className="px-3 py-2">{row.grn_document_number || "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {row.errors?.length ? row.errors.join("; ") : "Valid"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() => {
                                if (editingIndex === idx) {
                                  setEditingIndex(null);
                                  void revalidateReview();
                                } else {
                                  setEditingIndex(idx);
                                }
                              }}
                            >
                              {editingIndex === idx ? "Done" : "Edit"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="cursor-pointer"
                              onClick={() =>
                                setReviewRows((prev) => prev.filter((_, i) => i !== idx))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <ConfirmDialog
          open={confirmOpen}
          title={`Register ${validCount} assets?`}
          description={`${validCount} valid assets · ${errorCount} errors excluded. System will create drafts, then submit/approve. Activation failures are reported per asset.`}
          confirmLabel={`Confirm & Register ${validCount} Assets`}
          busy={actionLoading}
          onCancel={() => !actionLoading && setConfirmOpen(false)}
          onConfirm={() => void confirmRegister()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pending Registration"
        description="QC-accepted incoming units eligible for Add Asset. Rejected items never appear here."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => void onDownloadTemplate()}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download Template
            </Button>
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                aria-label="Upload Excel"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUploadFile(f);
                  e.target.value = "";
                }}
              />
              <span className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground transition-colors hover:bg-primary/80">
                <Upload className="h-3.5 w-3.5" />
                Upload Excel
              </span>
            </label>
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

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard title="Accepted" value={summary?.accepted ?? 0} loading={loading} />
        <StatCard title="Registered" value={summary?.registered ?? 0} loading={loading} />
        <StatCard
          title="Pending Registration"
          value={summary?.pending_registration ?? 0}
          icon={PackagePlus}
          loading={loading}
        />
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardContent className="flex flex-col gap-3 pt-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor="reg-search">Search</Label>
            <div className="flex gap-2">
              <Input
                id="reg-search"
                value={searchInput}
                placeholder="GRN, PO, product, serial…"
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
          <div className="w-full space-y-1.5 sm:w-56">
            <Label>Registration status</Label>
            <Select
              value={regStatus || "all"}
              onValueChange={(v) => {
                setRegStatus(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {REG_STATUS_OPTIONS.map((opt) => (
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

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Accepted assets</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Asset</th>
                  <th className="px-3 py-2 font-medium">Serial</th>
                  <th className="px-3 py-2 font-medium">GRN</th>
                  <th className="px-3 py-2 font-medium">PO</th>
                  <th className="px-3 py-2 font-medium">Branch</th>
                  <th className="px-3 py-2 font-medium">QC</th>
                  <th className="px-3 py-2 font-medium">Registration</th>
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
                        title={
                          summary && summary.accepted > 0 && summary.pending_registration === 0
                            ? "All accepted assets have been registered."
                            : "All caught up. No assets are pending registration."
                        }
                        description="QC-accepted units that are not yet registered appear here."
                        compact
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.incoming_unit_id}
                      className="border-t transition-colors duration-200 hover:bg-muted/40"
                    >
                      <td className={tableSerialCellClassName()}>{tableRowSerial(page, pageSize, index)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.unit_reference}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.product_name ?? "Product"}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.product_code ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.serial_number || "—"}
                      </td>
                      <td className="px-3 py-2">{row.grn_document_number}</td>
                      <td className="px-3 py-2">{row.po_document_number ?? "—"}</td>
                      <td className="px-3 py-2">{branchLabel(row.branch_id)}</td>
                      <td className="px-3 py-2">{regBadge(row.qc_status)}</td>
                      <td className="px-3 py-2">{regBadge(row.registration_status)}</td>
                      <td className="px-3 py-2">
                        {row.registered_asset_id ? (
                          <Button type="button" size="sm" variant="outline" className="cursor-pointer" asChild>
                            <Link href={`/assets/assets/${row.registered_asset_id}`}>
                              View Asset
                            </Link>
                          </Button>
                        ) : (
                          <Button type="button" size="sm" className="cursor-pointer" asChild>
                            <Link
                              href={`/assets/assets/new?incomingUnitId=${row.incoming_unit_id}&incomingLineId=${row.incoming_line_id}`}
                            >
                              Add Asset
                            </Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span>
              {total} unit{total === 1 ? "" : "s"} · page {page} of {totalPages}
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
    </div>
  );
}
