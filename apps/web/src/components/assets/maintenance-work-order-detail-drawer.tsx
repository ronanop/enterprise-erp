"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Play, X } from "lucide-react";

import { ASSETS_ACCENT_BTN } from "@/components/assets/shared/premium-surface";
import { Button } from "@/components/ui/button";
import { listBranchOptions, listEmployeeOptions, type OrgOption } from "@/lib/org-options";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  maintenanceService,
  type MaintenanceRow,
  type MaintenanceTimelineEvent,
} from "@/services/assets-service";
import { listVendorOptions, type VendorOption } from "@/services/procurement-service";

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

export type MaintenanceWorkOrderDetailDrawerProps = {
  open: boolean;
  /** Prefer passing a known row; otherwise set maintenanceId to load. */
  workOrder?: MaintenanceRow | null;
  maintenanceId?: string | null;
  onClose: () => void;
  /** Called after complete (or reload) so parent lists can refresh. */
  onUpdated?: (row: MaintenanceRow) => void;
  /** When true, show Start for draft/submitted/approved/scheduled. */
  allowStart?: boolean;
  onRequestStart?: (row: MaintenanceRow) => void;
  pendingApprovalMessage?: string | null;
};

export function MaintenanceWorkOrderDetailDrawer({
  open,
  workOrder,
  maintenanceId,
  onClose,
  onUpdated,
  allowStart = false,
  onRequestStart,
  pendingApprovalMessage,
}: MaintenanceWorkOrderDetailDrawerProps) {
  const [row, setRow] = useState<MaintenanceRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<MaintenanceTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [branchLabels, setBranchLabels] = useState<Record<string, string>>({});
  const [employees, setEmployees] = useState<OrgOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);

  const resolvedId = workOrder?.id ?? maintenanceId ?? null;

  const employeeMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e.label])),
    [employees],
  );
  const vendorMap = useMemo(() => new Map(vendors.map((v) => [v.id, v.label])), [vendors]);

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

  const loadRow = useCallback(async () => {
    if (!open || !resolvedId) {
      setRow(null);
      return;
    }
    if (workOrder && workOrder.id === resolvedId) {
      setRow(workOrder);
      void loadTimeline(resolvedId);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fetched = await maintenanceService.get(resolvedId);
      setRow(fetched);
      void loadTimeline(fetched.id);
    } catch (err) {
      setError(errMessage(err, "Unable to load work order"));
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [loadTimeline, open, resolvedId, workOrder]);

  useEffect(() => {
    void loadRow();
  }, [loadRow]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void listBranchOptions()
      .then((opts) => {
        setBranchLabels(Object.fromEntries(opts.map((o) => [o.id, o.label])));
      })
      .catch(() => setBranchLabels({}));
    void listEmployeeOptions().then(setEmployees).catch(() => setEmployees([]));
    void listVendorOptions().then(setVendors).catch(() => setVendors([]));
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const canStart =
    allowStart &&
    row &&
    (row.status === "draft" ||
      row.status === "submitted" ||
      row.status === "approved" ||
      row.status === "scheduled");

  const canComplete = row && row.status === "in_progress";

  async function handleComplete() {
    if (!row) return;
    setCompleting(true);
    setError(null);
    try {
      const updated = await maintenanceService.complete(row.id);
      setRow(updated);
      onUpdated?.(updated);
      await loadTimeline(updated.id);
    } catch (err) {
      setError(errMessage(err, "Could not complete maintenance"));
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="maintenance-detail-drawer">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/40"
        aria-label="Close detail drawer"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal
        className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Work order detail</h2>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row?.document_number ?? (loading ? "Loading…" : "—")}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-9 shrink-0 cursor-pointer transition-colors duration-200"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {loading && !row ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading work order…
            </div>
          ) : null}

          {row ? (
            <>
              {pendingApprovalMessage ? (
                <div
                  className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
                  role="status"
                  data-testid="maintenance-approval-pending"
                >
                  {pendingApprovalMessage}
                </div>
              ) : null}

              <section className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Work order
                </h3>
                <DetailRow label="Document" value={row.document_number} />
                <DetailRow label="Type" value={formatMaintenanceType(row.maintenance_type)} />
                <DetailRow
                  label="Status"
                  value={
                    <>
                      {row.status}
                      {row.workflow_status ? ` / ${row.workflow_status}` : ""}
                    </>
                  }
                />
                <DetailRow label="Start date" value={row.scheduled_date ?? "—"} />
                <DetailRow
                  label="Duration"
                  value={
                    row.expected_duration_days != null
                      ? `${row.expected_duration_days} days`
                      : "—"
                  }
                />
                <DetailRow label="Expected return" value={row.expected_return_date ?? "—"} />
                <DetailRow label="Reason" value={row.reason ?? "—"} />
                <DetailRow
                  label="Cost"
                  value={row.cost_amount != null ? String(row.cost_amount) : "—"}
                />
                <DetailRow
                  label="Technician"
                  value={
                    row.technician_employee_id
                      ? (employeeMap.get(row.technician_employee_id) ??
                        row.technician_employee_id.slice(0, 8))
                      : "—"
                  }
                />
                <DetailRow
                  label="Vendor"
                  value={
                    row.vendor_id
                      ? (vendorMap.get(row.vendor_id) ?? row.vendor_id.slice(0, 8))
                      : "—"
                  }
                />
              </section>

              <section className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Asset
                </h3>
                <DetailRow label="Name" value={row.asset_name ?? row.asset_id} />
                <DetailRow label="Asset code" value={row.asset_code ?? "—"} />
                <DetailRow label="Serial" value={row.serial_number ?? "—"} />
                <DetailRow label="Make / model" value={assetMakeModel(row)} />
                <DetailRow
                  label="Branch"
                  value={branchLabels[row.branch_id] ?? row.branch_id.slice(0, 8)}
                />
                <div className="pt-2">
                  <Link
                    href={`/assets/assets?assetId=${encodeURIComponent(row.asset_id)}`}
                    className="cursor-pointer text-xs font-medium text-primary underline-offset-2 transition-colors duration-200 hover:underline"
                  >
                    Open in All Assets
                  </Link>
                </div>
              </section>

              <div className="flex flex-wrap gap-2">
                {canStart && onRequestStart ? (
                  <Button
                    type="button"
                    size="sm"
                    className={cn("cursor-pointer transition-colors duration-200", ASSETS_ACCENT_BTN)}
                    onClick={() => onRequestStart(row)}
                  >
                    <Play className="mr-1 size-4" />
                    Start maintenance
                  </Button>
                ) : null}
                {canComplete ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="cursor-pointer transition-colors duration-200"
                    disabled={completing}
                    onClick={() => void handleComplete()}
                  >
                    {completing ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                    Complete maintenance
                  </Button>
                ) : null}
              </div>

              <section className="space-y-2" data-testid="maintenance-timeline">
                <div>
                  <h3 className="text-sm font-medium">Timeline</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Work-order activity: create, submit, approve, start, complete, plus any service
                    history notes recorded for this order.
                  </p>
                </div>
                {timelineLoading ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : timeline.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border/70 bg-muted/15 px-3 py-3 text-xs text-muted-foreground">
                    No timeline events yet. Events appear after audit logging for this work order
                    (created, started, completed) or when service history is recorded.
                  </p>
                ) : (
                  <ul className="space-y-2 border-l border-border/70 pl-3">
                    {timeline.map((ev) => (
                      <li key={ev.id} className="text-xs">
                        <p className="font-medium">{ev.label}</p>
                        <p className="text-muted-foreground">
                          {ev.occurred_at ? new Date(ev.occurred_at).toLocaleString() : "—"}
                        </p>
                        {ev.detail ? (
                          <p className="mt-0.5 text-muted-foreground">{ev.detail}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
