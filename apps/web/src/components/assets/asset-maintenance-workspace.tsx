"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Play,
  RefreshCw,
  X,
} from "lucide-react";
import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";


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
import { listBranchOptions, listEmployeeOptions, type OrgOption } from "@/lib/org-options";
import { listVendorOptions, type VendorOption } from "@/services/procurement-service";
import {
  maintenanceService,
  type MaintenanceRow,
  type MaintenanceTimelineEvent,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";
import { cn } from "@/lib/utils";

const MAINTENANCE_TYPES = ["preventive", "corrective", "emergency", "annual_service"] as const;
const PAGE_SIZE = 25;
const TABLE_COLS = 9;

function formatMaintenanceType(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function assetMakeModel(row: MaintenanceRow): string {
  return [row.make, row.model].filter(Boolean).join(" · ") || "—";
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 py-2 text-sm last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
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
  const [branchLabels, setBranchLabels] = useState<Record<string, string>>({});
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
  const [timeline, setTimeline] = useState<MaintenanceTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

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

  const employeeMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e.label])),
    [employees],
  );
  const vendorMap = useMemo(() => new Map(vendors.map((v) => [v.id, v.label])), [vendors]);

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

  const loadTimeline = useCallback(async (id: string) => {
    setTimelineLoading(true);
    try {
      setTimeline(await maintenanceService.timeline(id));
    } catch {
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const openDetail = useCallback(
    (row: MaintenanceRow) => {
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
      void loadTimeline(row.id);
    },
    [loadTimeline],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listBranchOptions()
      .then((opts) => {
        setBranchLabels(Object.fromEntries(opts.map((o) => [o.id, o.label])));
      })
      .catch(() => setBranchLabels({}));
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
      await loadTimeline(result.maintenance.id);
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

  async function handleComplete() {
    if (!selected) return;
    setStartSaving(true);
    setError(null);
    try {
      const updated = await maintenanceService.complete(selected.id);
      setSelected(updated);
      await load();
      await loadTimeline(updated.id);
    } catch (err) {
      setError(errMessage(err, "Could not complete maintenance"));
    } finally {
      setStartSaving(false);
    }
  }

  const canStart =
    selected &&
    (selected.status === "draft" ||
      selected.status === "submitted" ||
      selected.status === "approved" ||
      selected.status === "scheduled");

  const canComplete =
    selected &&
    (selected.status === "in_progress" ||
      selected.status === "approved" ||
      selected.status === "scheduled");

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
                          : "No open work orders. Use Maintenance on an asset to create one."}
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

      {detailOpen && selected ? (
        <div className="fixed inset-0 z-50 flex justify-end" data-testid="maintenance-detail-drawer">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-black/40"
            aria-label="Close detail drawer"
            onClick={() => setDetailOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal
            className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-xl"
          >
            <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">Work order detail</h2>
                <p className="font-mono text-xs text-muted-foreground">{selected.document_number}</p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => setDetailOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {pendingApproval ? (
                <div
                  className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
                  role="status"
                  data-testid="maintenance-approval-pending"
                >
                  {pendingApproval}
                </div>
              ) : null}

              <section className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Work order
                </h3>
                <DetailRow label="Document" value={selected.document_number} />
                <DetailRow
                  label="Type"
                  value={formatMaintenanceType(selected.maintenance_type)}
                />
                <DetailRow
                  label="Status"
                  value={
                    <>
                      {selected.status}
                      {selected.workflow_status ? ` / ${selected.workflow_status}` : ""}
                    </>
                  }
                />
                <DetailRow label="Start date" value={selected.scheduled_date ?? "—"} />
                <DetailRow
                  label="Duration"
                  value={
                    selected.expected_duration_days != null
                      ? `${selected.expected_duration_days} days`
                      : "—"
                  }
                />
                <DetailRow label="Expected return" value={selected.expected_return_date ?? "—"} />
                <DetailRow label="Reason" value={selected.reason ?? "—"} />
                <DetailRow
                  label="Cost"
                  value={selected.cost_amount != null ? String(selected.cost_amount) : "—"}
                />
                <DetailRow
                  label="Technician"
                  value={
                    selected.technician_employee_id
                      ? (employeeMap.get(selected.technician_employee_id) ??
                        selected.technician_employee_id.slice(0, 8))
                      : "—"
                  }
                />
                <DetailRow
                  label="Vendor"
                  value={
                    selected.vendor_id
                      ? (vendorMap.get(selected.vendor_id) ?? selected.vendor_id.slice(0, 8))
                      : "—"
                  }
                />
              </section>

              <section className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Asset
                </h3>
                <DetailRow label="Name" value={selected.asset_name ?? selected.asset_id} />
                <DetailRow label="Asset code" value={selected.asset_code ?? "—"} />
                <DetailRow label="Serial" value={selected.serial_number ?? "—"} />
                <DetailRow label="Make / model" value={assetMakeModel(selected)} />
                <DetailRow
                  label="Branch"
                  value={branchLabels[selected.branch_id] ?? selected.branch_id.slice(0, 8)}
                />
                <div className="pt-2">
                  <Link
                    href={`/assets/assets?assetId=${encodeURIComponent(selected.asset_id)}`}
                    className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Open in All Assets
                  </Link>
                </div>
              </section>

              <div className="flex flex-wrap gap-2">
                {canStart ? (
                  <Button
                    type="button"
                    size="sm"
                    className={cn("cursor-pointer", ASSETS_ACCENT_BTN)}
                    onClick={() => {
                      setStartError(null);
                      setStartOpen(true);
                    }}
                  >
                    <Play className="mr-1 size-4" />
                    Start maintenance
                  </Button>
                ) : null}
                {canComplete && selected.status === "in_progress" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={startSaving}
                    onClick={() => void handleComplete()}
                  >
                    Complete maintenance
                  </Button>
                ) : null}
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-medium">Timeline</h3>
                {timelineLoading ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : timeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No timeline events yet.</p>
                ) : (
                  <ul className="space-y-2 border-l border-border/70 pl-3">
                    {timeline.map((ev) => (
                      <li key={ev.id} className="text-xs">
                        <p className="font-medium">{ev.label}</p>
                        <p className="text-muted-foreground">
                          {ev.occurred_at
                            ? new Date(ev.occurred_at).toLocaleString()
                            : "—"}
                        </p>
                        {ev.detail ? (
                          <p className="mt-0.5 text-muted-foreground">{ev.detail}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </aside>
        </div>
      ) : null}

      {startOpen && selected ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-black/50"
            aria-label="Close start maintenance"
            onClick={() => setStartOpen(false)}
          />
          <div
            role="dialog"
            aria-modal
            className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl"
            data-testid="maintenance-start-modal"
          >
            <h2 className="text-base font-semibold">Start maintenance</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Asset: {selected.asset_name ?? selected.asset_code ?? selected.asset_id}
            </p>

            {startError ? (
              <p className="mt-3 text-xs text-destructive" role="alert">
                {startError}
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
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
                className="flex w-full cursor-pointer items-center justify-between rounded-md border border-border/70 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
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

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => setStartOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={cn("cursor-pointer", ASSETS_ACCENT_BTN)}
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

/** Inventory / asset detail: create draft then navigate to maintenance workspace. */
export async function openMaintenanceForAsset(
  assetId: string,
  push: (href: string) => void,
): Promise<void> {
  const row = await maintenanceService.quickDraft(assetId);
  push(`/assets/asset-maintenances?maintenanceId=${encodeURIComponent(row.id)}`);
}
