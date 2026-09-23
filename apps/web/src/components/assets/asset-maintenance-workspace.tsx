"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";


import { MaintenanceWorkOrderDetailDrawer } from "@/components/assets/maintenance-work-order-detail-drawer";
import {
  ASSETS_ACCENT_BTN,
  ASSETS_SURFACE_CARD,
  AssetsPremiumPage,
} from "@/components/assets/shared/premium-surface";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { listEmployeeOptions, type OrgOption } from "@/lib/org-options";
import { listVendorOptions, type VendorOption } from "@/services/procurement-service";
import {
  maintenanceService,
  type MaintenanceRow,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";
import { cn } from "@/lib/utils";

const MAINTENANCE_TYPES = ["preventive", "corrective", "emergency", "annual_service"] as const;
const PAGE_SIZE = 25;
const TABLE_COLS = 9;

function formatMaintenanceType(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "in_progress") return "default";
  if (status === "completed" || status === "cancelled") return "outline";
  return "secondary";
}

export function AssetMaintenanceWorkspace() {
  const searchParams = useSearchParams();
  const deepMaintenanceId = searchParams.get("maintenanceId") ?? "";

  const [rows, setRows] = useState<MaintenanceRow[]>([]);
  const [employees, setEmployees] = useState<OrgOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<MaintenanceRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [startOpen, setStartOpen] = useState(false);
  const [startSaving, setStartSaving] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [form, setForm] = useState({
    reason: "",
    expected_duration_days: "7",
    maintenance_type: "preventive",
    scheduled_date: todayIso(),
    cost_amount: "",
    technician_employee_id: "",
    vendor_id: "",
  });
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [vendorQuery, setVendorQuery] = useState("");

  const filteredEmployees = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.label.toLowerCase().includes(q));
  }, [employeeQuery, employees]);

  const filteredVendors = useMemo(() => {
    const q = vendorQuery.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) => v.label.toLowerCase().includes(q));
  }, [vendorQuery, vendors]);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await maintenanceService.search({
        page,
        page_size: PAGE_SIZE,
        q: q.trim() || undefined,
        open_only: !showHistory,
      });
      setRows(payload.items);
      setTotal(payload.total);
    } catch (err) {
      setError(errMessage(err, "Failed to load maintenance work orders"));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, q, showHistory]);

  const openDetail = useCallback((row: MaintenanceRow) => {
    setSelected(row);
    setDetailOpen(true);
    setPendingApproval(
      row.status === "submitted" ? "Awaiting approval before maintenance can start." : null,
    );
    setForm((f) => ({
      ...f,
      reason: row.reason ?? "",
      expected_duration_days: row.expected_duration_days
        ? String(row.expected_duration_days)
        : f.expected_duration_days,
      maintenance_type: row.maintenance_type || "preventive",
      scheduled_date: row.scheduled_date ?? todayIso(),
      cost_amount: row.cost_amount != null ? String(row.cost_amount) : "",
      technician_employee_id: row.technician_employee_id ?? "",
      vendor_id: row.vendor_id ?? "",
    }));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listEmployeeOptions().then(setEmployees).catch(() => setEmployees([]));
    void listVendorOptions().then(setVendors).catch(() => setVendors([]));
  }, []);

  useEffect(() => {
    if (!deepMaintenanceId || loading) return;
    const match = rows.find((r) => r.id === deepMaintenanceId);
    if (match) {
      openDetail(match);
      return;
    }
    void maintenanceService
      .get(deepMaintenanceId)
      .then((row) => openDetail(row))
      .catch(() => {
        /* ignore invalid deep link */
      });
  }, [deepMaintenanceId, loading, openDetail, rows]);

  useEffect(() => {
    if (!startOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [startOpen]);

  async function handleStartMaintenance() {
    if (!selected) return;
    const reason = form.reason.trim();
    const days = Number(form.expected_duration_days);
    if (!reason) {
      setStartError("Reason is required.");
      return;
    }
    if (!Number.isFinite(days) || days < 1) {
      setStartError("Duration must be at least 1 day.");
      return;
    }
    setStartSaving(true);
    setStartError(null);
    setPendingApproval(null);
    try {
      const result = await maintenanceService.startMaintenance(selected.id, {
        reason,
        expected_duration_days: days,
        maintenance_type: form.maintenance_type,
        scheduled_date: form.scheduled_date || todayIso(),
        vendor_id: form.vendor_id || undefined,
        cost_amount: form.cost_amount ? Number(form.cost_amount) : undefined,
        technician_employee_id: form.technician_employee_id || undefined,
        version: selected.version,
      });
      if (result.status === "approval_pending") {
        setPendingApproval(
          result.message ??
            "Submitted for approval. Another user must approve before maintenance can start.",
        );
        setSelected(result.maintenance);
        setStartOpen(false);
      } else {
        setSelected(result.maintenance);
        setStartOpen(false);
        setDetailOpen(true);
      }
      await load();
    } catch (err) {
      const msg = errMessage(err, "Could not start maintenance");
      if (msg.toLowerCase().includes("approval")) {
        setPendingApproval(msg);
      }
      setStartError(msg);
    } finally {
      setStartSaving(false);
    }
  }

  return (
    <AssetsPremiumPage testId="asset-maintenance-workspace">
      <div className="space-y-5">
        <PageHeader
          title="Asset maintenance"
          description="Open work orders and start maintenance with reason and expected duration."
        />

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Card className={cn(ASSETS_SURFACE_CARD)}>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                aria-label="Search maintenance"
                placeholder="Search document or asset…"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                className="max-w-xs"
              />
              <Button
                type="button"
                variant={showHistory ? "default" : "outline"}
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => {
                  setPage(1);
                  setShowHistory((v) => !v);
                }}
              >
                {showHistory ? "Showing all" : "Show history"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => void load()}
              >
                <RefreshCw className="mr-2 size-4" />
                Refresh
              </Button>
              <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Page {page} · {total} total
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  className="cursor-pointer"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page * PAGE_SIZE >= total}
                  className="cursor-pointer"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="px-3 py-2 font-medium">Asset code</th>
                    <th className="px-3 py-2 font-medium">Asset name</th>
                    <th className="px-3 py-2 font-medium">Serial</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                    <th className="px-3 py-2 font-medium">Duration</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Expected return</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={TABLE_COLS} className="px-3 py-10 text-center text-muted-foreground">
                        <Loader2 className="mx-auto size-5 animate-spin" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={TABLE_COLS} className="px-3 py-10 text-center text-muted-foreground">
                        {showHistory
                          ? "No work orders found."
                          : "No open work orders. Use Maintenance on an asset in All Assets to start one."}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                        <tr key={row.id} className="border-t border-border/60">
                          <td className={tableSerialCellClassName()}>{tableRowSerial(page, PAGE_SIZE, index)}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.asset_code ?? "—"}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {row.asset_name ?? row.asset_id.slice(0, 8)}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {row.serial_number ?? "—"}
                          </td>
                          <td className="max-w-[12rem] truncate px-3 py-2 text-muted-foreground">
                            {row.reason ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {row.expected_duration_days != null
                              ? `${row.expected_duration_days}d`
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={statusVariant(row.status)} className="font-mono text-xs">
                              {row.status}
                              {row.workflow_status ? ` / ${row.workflow_status}` : ""}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {row.expected_return_date ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="cursor-pointer"
                              onClick={() => openDetail(row)}
                            >
                              <Eye className="mr-1 size-4" />
                              View detail
                            </Button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <MaintenanceWorkOrderDetailDrawer
        open={detailOpen && selected != null}
        workOrder={selected}
        onClose={() => setDetailOpen(false)}
        onUpdated={(row) => {
          setSelected(row);
          void load();
        }}
        allowStart
        onRequestStart={() => {
          setStartError(null);
          setStartOpen(true);
        }}
        pendingApprovalMessage={pendingApproval}
      />

      {startOpen && selected ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center overflow-hidden p-3 sm:items-center sm:p-4"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-black/50"
            aria-label="Close start maintenance"
            onClick={() => setStartOpen(false)}
          />
          <div
            role="dialog"
            aria-modal
            className="relative z-10 flex max-h-[min(92dvh,40rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
            data-testid="maintenance-start-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-border/70 px-5 pb-3 pt-5">
              <h2 className="text-base font-semibold">Start maintenance</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Asset: {selected.asset_name ?? selected.asset_code ?? selected.asset_id}
              </p>
              {startError ? (
                <p className="mt-3 text-xs text-destructive" role="alert">
                  {startError}
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="mnt-reason">Reason *</Label>
                <textarea
                  id="mnt-reason"
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.reason}
                  onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mnt-duration">Duration (days) *</Label>
                  <Input
                    id="mnt-duration"
                    type="number"
                    min={1}
                    value={form.expected_duration_days}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, expected_duration_days: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mnt-start-date">Start date</Label>
                  <Input
                    id="mnt-start-date"
                    type="date"
                    value={form.scheduled_date}
                    onChange={(e) => setForm((s) => ({ ...s, scheduled_date: e.target.value }))}
                  />
                </div>
              </div>

              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between rounded-md border border-border/70 px-3 py-2 text-left text-sm transition-colors duration-200 hover:bg-muted/40"
                onClick={() => setMoreOpen((v) => !v)}
              >
                <span>More details (optional)</span>
                {moreOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>

              {moreOpen ? (
                <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select
                      value={form.maintenance_type}
                      onValueChange={(v) => setForm((s) => ({ ...s, maintenance_type: v }))}
                    >
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MAINTENANCE_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="cursor-pointer">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mnt-cost">Cost</Label>
                    <Input
                      id="mnt-cost"
                      type="number"
                      step="0.01"
                      value={form.cost_amount}
                      onChange={(e) => setForm((s) => ({ ...s, cost_amount: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Technician</Label>
                    <Input
                      placeholder="Search employee…"
                      value={employeeQuery}
                      onChange={(e) => setEmployeeQuery(e.target.value)}
                      className="mb-1"
                    />
                    <Select
                      value={form.technician_employee_id || "__none"}
                      onValueChange={(v) =>
                        setForm((s) => ({
                          ...s,
                          technician_employee_id: v === "__none" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="Select technician" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none" className="cursor-pointer">
                          None
                        </SelectItem>
                        {filteredEmployees.map((e) => (
                          <SelectItem key={e.id} value={e.id} className="cursor-pointer">
                            {e.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vendor</Label>
                    <Input
                      placeholder="Search vendor…"
                      value={vendorQuery}
                      onChange={(e) => setVendorQuery(e.target.value)}
                      className="mb-1"
                    />
                    <Select
                      value={form.vendor_id || "__none"}
                      onValueChange={(v) =>
                        setForm((s) => ({ ...s, vendor_id: v === "__none" ? "" : v }))
                      }
                    >
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none" className="cursor-pointer">
                          None
                        </SelectItem>
                        {filteredVendors.map((v) => (
                          <SelectItem key={v.id} value={v.id} className="cursor-pointer">
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-border/70 bg-background px-5 py-4">
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => setStartOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={cn("cursor-pointer transition-colors duration-200", ASSETS_ACCENT_BTN)}
                disabled={startSaving}
                onClick={() => void handleStartMaintenance()}
              >
                {startSaving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                Start maintenance
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AssetsPremiumPage>
  );
}

/** @deprecated Prefer ItMaintenanceStartDialog + startFromAsset (Option B). */
export async function openMaintenanceForAsset(
  assetId: string,
  push: (href: string) => void,
): Promise<void> {
  const row = await maintenanceService.quickDraft(assetId);
  push(`/assets/asset-maintenances?maintenanceId=${encodeURIComponent(row.id)}`);
}
