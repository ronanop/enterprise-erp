"use client";

import { SetupDrawer, SetupField, SetupInput, SetupSelect, SetupTextarea } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { EmsTimeline } from "@/components/hr/workforce/ems-primitives";
import {
  advanceLeaveApproval,
  generateCarryForward,
  leaveTrendByMonth,
  saveCompOff,
  saveEncashment,
  type LeaveDirectory,
} from "@/services/leave-management-service";
import type { LeaveRequestRecord } from "@/types/leave-management";
import { LEAVE_STATUS_LABELS } from "@/types/leave-management";
import { useState } from "react";

export function LeaveBalancePanel({ directory }: { directory: LeaveDirectory }) {
  const byEmployee = new Map<string, typeof directory.balances>();
  for (const b of directory.balances) {
    const list = byEmployee.get(b.employeeId) ?? [];
    list.push(b);
    byEmployee.set(b.employeeId, list);
  }

  return (
    <div className="space-y-4">
      {[...byEmployee.entries()].slice(0, 20).map(([empId, rows]) => (
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
      {!directory.balances.length ? (
        <p className="text-xs text-muted-foreground">No leave balances loaded. Seed HR balances or import.</p>
      ) : null}
    </div>
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
