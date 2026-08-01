"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { ApiClientError, resourceService } from "@/services/api-client";

type Row = {
  id: string;
  employee_id: string;
  status: string;
  [key: string]: unknown;
};

type Option = { id: string; label: string };

export default function OtAllotmentPage() {
  const [onDuty, setOnDuty] = useState<Row[]>([]);
  const [ot, setOt] = useState<Row[]>([]);
  const [compoff, setCompoff] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [hours, setHours] = useState("2");
  const [allotmentType, setAllotmentType] = useState("overtime");
  const [allotmentDate, setAllotmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [od, allot, co] = await Promise.all([
        resourceService.list("/hr/on-duty-requests", { page_size: 100 }),
        resourceService.list("/hr/ot-allotments", { page_size: 100 }),
        resourceService.list("/hr/compoff-requests", { page_size: 100 }),
      ]);
      setOnDuty((Array.isArray(od.data) ? od.data : []) as Row[]);
      setOt((Array.isArray(allot.data) ? allot.data : []) as Row[]);
      setCompoff((Array.isArray(co.data) ? co.data : []) as Row[]);
    } catch {
      toast("Failed to load On Duty / OT / Comp Off queues", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const [empRes, branchRes] = await Promise.all([
        resourceService.list("/employees", { page_size: 200 }),
        resourceService.list("/branches", { page_size: 200 }),
      ]);
      const empList = Array.isArray(empRes.data) ? empRes.data : [];
      const branchList = Array.isArray(branchRes.data) ? branchRes.data : [];
      const empOpts = empList.map((row) => {
        const r = row as Record<string, unknown>;
        const name = [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
        const code = r.employee_code ? String(r.employee_code) : "";
        return {
          id: String(r.id),
          label: [code, name || String(r.display_name ?? r.email ?? r.id)].filter(Boolean).join(" · "),
        };
      });
      const branchOpts = branchList.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id),
          label: String(r.branch_name ?? r.name ?? r.branch_code ?? r.id),
        };
      });
      setEmployees(empOpts);
      setBranches(branchOpts);
      setEmployeeId((prev) => prev || empOpts[0]?.id || "");
      setBranchId((prev) => prev || branchOpts[0]?.id || "");
    } catch {
      toast("Failed to load employees / branches", "error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(path: string, id: string, action: string) {
    try {
      await resourceService.action(path, id, action);
      toast(`${action}d`, "success");
      void load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Action failed", "error");
    }
  }

  function openCreate() {
    setHours("2");
    setAllotmentType("overtime");
    setAllotmentDate(new Date().toISOString().slice(0, 10));
    setReason("");
    setOpen(true);
    void loadLookups();
  }

  async function submitOt() {
    const hoursNum = Number(hours);
    if (!employeeId || !branchId) {
      toast("Select employee and branch", "error");
      return;
    }
    if (!allotmentDate) {
      toast("Allotment date is required", "error");
      return;
    }
    if (!Number.isFinite(hoursNum) || hoursNum <= 0) {
      toast("Enter valid hours", "error");
      return;
    }

    setSaving(true);
    try {
      const created = await resourceService.create("/hr/ot-allotments", {
        employee_id: employeeId,
        branch_id: branchId,
        hours: hoursNum,
        allotment_type: allotmentType,
        allotment_date: allotmentDate,
        reason: reason.trim() || null,
        status: "draft",
      });
      const id = (created.data as Row | undefined)?.id;
      if (id) await resourceService.action("/hr/ot-allotments", id, "submit");
      toast("OT allotment submitted", "success");
      setOpen(false);
      void load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Create failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="On Duty, OT & Comp Off"
        description="Approve On Duty, overtime / overday allotments, and Comp Off Emp→Mgr→HR requests."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={openCreate}
            >
              Allot OT / Overday
            </Button>
          </div>
        }
      />

      <section className="space-y-2 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">On Duty requests</h2>
        {!onDuty.length ? (
          <p className="text-sm text-muted-foreground">No requests</p>
        ) : (
          <ul className="divide-y divide-border">
            {onDuty.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {String(r.duty_date ?? "")} · {String(r.portion ?? "")} · {r.status}
                  <span className="ml-2 text-xs text-muted-foreground">{r.employee_id}</span>
                </span>
                {r.status === "submitted" ? (
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      className="h-7 cursor-pointer transition-colors duration-200"
                      onClick={() => void act("/hr/on-duty-requests", r.id, "approve")}
                    >
                      <Check className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer transition-colors duration-200"
                      onClick={() => void act("/hr/on-duty-requests", r.id, "reject")}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">OT / Overday allotments</h2>
        {!ot.length ? (
          <p className="text-sm text-muted-foreground">No allotments</p>
        ) : (
          <ul className="divide-y divide-border">
            {ot.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {String(r.allotment_date ?? "")} · {String(r.allotment_type ?? "")} ·{" "}
                  {String(r.hours ?? "")}h · {r.status}
                </span>
                {r.status === "submitted" ? (
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      className="h-7 cursor-pointer transition-colors duration-200"
                      onClick={() => void act("/hr/ot-allotments", r.id, "approve")}
                    >
                      <Check className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer transition-colors duration-200"
                      onClick={() => void act("/hr/ot-allotments", r.id, "reject")}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Comp Off requests (Emp → Mgr → HR)</h2>
        {!compoff.length ? (
          <p className="text-sm text-muted-foreground">No Comp Off requests</p>
        ) : (
          <ul className="divide-y divide-border">
            {compoff.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {String(r.earned_date ?? "")} · {String(r.extra_hours ?? "")}h →{" "}
                  {String(r.requested_days ?? "")}d · {r.status}
                  <span className="ml-2 text-xs text-muted-foreground">{r.employee_id}</span>
                </span>
                {r.status === "submitted" ? (
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      className="h-7 cursor-pointer transition-colors duration-200"
                      onClick={() => void act("/hr/compoff-requests", r.id, "manager-approve")}
                    >
                      Mgr
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer transition-colors duration-200"
                      onClick={() => void act("/hr/compoff-requests", r.id, "reject")}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </span>
                ) : null}
                {r.status === "manager_approved" ? (
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      className="h-7 cursor-pointer transition-colors duration-200"
                      onClick={() => void act("/hr/compoff-requests", r.id, "approve")}
                    >
                      HR Allocate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer transition-colors duration-200"
                      onClick={() => void act("/hr/compoff-requests", r.id, "reject")}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <SetupDrawer
        open={open}
        title="Allot OT / Overday"
        description="Create and submit an overtime or overday allotment for approval."
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void submitOt()}
              disabled={saving}
            >
              {saving ? "Submitting…" : "Submit allotment"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <SetupField label="Employee" required>
            <SetupSelect value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Branch" required>
            <SetupSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Type" required>
            <SetupSelect value={allotmentType} onChange={(e) => setAllotmentType(e.target.value)}>
              <option value="overtime">Overtime</option>
              <option value="overday">Overday</option>
            </SetupSelect>
          </SetupField>
          <div className="grid grid-cols-2 gap-3">
            <SetupField label="Date" required>
              <SetupInput
                type="date"
                value={allotmentDate}
                onChange={(e) => setAllotmentDate(e.target.value)}
              />
            </SetupField>
            <SetupField label="Hours" required>
              <SetupInput
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                inputMode="decimal"
                placeholder="2"
              />
            </SetupField>
          </div>
          <SetupField label="Reason">
            <SetupTextarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional note for approvers"
            />
          </SetupField>
        </div>
      </SetupDrawer>
    </div>
  );
}
