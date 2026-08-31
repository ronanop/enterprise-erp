"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";

import { LeaveStatusBadge } from "@/components/hr/leave/leave-status-badge";
import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import { SetupDrawer, SetupField, SetupInput, SetupSelect, SetupTextarea } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  advanceLeaveApproval,
  deleteLeaveType,
  generateCarryForward,
  leaveTrendByMonth,
  saveCompOff,
  saveEncashment,
  updateLeaveTypePolicy,
  type LeaveDirectory,
} from "@/services/leave-management-service";
import type { LeaveRequestRecord, LeaveTypeRecord } from "@/types/leave-management";

export { LeaveBalancePanel } from "@/components/hr/leave/leave-balance-matrix";

export function LeaveTypePolicyPanel({
  directory,
  onSaved,
}: {
  directory: LeaveDirectory;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<LeaveTypeRecord | null>(null);

  const editingUsed = editing
    ? directory.balances
        .filter((b) => b.leaveTypeId === editing.id)
        .reduce((s, b) => s + b.used, 0)
    : 0;

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
                Max {t.maxDays || "—"}/yr · {t.daysPerMonth || "—"}/mo · Allocated {allocated} · Used {used} · Remaining{" "}
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
        usedDays={editingUsed}
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
  usedDays = 0,
  onClose,
  onSaved,
}: {
  open: boolean;
  leaveType: LeaveTypeRecord | null;
  usedDays?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [maxDays, setMaxDays] = useState("12");
  const [daysPerMonth, setDaysPerMonth] = useState("1");
  const [isPaid, setIsPaid] = useState(true);
  const [requiresAttachment, setRequiresAttachment] = useState(false);
  const [status, setStatus] = useState("active");
  const [color, setColor] = useState("#9B5BB8");
  const [carryForwardAllowed, setCarryForwardAllowed] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [genderRestriction, setGenderRestriction] = useState("");
  const [eligibility, setEligibility] = useState("All employees");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync form when drawer opens for a type
  useEffect(() => {
    if (!open || !leaveType) return;
    setName(leaveType.name);
    setMaxDays(String(leaveType.maxDays || 0));
    setDaysPerMonth(String(leaveType.daysPerMonth || 0));
    setIsPaid(leaveType.isPaid);
    setRequiresAttachment(leaveType.requiresAttachment);
    setStatus(leaveType.status || "active");
    setColor(leaveType.color);
    setCarryForwardAllowed(leaveType.carryForwardAllowed);
    setApprovalRequired(leaveType.approvalRequired);
    setGenderRestriction(leaveType.genderRestriction || "");
    setEligibility(leaveType.eligibility || "All employees");
    setBusy(false);
    setConfirmDelete(false);
    setDeleting(false);
  }, [open, leaveType]);

  return (
    <>
    <SetupDrawer
      open={open}
      title="Edit Leave Type Policy"
      description={leaveType ? `${leaveType.code} · policy & eligibility` : ""}
      onClose={onClose}
      footer={
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mr-auto cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={busy || deleting || !leaveType || usedDays > 0}
            title={usedDays > 0 ? "Cannot delete while used balance exists" : "Delete leave type"}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            disabled={busy || deleting || !leaveType}
            onClick={() => {
              if (!leaveType) return;
              setBusy(true);
              void updateLeaveTypePolicy(leaveType, {
                name,
                maxDays: Number(maxDays) || 0,
                daysPerMonth: Number(daysPerMonth) || 0,
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
          <SetupField label="Leave / month" hint="Days credited each month (accrual)">
            <SetupInput
              type="number"
              min={0}
              step="0.5"
              value={daysPerMonth}
              onChange={(e) => setDaysPerMonth(e.target.value)}
            />
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
    <SetupConfirmDialog
      open={confirmDelete}
      title="Delete leave type"
      message={
        leaveType
          ? `Remove “${leaveType.name}” (${leaveType.code})? Types with used balance or open requests cannot be deleted.`
          : ""
      }
      confirmLabel="Delete"
      destructive
      loading={deleting}
      onCancel={() => {
        if (deleting) return;
        setConfirmDelete(false);
      }}
      onConfirm={() => {
        if (!leaveType) return;
        setDeleting(true);
        void deleteLeaveType(leaveType)
          .then(() => {
            toast("Leave type deleted", "success");
            setConfirmDelete(false);
            onSaved();
          })
          .catch((e) => toast(e instanceof Error ? e.message : "Delete failed", "error"))
          .finally(() => setDeleting(false));
      }}
    />
    </>
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
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setComment("");
    setShowHistory(false);
  }, [request?.id]);

  if (!open || !request) return null;

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

  const isHr =
    request.status === "manager_approved" || request.extension.approvalStage === "hr_review";
  const history = request.extension.approvalHistory ?? [];

  return (
    <aside className="flex h-full w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm lg:w-[320px] xl:w-[340px]">
      <div className="flex items-start justify-between gap-2 border-b border-border/70 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{request.employeeName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {request.employeeCode} · {request.leaveTypeName}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="cursor-pointer shrink-0"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="erp-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <LeaveStatusBadge status={request.extension.approvalStage || request.status} />
          <span className="text-[11px] text-muted-foreground">
            {request.totalDays} day{request.totalDays === 1 ? "" : "s"} ·{" "}
            {request.extension.session.replace(/_/g, " ")}
          </span>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Dates</dt>
          <dd className="font-medium">
            {request.fromDate} → {request.toDate}
          </dd>
          <dt className="text-muted-foreground">Dept</dt>
          <dd>{request.departmentName || "—"}</dd>
          <dt className="text-muted-foreground">Applied</dt>
          <dd>{request.appliedOn.slice(0, 10)}</dd>
          <dt className="text-muted-foreground">Approver</dt>
          <dd>{request.approverName || "—"}</dd>
        </dl>

        <div className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-2">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Reason
          </p>
          <p className="text-xs leading-snug whitespace-pre-wrap">
            {request.reason?.trim() || "No reason provided."}
          </p>
        </div>

        {(request.extension.contactDuringLeave || request.extension.emergencyContact) && (
          <div className="space-y-0.5 text-[11px] text-muted-foreground">
            {request.extension.contactDuringLeave ? (
              <p>Contact: {request.extension.contactDuringLeave}</p>
            ) : null}
            {request.extension.emergencyContact ? (
              <p>Emergency: {request.extension.emergencyContact}</p>
            ) : null}
          </div>
        )}

        <SetupField label="Comment">
          <SetupTextarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[56px] text-xs"
            placeholder="Optional note…"
          />
        </SetupField>

        {history.length > 0 ? (
          <div>
            <button
              type="button"
              className="cursor-pointer text-[11px] font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? "Hide history" : `History (${history.length})`}
            </button>
            {showHistory ? (
              <ul className="mt-1.5 space-y-1.5 border-t border-border/50 pt-1.5">
                {history.slice(0, 5).map((h) => (
                  <li key={h.id} className="text-[11px] leading-snug">
                    <span className="font-medium capitalize">{h.action.replace(/_/g, " ")}</span>
                    {h.comment ? <span className="text-muted-foreground"> · {h.comment}</span> : null}
                    <span className="block text-muted-foreground">
                      {h.actor} · {h.at.slice(0, 16).replace("T", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5 border-t border-border/70 px-3 py-2.5">
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            className="cursor-pointer h-8 text-xs"
            disabled={loading}
            onClick={() => void act("approve")}
          >
            {isHr ? "HR Approve" : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="cursor-pointer h-8 text-xs"
            disabled={loading}
            onClick={() => void act("reject")}
          >
            Reject
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer h-7 px-1 text-[10px]"
            disabled={loading}
            onClick={() => void act("send_back")}
          >
            Send back
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer h-7 px-1 text-[10px]"
            disabled={loading}
            onClick={() => void act("request_info")}
          >
            Info
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="cursor-pointer h-7 px-1 text-[10px]"
            disabled={loading}
            onClick={() => void act("cancel")}
          >
            Cancel
          </Button>
        </div>
      </div>
    </aside>
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
              void generateCarryForward(directory)
                .then((rows) =>
                  toast(`Carry forward: ${rows.length} balance(s)`, "success"),
                )
                .catch((err) =>
                  toast(err instanceof Error ? err.message : "Carry forward failed", "error"),
                );
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
          Generate Comp Off
        </Button>
        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setEncOpen(true)}>
          Leave Encashment
        </Button>
      </div>

      <SetupDrawer
        open={compOpen}
        title="Generate Comp Off"
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
              void saveCompOff({
                employeeId,
                employeeName: emp.label,
                earnedDate: earned,
                days: Number(days) || 1,
                expiryDate: exp.toISOString().slice(0, 10),
                status: "pending",
                reason,
              })
                .then(() => {
                  toast("Comp off credited", "success");
                  setCompOpen(false);
                  onDone();
                })
                .catch((e) => toast(e instanceof Error ? e.message : "Failed", "error"));
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
        title="Leave Encashment"
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
              void saveEncashment({
                employeeId,
                employeeName: emp.label,
                leaveTypeId,
                leaveTypeName: lt.name,
                requestedDays: Number(days) || 1,
                approvedDays: Number(days) || 1,
                amount: Number(amount) || 0,
                status: "pending",
              })
                .then(() => {
                  toast("Encashment submitted", "success");
                  setEncOpen(false);
                  onDone();
                })
                .catch((e) => toast(e instanceof Error ? e.message : "Failed", "error"));
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
