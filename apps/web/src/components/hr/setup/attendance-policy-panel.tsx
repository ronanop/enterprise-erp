"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Fingerprint,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from "lucide-react";

import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { HrStatusBadge } from "@/components/hr/hr-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { nextCode, type HrSetupTab } from "@/config/hr-setup";
import { ApiClientError, resourceService } from "@/services/api-client";
import { listSetupApi, type SetupRow } from "@/services/hr-setup-service";
import { cn } from "@/lib/utils";

const API = "/hr/attendance-rules";
const SHIFTS_API = "/hr/shifts";

type PunchMode = "first_in_last_out" | "every_punch";
type AfterStatus = "half_day" | "absent" | "late";

type ShiftOption = { id: string; code: string; name: string; start: string; end: string };

type ShiftWindowRow = {
  shift_id: string;
  shift_code: string;
  window_start: string;
  ok_until: string;
  after_status: AfterStatus;
};

type Mode = "create" | "edit" | null;

function hhmm(value: unknown): string {
  if (!value) return "";
  const s = String(value);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function emptyWindow(shift?: ShiftOption): ShiftWindowRow {
  const start = hhmm(shift?.start) || "10:00";
  return {
    shift_id: shift?.id ?? "",
    shift_code: shift?.code ?? "",
    window_start: start,
    ok_until: "11:00",
    after_status: "half_day",
  };
}

export function AttendancePolicyPanel({ tab }: { tab: HrSetupTab }) {
  const [rows, setRows] = useState<SetupRow[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [active, setActive] = useState<SetupRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SetupRow | null>(null);

  const [ruleName, setRuleName] = useState("");
  const [ruleCode, setRuleCode] = useState("");
  const [status, setStatus] = useState("active");
  const [graceMinutes, setGraceMinutes] = useState("15");
  const [lateMarkAfter, setLateMarkAfter] = useState("15");
  const [halfDayHours, setHalfDayHours] = useState("4");
  const [fullDayHours, setFullDayHours] = useState("8");
  const [earlyLeaveHalf, setEarlyLeaveHalf] = useState("120");
  const [missPunchWindow, setMissPunchWindow] = useState("48");
  const [overtimeAllowed, setOvertimeAllowed] = useState(true);
  const [geofenceRequired, setGeofenceRequired] = useState(false);

  const [punchMode, setPunchMode] = useState<PunchMode>("first_in_last_out");
  const [arrivalEnabled, setArrivalEnabled] = useState(false);
  const [appliesToAll, setAppliesToAll] = useState(true);
  const [windowStart, setWindowStart] = useState("10:00");
  const [okUntil, setOkUntil] = useState("11:00");
  const [afterStatus, setAfterStatus] = useState<AfterStatus>("half_day");
  const [shiftWindows, setShiftWindows] = useState<ShiftWindowRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rules, shiftRes] = await Promise.all([
        listSetupApi(API),
        resourceService.list(SHIFTS_API).catch(() => ({ data: [] })),
      ]);
      setRows(
        rules.map((r) => ({
          ...r,
          code: r.rule_code ?? r.code,
          name: r.rule_name ?? r.name,
        })),
      );
      const shiftRows = Array.isArray(shiftRes.data) ? shiftRes.data : [];
      setShifts(
        shiftRows.map((s) => ({
          id: String(s.id),
          code: String(s.shift_code ?? ""),
          name: String(s.shift_name ?? ""),
          start: hhmm(s.start_time),
          end: hhmm(s.end_time),
        })),
      );
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to load policies", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.code, r.punch_mode, r.status]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q)),
    );
  }, [rows, query]);

  function resetForm(next?: SetupRow | null) {
    if (next) {
      setActive(next);
      setRuleName(String(next.rule_name ?? next.name ?? ""));
      setRuleCode(String(next.rule_code ?? next.code ?? ""));
      setStatus(String(next.status ?? "active"));
      setGraceMinutes(String(next.grace_minutes ?? 15));
      setLateMarkAfter(String(next.late_mark_after_minutes ?? next.late_mark_after ?? 15));
      setHalfDayHours(String(next.half_day_hours ?? 4));
      setFullDayHours(String(next.full_day_hours ?? 8));
      setEarlyLeaveHalf(String(next.early_leave_half_day_minutes ?? 120));
      setMissPunchWindow(String(next.miss_punch_window_hours ?? 48));
      setOvertimeAllowed(Boolean(next.overtime_allowed ?? true));
      setGeofenceRequired(Boolean(next.geofence_required));
      setPunchMode(
        (String(next.punch_mode ?? "first_in_last_out") as PunchMode) || "first_in_last_out",
      );
      setArrivalEnabled(Boolean(next.arrival_policy_enabled));
      setAppliesToAll(next.applies_to_all_shifts !== false);
      setWindowStart(hhmm(next.arrival_window_start) || "10:00");
      setOkUntil(hhmm(next.arrival_ok_until) || "11:00");
      setAfterStatus((String(next.arrival_after_status ?? "half_day") as AfterStatus) || "half_day");
      const windows = Array.isArray(next.shift_windows_json) ? next.shift_windows_json : [];
      setShiftWindows(
        windows.map((w: Record<string, unknown>) => ({
          shift_id: String(w.shift_id ?? ""),
          shift_code: String(w.shift_code ?? ""),
          window_start: hhmm(w.window_start) || "10:00",
          ok_until: hhmm(w.ok_until) || "11:00",
          after_status: (String(w.after_status ?? "half_day") as AfterStatus) || "half_day",
        })),
      );
      return;
    }
    setActive(null);
    setRuleName("");
    setRuleCode(nextCode(tab.codePrefix ?? "AR", rows.map((r) => String(r.code ?? ""))));
    setStatus("active");
    setGraceMinutes("15");
    setLateMarkAfter("15");
    setHalfDayHours("4");
    setFullDayHours("8");
    setEarlyLeaveHalf("120");
    setMissPunchWindow("48");
    setOvertimeAllowed(true);
    setGeofenceRequired(false);
    setPunchMode("first_in_last_out");
    setArrivalEnabled(false);
    setAppliesToAll(true);
    setWindowStart("10:00");
    setOkUntil("11:00");
    setAfterStatus("half_day");
    setShiftWindows([]);
  }

  function openCreate() {
    resetForm(null);
    setMode("create");
  }

  function openEdit(row: SetupRow) {
    resetForm(row);
    setMode("edit");
  }

  function buildBody() {
    return {
      rule_code: ruleCode,
      rule_name: ruleName,
      grace_minutes: Number(graceMinutes || 15),
      late_mark_after_minutes: Number(lateMarkAfter || 15),
      half_day_hours: Number(halfDayHours || 4),
      full_day_hours: Number(fullDayHours || 8),
      early_leave_half_day_minutes: Number(earlyLeaveHalf || 120),
      miss_punch_window_hours: Number(missPunchWindow || 48),
      overtime_allowed: overtimeAllowed,
      geofence_required: geofenceRequired,
      punch_mode: punchMode,
      arrival_policy_enabled: arrivalEnabled,
      applies_to_all_shifts: appliesToAll,
      arrival_window_start: arrivalEnabled && appliesToAll ? windowStart || null : null,
      arrival_ok_until: arrivalEnabled && appliesToAll ? okUntil || null : null,
      arrival_after_status: afterStatus,
      shift_windows_json:
        arrivalEnabled && !appliesToAll
          ? shiftWindows.map((w) => ({
              shift_id: w.shift_id || null,
              shift_code: w.shift_code,
              window_start: w.window_start,
              ok_until: w.ok_until,
              after_status: w.after_status,
            }))
          : [],
      is_default: true,
      status,
    };
  }

  async function save() {
    if (!ruleName.trim()) {
      toast("Policy name is required", "error");
      return;
    }
    if (arrivalEnabled && appliesToAll && (!windowStart || !okUntil)) {
      toast("Set arrival window start and OK-until times", "error");
      return;
    }
    if (arrivalEnabled && !appliesToAll && shiftWindows.length === 0) {
      toast("Add at least one shift window, or apply to all shifts", "error");
      return;
    }
    setSaving(true);
    try {
      const body = buildBody();
      if (mode === "edit" && active?.id) {
        await resourceService.update(API, String(active.id), body);
        toast("Attendance policy updated", "success");
      } else {
        await resourceService.create(API, body);
        toast("Attendance policy created", "success");
      }
      setMode(null);
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: SetupRow) {
    try {
      await resourceService.delete(API, String(row.id));
      toast("Policy deleted", "success");
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Delete failed", "error");
    }
  }

  function addShiftWindow() {
    const used = new Set(shiftWindows.map((w) => w.shift_id));
    const next = shifts.find((s) => !used.has(s.id)) ?? shifts[0];
    if (!next) {
      toast("Create shifts in Shift master first", "error");
      return;
    }
    setShiftWindows((prev) => [...prev, emptyWindow(next)]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{tab.title}</h2>
          <p className="text-xs text-muted-foreground">
            Arrival windows, half-day cutoffs, and biometric punch aggregation
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => void load()}
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={openCreate}
          >
            <Plus className="size-3.5" />
            New policy
          </Button>
        </div>
      </div>

      <Input
        placeholder="Search policies…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/70 bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Policy</th>
              <th className="px-3 py-2 font-medium">Arrival window</th>
              <th className="px-3 py-2 font-medium">Biometric</th>
              <th className="px-3 py-2 font-medium">Hours</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No attendance policies yet. Create one to define arrival windows and punch rules.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={String(row.id)} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">{String(row.name)}</p>
                    <p className="text-[11px] text-muted-foreground">{String(row.code)}</p>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.arrival_policy_enabled
                      ? row.applies_to_all_shifts !== false
                        ? `${hhmm(row.arrival_window_start) || "—"} → ${hhmm(row.arrival_ok_until) || "—"} · after ${String(row.arrival_after_status || "half_day")}`
                        : `${Array.isArray(row.shift_windows_json) ? row.shift_windows_json.length : 0} shift window(s)`
                      : "Disabled"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {String(row.punch_mode || "first_in_last_out") === "every_punch"
                      ? "Every punch (pair sessions)"
                      : "First in / last out"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {String(row.half_day_hours ?? 4)}h / {String(row.full_day_hours ?? 8)}h
                  </td>
                  <td className="px-3 py-2">
                    <HrStatusBadge status={String(row.status ?? "active")} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RowActionsMenu
                      open={menuId === String(row.id)}
                      onOpenChange={(o) => setMenuId(o ? String(row.id) : null)}
                      buttonSize="icon-xs"
                    >
                      <RowActionsItem onClick={() => openEdit(row)}>
                        <Pencil className="size-3.5" /> Edit
                      </RowActionsItem>
                      <RowActionsItem onClick={() => setConfirmDelete(row)} destructive>
                        <Trash2 className="size-3.5" /> Delete
                      </RowActionsItem>
                    </RowActionsMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SetupDrawer
        open={mode !== null}
        title={mode === "edit" ? "Edit attendance policy" : "New attendance policy"}
        description="Configure arrival time windows per shift and how biometric punches are counted."
        onClose={() => setMode(null)}
        wide
        footer={
          <>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => setMode(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save policy"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <section className="space-y-3 rounded-lg border border-border/70 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="size-4 text-primary" />
              Basics
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SetupField label="Policy name" required>
                <SetupInput value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
              </SetupField>
              <SetupField label="Code" required>
                <SetupInput
                  value={ruleCode}
                  onChange={(e) => setRuleCode(e.target.value)}
                  readOnly={mode === "edit"}
                />
              </SetupField>
              <SetupField label="Grace (minutes)">
                <SetupInput
                  type="number"
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(e.target.value)}
                />
              </SetupField>
              <SetupField label="Late mark after (minutes)">
                <SetupInput
                  type="number"
                  value={lateMarkAfter}
                  onChange={(e) => setLateMarkAfter(e.target.value)}
                />
              </SetupField>
              <SetupField label="Half-day hours">
                <SetupInput
                  type="number"
                  value={halfDayHours}
                  onChange={(e) => setHalfDayHours(e.target.value)}
                />
              </SetupField>
              <SetupField label="Full-day hours">
                <SetupInput
                  type="number"
                  value={fullDayHours}
                  onChange={(e) => setFullDayHours(e.target.value)}
                />
              </SetupField>
              <SetupField label="Early leave → half day (min)">
                <SetupInput
                  type="number"
                  value={earlyLeaveHalf}
                  onChange={(e) => setEarlyLeaveHalf(e.target.value)}
                />
              </SetupField>
              <SetupField label="Miss-punch window (hours)">
                <SetupInput
                  type="number"
                  value={missPunchWindow}
                  onChange={(e) => setMissPunchWindow(e.target.value)}
                />
              </SetupField>
              <SetupField label="Status">
                <SetupSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </SetupSelect>
              </SetupField>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={overtimeAllowed}
                onChange={(e) => setOvertimeAllowed(e.target.checked)}
              />
              Overtime allowed
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={geofenceRequired}
                onChange={(e) => setGeofenceRequired(e.target.checked)}
              />
              Require GPS on punch
            </label>
          </section>

          <section className="space-y-3 rounded-lg border border-border/70 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock3 className="size-4 text-primary" />
              Arrival time window
            </div>
            <p className="text-[11px] text-muted-foreground">
              Example: employees may arrive between <strong>10:00</strong> and <strong>11:00</strong>.
              After 11:00, mark as half day (or absent / late).
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={arrivalEnabled}
                onChange={(e) => setArrivalEnabled(e.target.checked)}
              />
              Enable arrival window policy
            </label>

            {arrivalEnabled ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(
                      "cursor-pointer rounded-md border px-3 py-1.5 text-xs transition-colors duration-200",
                      appliesToAll
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50",
                    )}
                    onClick={() => setAppliesToAll(true)}
                  >
                    All shifts (General + others)
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "cursor-pointer rounded-md border px-3 py-1.5 text-xs transition-colors duration-200",
                      !appliesToAll
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50",
                    )}
                    onClick={() => setAppliesToAll(false)}
                  >
                    Per-shift windows
                  </button>
                </div>

                {appliesToAll ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <SetupField label="Window start" required hint="Earliest expected arrival">
                      <SetupInput
                        type="time"
                        value={windowStart}
                        onChange={(e) => setWindowStart(e.target.value)}
                      />
                    </SetupField>
                    <SetupField label="OK until" required hint="Arrive by this time — still full day">
                      <SetupInput
                        type="time"
                        value={okUntil}
                        onChange={(e) => setOkUntil(e.target.value)}
                      />
                    </SetupField>
                    <SetupField label="After window">
                      <SetupSelect
                        value={afterStatus}
                        onChange={(e) => setAfterStatus(e.target.value as AfterStatus)}
                      >
                        <option value="half_day">Count as half day</option>
                        <option value="absent">Count as absent</option>
                        <option value="late">Mark late only</option>
                      </SetupSelect>
                    </SetupField>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {shiftWindows.map((w, idx) => (
                      <div
                        key={`${w.shift_id}-${idx}`}
                        className="grid gap-2 rounded-md border border-border/60 bg-muted/20 p-2 sm:grid-cols-5"
                      >
                        <SetupField label="Shift">
                          <SetupSelect
                            value={w.shift_id}
                            onChange={(e) => {
                              const sh = shifts.find((s) => s.id === e.target.value);
                              setShiftWindows((prev) =>
                                prev.map((row, i) =>
                                  i === idx
                                    ? {
                                        ...row,
                                        shift_id: sh?.id ?? "",
                                        shift_code: sh?.code ?? "",
                                        window_start: hhmm(sh?.start) || row.window_start,
                                      }
                                    : row,
                                ),
                              );
                            }}
                          >
                            <option value="">Select shift</option>
                            {shifts.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.code} · {s.name}
                              </option>
                            ))}
                          </SetupSelect>
                        </SetupField>
                        <SetupField label="From">
                          <SetupInput
                            type="time"
                            value={w.window_start}
                            onChange={(e) =>
                              setShiftWindows((prev) =>
                                prev.map((row, i) =>
                                  i === idx ? { ...row, window_start: e.target.value } : row,
                                ),
                              )
                            }
                          />
                        </SetupField>
                        <SetupField label="OK until">
                          <SetupInput
                            type="time"
                            value={w.ok_until}
                            onChange={(e) =>
                              setShiftWindows((prev) =>
                                prev.map((row, i) =>
                                  i === idx ? { ...row, ok_until: e.target.value } : row,
                                ),
                              )
                            }
                          />
                        </SetupField>
                        <SetupField label="After">
                          <SetupSelect
                            value={w.after_status}
                            onChange={(e) =>
                              setShiftWindows((prev) =>
                                prev.map((row, i) =>
                                  i === idx
                                    ? { ...row, after_status: e.target.value as AfterStatus }
                                    : row,
                                ),
                              )
                            }
                          >
                            <option value="half_day">Half day</option>
                            <option value="absent">Absent</option>
                            <option value="late">Late</option>
                          </SetupSelect>
                        </SetupField>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() =>
                              setShiftWindows((prev) => prev.filter((_, i) => i !== idx))
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={addShiftWindow}
                    >
                      <Plus className="size-3.5" />
                      Add shift window
                    </Button>
                  </div>
                )}
              </>
            ) : null}
          </section>

          <section className="space-y-3 rounded-lg border border-border/70 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Fingerprint className="size-4 text-primary" />
              Biometric punch data
            </div>
            <p className="text-[11px] text-muted-foreground">
              Choose what the system uses when a device sends multiple punches in a day.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={cn(
                  "cursor-pointer rounded-lg border p-3 text-left transition-colors duration-200",
                  punchMode === "first_in_last_out"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/40",
                )}
                onClick={() => setPunchMode("first_in_last_out")}
              >
                <p className="text-xs font-semibold">First punch in · Last punch out</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Ignores middle punches for attendance times. Hours = last − first.
                </p>
              </button>
              <button
                type="button"
                className={cn(
                  "cursor-pointer rounded-lg border p-3 text-left transition-colors duration-200",
                  punchMode === "every_punch"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/40",
                )}
                onClick={() => setPunchMode("every_punch")}
              >
                <p className="text-xs font-semibold">Every punch (pair sessions)</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Pairs punches 1–2, 3–4… and sums session hours (break-aware).
                </p>
              </button>
            </div>
          </section>
        </div>
      </SetupDrawer>

      <SetupConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete attendance policy?"
        message={
          confirmDelete
            ? `Remove ${String(confirmDelete.name)} (${String(confirmDelete.code)})?`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
      />
    </div>
  );
}
