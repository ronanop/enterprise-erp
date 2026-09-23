"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

import { ASSETS_ACCENT_BTN } from "@/components/assets/shared/premium-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listEmployeeOptions, type OrgOption } from "@/lib/org-options";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  maintenanceService,
  type MaintenanceStartResult,
} from "@/services/assets-service";
import { listVendorOptions, type VendorOption } from "@/services/procurement-service";

const MAINTENANCE_TYPES = ["preventive", "corrective", "emergency", "annual_service"] as const;

export type MaintenanceStartDialogAsset = {
  id: string;
  assetCode?: string | null;
  assetName?: string | null;
};

type Props = {
  open: boolean;
  asset: MaintenanceStartDialogAsset | null;
  submitting?: boolean;
  onCancel: () => void;
  onStarted: (result: MaintenanceStartResult) => void;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(startIso: string, days: number): string {
  const d = new Date(`${startIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export function ItMaintenanceStartDialog({
  open,
  asset,
  submitting: externalSubmitting,
  onCancel,
  onStarted,
}: Props) {
  const [reason, setReason] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [startDate, setStartDate] = useState(todayIso());
  const [maintenanceType, setMaintenanceType] = useState<string>("preventive");
  const [costAmount, setCostAmount] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<OrgOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [vendorQuery, setVendorQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("");
    setDurationDays("7");
    setStartDate(todayIso());
    setMaintenanceType("preventive");
    setCostAmount("");
    setTechnicianId("");
    setVendorId("");
    setMoreOpen(false);
    setError(null);
    setEmployeeQuery("");
    setVendorQuery("");
    void Promise.all([
      listEmployeeOptions().catch(() => [] as OrgOption[]),
      listVendorOptions().catch(() => [] as VendorOption[]),
    ]).then(([emps, vends]) => {
      setEmployees(emps);
      setVendors(vends);
    });
  }, [open, asset?.id]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const daysNum = Number(durationDays);
  const expectedReturn = useMemo(() => {
    if (!Number.isFinite(daysNum) || daysNum < 1) return "—";
    return addDaysIso(startDate || todayIso(), daysNum);
  }, [daysNum, startDate]);

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

  if (!open || !asset) return null;

  const saving = busy || Boolean(externalSubmitting);
  const assetLabel =
    asset.assetName?.trim() ||
    asset.assetCode?.trim() ||
    asset.id.slice(0, 8);

  async function submit() {
    if (!asset) return;
    const assetId = asset.id;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("Reason is required.");
      return;
    }
    if (!Number.isFinite(daysNum) || daysNum < 1) {
      setError("Duration must be at least 1 day.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await maintenanceService.startFromAsset({
        asset_id: assetId,
        reason: trimmedReason,
        expected_duration_days: daysNum,
        maintenance_type: maintenanceType,
        scheduled_date: startDate || todayIso(),
        vendor_id: vendorId || undefined,
        cost_amount: costAmount ? Number(costAmount) : undefined,
        technician_employee_id: technicianId || undefined,
      });
      onStarted(result);
    } catch (err) {
      setError(errMessage(err, "Could not start maintenance"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-hidden p-3 sm:items-center sm:p-4"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/50"
        aria-label="Close start maintenance"
        disabled={saving}
        onClick={() => {
          if (!saving) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 flex max-h-[min(92dvh,40rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
        data-testid="inventory-maintenance-start-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-border/70 px-5 pb-3 pt-5">
          <h2 className="text-base font-semibold">Start maintenance</h2>
          <p className="mt-1 text-xs text-muted-foreground">Asset: {assetLabel}</p>
          {error ? (
            <p className="mt-3 text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="inv-mnt-reason">Reason *</Label>
            <textarea
              id="inv-mnt-reason"
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-mnt-duration">Duration (days) *</Label>
              <Input
                id="inv-mnt-duration"
                type="number"
                min={1}
                value={durationDays}
                disabled={saving}
                onChange={(e) => setDurationDays(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-mnt-start-date">Start date</Label>
              <Input
                id="inv-mnt-start-date"
                type="date"
                value={startDate}
                disabled={saving}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-mnt-return">Expected return date</Label>
            <Input id="inv-mnt-return" value={expectedReturn} readOnly disabled />
            <p className="text-[11px] text-muted-foreground">
              Calculated from start date + duration.
            </p>
          </div>

          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between rounded-md border border-border/70 px-3 py-2 text-left text-sm transition-colors duration-200 hover:bg-muted/40"
            onClick={() => setMoreOpen((v) => !v)}
            disabled={saving}
          >
            <span>More details (optional)</span>
            {moreOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {moreOpen ? (
            <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={maintenanceType}
                  onValueChange={setMaintenanceType}
                  disabled={saving}
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
                <Label htmlFor="inv-mnt-cost">Cost</Label>
                <Input
                  id="inv-mnt-cost"
                  type="number"
                  step="0.01"
                  value={costAmount}
                  disabled={saving}
                  onChange={(e) => setCostAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Technician</Label>
                <Input
                  placeholder="Search employee…"
                  value={employeeQuery}
                  disabled={saving}
                  onChange={(e) => setEmployeeQuery(e.target.value)}
                  className="mb-1"
                />
                <Select
                  value={technicianId || "__none"}
                  disabled={saving}
                  onValueChange={(v) => setTechnicianId(v === "__none" ? "" : v)}
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
                  disabled={saving}
                  onChange={(e) => setVendorQuery(e.target.value)}
                  className="mb-1"
                />
                <Select
                  value={vendorId || "__none"}
                  disabled={saving}
                  onValueChange={(v) => setVendorId(v === "__none" ? "" : v)}
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
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={cn("cursor-pointer transition-colors duration-200", ASSETS_ACCENT_BTN)}
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Start maintenance
          </Button>
        </div>
      </div>
    </div>
  );
}
