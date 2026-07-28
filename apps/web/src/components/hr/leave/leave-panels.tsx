"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";

import { SetupDrawer, SetupField, SetupInput, SetupSelect, SetupTextarea } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmsTimeline } from "@/components/hr/workforce/ems-primitives";
import {
  advanceLeaveApproval,
  generateCarryForward,
  leaveTrendByMonth,
  saveCompOff,
  saveEncashment,
  updateLeaveTypePolicy,
  type LeaveDirectory,
} from "@/services/leave-management-service";
import type { LeaveRequestRecord, LeaveTypeRecord } from "@/types/leave-management";
import { LEAVE_STATUS_LABELS } from "@/types/leave-management";

export function LeaveBalancePanel({ directory }: { directory: LeaveDirectory }) {
  const [employeeId, setEmployeeId] = useState("");
  const [query, setQuery] = useState("");

  const employees = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    for (const b of directory.balances) {
      if (!map.has(b.employeeId)) {
        map.set(b.employeeId, {
          id: b.employeeId,
          name: b.employeeName || "Unknown",
          code: b.employeeCode || "",
        });
      }
    }
    for (const e of directory.options.employees) {
      if (!map.has(e.id)) {
        map.set(e.id, { id: e.id, name: e.label, code: e.code });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [directory]);

  const byEmployee = useMemo(() => {
    const map = new Map<string, typeof directory.balances>();
    const q = query.trim().toLowerCase();
    for (const b of directory.balances) {
      if (employeeId && b.employeeId !== employeeId) continue;
      if (q) {
        const hay = `${b.employeeName} ${b.employeeCode} ${b.leaveTypeName}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const list = map.get(b.employeeId) ?? [];
      list.push(b);
      map.set(b.employeeId, list);
    }
    return [...map.entries()].sort((a, b) =>
      (a[1][0]?.employeeName ?? "").localeCompare(b[1][0]?.employeeName ?? ""),
    );
  }, [directory.balances, employeeId, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
        <div className="min-w-[12rem] flex-1 space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Employee
          </label>
          <SetupSelect
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full"
          >
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.code})
              </option>
            ))}
          </SetupSelect>
        </div>
        <div className="min-w-[14rem] flex-[2] space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Search
          </label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID, leave type…"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
          onClick={() => {
            setEmployeeId("");
            setQuery("");
          }}
        >
          Clear
        </Button>
        <p className="w-full text-[11px] text-muted-foreground">
          Showing {byEmployee.length} employee{byEmployee.length === 1 ? "" : "s"}
          {employeeId ? " (filtered)" : ""}
        </p>
      </div>

      {byEmployee.map(([empId, rows]) => (
        <div key={empId} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">
            {rows[0]?.employeeName}{" "}
            <span className="font-mono text-xs text-muted-foreground">{rows[0]?.employeeCode}</span>
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((b) => {
              const pct = b.allocated > 0 ? Math.min(100, Math.round((b.used / b.allocated) * 100)) : 0;
              return (
                <div key={b.id} className="rounded-lg border border-border/60 p-2.5">
                  <p className="text-xs font-medium">{b.leaveTypeName}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Alloc {b.allocated} · Used {b.used} · Pending {b.pending} · Avail {b.available}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    CF {b.carryForward} · Encashed {b.encashed}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!byEmployee.length ? (
        <p className="text-xs text-muted-foreground">
          {directory.balances.length
            ? "No balances match this employee filter."
            : "No leave balances loaded. Seed HR balances or import."}
        </p>
      ) : null}
    </div>
  );
}

export function LeaveTypePolicyPanel({
  directory,
  onSaved,
}: {
  directory: LeaveDirectory;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<LeaveTypeRecord | null>(null);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {directory.leaveTypes.map((t) => {
          const used = directory.balances
            .filter((b) => b.leaveTypeId === t.id)
            .reduce((s, b) => s + b.used, 0);
          const allocated = directory.balances
            .filter((b) => b.leaveTypeId === t.id)
            .reduce((s, b) => s + b.allocated, 0);
          return (
            <div key={t.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{t.name}</h3>
                    <span className="font-mono text-[10px] text-muted-foreground">{t.code}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer h-7 shrink-0"
                  onClick={() => setEditing(t)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t.eligibility}</p>
              <p className="mt-2 text-xs">
                Max {t.maxDays || "—"} · Allocated {allocated} · Used {used} · Remaining{" "}
                {Math.max(0, allocated - used)}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Carry forward {t.carryForwardAllowed ? "yes" : "no"} · Approval{" "}
                {t.approvalRequired ? "required" : "optional"} · {t.isPaid ? "Paid" : "Unpaid"} ·{" "}
                {t.status}
              </p>
            </div>
          );
        })}
      </div>
      <LeaveTypeEditDrawer
        open={Boolean(editing)}
        leaveType={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onSaved();
        }}
      />
    </>
  );
}

export function LeaveTypeEditDrawer({
  open,
  leaveType,
  onClose,
  onSaved,
}: {
  open: boolean;
  leaveType: LeaveTypeRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [maxDays, setMaxDays] = useState("12");
  const [isPaid, setIsPaid] = useState(true);
  const [requiresAttachment, setRequiresAttachment] = useState(false);
  const [status, setStatus] = useState("active");
  const [color, setColor] = useState("#059669");
  const [carryForwardAllowed, setCarryForwardAllowed] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [genderRestriction, setGenderRestriction] = useState("");
  const [eligibility, setEligibility] = useState("All employees");
  const [busy, setBusy] = useState(false);

  // Sync form when drawer opens for a type
  useEffect(() => {
    if (!open || !leaveType) return;
    setName(leaveType.name);
    setMaxDays(String(leaveType.maxDays || 0));
    setIsPaid(leaveType.isPaid);
    setRequiresAttachment(leaveType.requiresAttachment);
    setStatus(leaveType.status || "active");
    setColor(leaveType.color);
    setCarryForwardAllowed(leaveType.carryForwardAllowed);
    setApprovalRequired(leaveType.approvalRequired);
    setGenderRestriction(leaveType.genderRestriction || "");
    setEligibility(leaveType.eligibility || "All employees");
    setBusy(false);
  }, [open, leaveType]);

  return (
    <SetupDrawer
      open={open}
      title="Edit leave type policy"
      description={leaveType ? `${leaveType.code} · policy & eligibility` : ""}
      onClose={onClose}
      footer={
        <>
          <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            disabled={busy || !leaveType}
            onClick={() => {
              if (!leaveType) return;
              setBusy(true);
              void updateLeaveTypePolicy(leaveType, {
                name,
                maxDays: Number(maxDays) || 0,
                isPaid,
                requiresAttachment,
                status,
                color,
                carryForwardAllowed,
                approvalRequired,
                genderRestriction,
                eligibility,
              })
                .then(() => {
                  toast("Leave type policy updated", "success");
                  onSaved();
                })
                .catch((e) => toast(e instanceof Error ? e.message : "Update failed", "error"))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : "Save policy"}
          </Button>
        </>
      }
    >
      {leaveType ? (
        <div className="space-y-3">
          <SetupField label="Display name" required>
            <SetupInput value={name} onChange={(e) => setName(e.target.value)} />
          </SetupField>
          <SetupField label="Max days / year">
            <SetupInput type="number" min={0} value={maxDays} onChange={(e) => setMaxDays(e.target.value)} />
          </SetupField>
          <SetupField label="Eligibility">
            <SetupInput value={eligibility} onChange={(e) => setEligibility(e.target.value)} />
          </SetupField>
          <SetupField label="Status">
            <SetupSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Paid leave">
            <SetupSelect value={isPaid ? "yes" : "no"} onChange={(e) => setIsPaid(e.target.value === "yes")}>
              <option value="yes">Yes — paid</option>
              <option value="no">No — unpaid</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Approval required">
            <SetupSelect
              value={approvalRequired ? "yes" : "no"}
              onChange={(e) => setApprovalRequired(e.target.value === "yes")}
            >
              <option value="yes">Required</option>
              <option value="no">Optional / auto</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Carry forward allowed">
            <SetupSelect
              value={carryForwardAllowed ? "yes" : "no"}
              onChange={(e) => setCarryForwardAllowed(e.target.value === "yes")}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Attachment required">
            <SetupSelect
              value={requiresAttachment ? "yes" : "no"}
              onChange={(e) => setRequiresAttachment(e.target.value === "yes")}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Gender restriction">
            <SetupSelect value={genderRestriction} onChange={(e) => setGenderRestriction(e.target.value)}>
              <option value="">None</option>
              <option value="female">Female only</option>
              <option value="male">Male only</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Calendar color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-border/60 bg-transparent"
              />
              <SetupInput value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </SetupField>
          <p className="text-[10px] text-muted-foreground">
            Name, max days, paid flag, attachment, and status save to the API. Color, carry-forward,
            approval, eligibility, and gender rules are stored as HR policy extensions and audited.
          </p>
        </div>
      ) : null}
    </SetupDrawer>
  );
}

export function LeaveApprovalDrawer({
  open,
  request,
  onClose,
  onDone,
}: {
  open: boolean;
  request: LeaveRequestRecord | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  if (!request) return null;

  async function act(action: "approve" | "reject" | "send_back" | "request_info" | "cancel") {
    setLoading(true);
    try {
      await advanceLeaveApproval(request!, action, comment || action);
      toast(`Leave ${action.replace(/_/g, " ")}`, "success");
      onDone();
      onClose();
    } catch {
      toast("Action failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      title="Leave approval"
      description={`${request.employeeName} · ${request.leaveTypeName}`}
      wide
      onClose={onClose}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="cursor-pointer" disabled={loading} onClick={() => void act("approve")}>
            Approve
          </Button>
          <Button size="sm" variant="destructive" className="cursor-pointer" disabled={loading} onClick={() => void act("reject")}>
            Reject
          </Button>
          <Button size="sm" variant="outline" className="cursor-pointer" disabled={loading} onClick={() => void act("send_back")}>
            Send back
          </Button>
          <Button size="sm" variant="outline" className="cursor-pointer" disabled={loading} onClick={() => void act("request_info")}>
            Request info
          </Button>
          <Button size="sm" variant="ghost" className="cursor-pointer" disabled={loading} onClick={() => void act("cancel")}>
            Cancel leave
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Workflow: Employee → Manager → HR → Director (optional) → Approved
        </p>
        <p>
          <span className="text-muted-foreground">Dates:</span> {request.fromDate} → {request.toDate} (
          {request.totalDays} days, {request.extension.session.replace(/_/g, " ")})
        </p>
        <p>
          <span className="text-muted-foreground">Status:</span>{" "}
          {LEAVE_STATUS_LABELS[request.extension.approvalStage] ?? request.status}
        </p>
        <p>
          <span className="text-muted-foreground">Reason:</span> {request.reason || "—"}
        </p>
        <SetupField label="Approval comments">
          <SetupTextarea value={comment} onChange={(e) => setComment(e.target.value)} />
        </SetupField>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Approval history</h4>
          <EmsTimeline
            items={(request.extension.approvalHistory ?? []).map((h) => ({
              title: `${h.action} · ${h.stage}`,
              detail: h.comment,
              at: h.at,
              actor: h.actor,
            }))}
          />
        </div>
      </div>
    </SetupDrawer>
  );
}

export function LeaveReportsPanel({ directory }: { directory: LeaveDirectory }) {
  const trend = leaveTrendByMonth(directory.requests);
  const max = Math.max(1, ...trend.map((t) => t.days));
  const byDept = new Map<string, number>();
  for (const r of directory.requests) {
    byDept.set(r.departmentName, (byDept.get(r.departmentName) ?? 0) + r.totalDays);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Leave trend (days)</h3>
        <div className="mt-4 flex h-36 items-end gap-2">
          {trend.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data</p>
          ) : (
            trend.map((t) => (
              <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-primary/80 transition-all"
                  style={{ height: `${(t.days / max) * 100}%`, minHeight: t.days ? 4 : 0 }}
                />
                <span className="text-[9px] text-muted-foreground">{t.month.slice(5)}</span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Department leave report</h3>
        <table className="mt-3 w-full text-left text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1">Department</th>
              <th className="py-1">Days</th>
            </tr>
          </thead>
          <tbody>
            {[...byDept.entries()].map(([d, days]) => (
              <tr key={d} className="border-t border-border/40">
                <td className="py-1.5">{d}</td>
                <td className="py-1.5">{days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Carry forward / Comp-off / Encashment</h3>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer h-7"
            onClick={() => {
              generateCarryForward(directory);
              toast("Carry forward generated from unused balances", "success");
            }}
          >
            Generate carry forward
          </Button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
          <div>
            <p className="font-medium">Carry forward</p>
            <p className="text-muted-foreground">{directory.carryForwards.length} record(s)</p>
          </div>
          <div>
            <p className="font-medium">Comp offs</p>
            <p className="text-muted-foreground">{directory.compOffs.length} record(s)</p>
          </div>
          <div>
            <p className="font-medium">Encashments</p>
            <p className="text-muted-foreground">{directory.encashments.length} record(s)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CompOffEncashDrawers({
  directory,
  onDone,
}: {
  directory: LeaveDirectory | null;
  onDone: () => void;
}) {
  const [compOpen, setCompOpen] = useState(false);
  const [encOpen, setEncOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setCompOpen(true)}>
          Generate comp off
        </Button>
        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setEncOpen(true)}>
          Leave encashment
        </Button>
      </div>

      <SetupDrawer
        open={compOpen}
        title="Generate comp off"
        onClose={() => setCompOpen(false)}
        footer={
          <Button
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              const emp = directory?.options.employees.find((e) => e.id === employeeId);
              if (!emp) {
                toast("Select employee", "error");
                return;
              }
              const earned = new Date().toISOString().slice(0, 10);
              const exp = new Date();
              exp.setMonth(exp.getMonth() + 3);
              saveCompOff({
                employeeId,
                employeeName: emp.label,
                earnedDate: earned,
                days: Number(days) || 1,
                expiryDate: exp.toISOString().slice(0, 10),
                status: "pending",
                reason,
              });
              toast("Comp off created — pending approval", "success");
              setCompOpen(false);
              onDone();
            }}
          >
            Save
          </Button>
        }
      >
        <div className="space-y-3">
          <SetupField label="Employee">
            <SetupSelect value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Select</option>
              {directory?.options.employees.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Days">
            <SetupInput type="number" value={days} onChange={(e) => setDays(e.target.value)} />
          </SetupField>
          <SetupField label="Reason">
            <SetupInput value={reason} onChange={(e) => setReason(e.target.value)} />
          </SetupField>
        </div>
      </SetupDrawer>

      <SetupDrawer
        open={encOpen}
        title="Leave encashment"
        onClose={() => setEncOpen(false)}
        footer={
          <Button
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              const emp = directory?.options.employees.find((e) => e.id === employeeId);
              const lt = directory?.leaveTypes.find((t) => t.id === leaveTypeId);
              if (!emp || !lt) {
                toast("Employee and leave type required", "error");
                return;
              }
              saveEncashment({
                employeeId,
                employeeName: emp.label,
                leaveTypeId,
                leaveTypeName: lt.name,
                requestedDays: Number(days) || 1,
                approvedDays: Number(days) || 1,
                amount: Number(amount) || 0,
                status: "pending",
              });
              toast("Encashment submitted for approval", "success");
              setEncOpen(false);
              onDone();
            }}
          >
            Submit
          </Button>
        }
      >
        <div className="space-y-3">
          <SetupField label="Employee">
            <SetupSelect value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Select</option>
              {directory?.options.employees.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Eligible leave type">
            <SetupSelect value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
              <option value="">Select</option>
              {directory?.leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Requested days">
            <SetupInput type="number" value={days} onChange={(e) => setDays(e.target.value)} />
          </SetupField>
          <SetupField label="Encashed amount">
            <SetupInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </SetupField>
        </div>
      </SetupDrawer>
    </>
  );
}
