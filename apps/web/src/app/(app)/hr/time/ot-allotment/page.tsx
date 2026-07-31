"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { resourceService } from "@/services/api-client";
import { ApiClientError } from "@/services/api-client";

type Row = {
  id: string;
  employee_id: string;
  status: string;
  [key: string]: unknown;
};

export default function OtAllotmentPage() {
  const [onDuty, setOnDuty] = useState<Row[]>([]);
  const [ot, setOt] = useState<Row[]>([]);
  const [compoff, setCompoff] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function createOt() {
    const employeeId = window.prompt("Employee UUID");
    const branchId = window.prompt("Branch UUID");
    const hours = window.prompt("Hours", "2");
    const allotmentType = window.prompt("Type (overtime|overday)", "overtime") || "overtime";
    const allotmentDate = window.prompt("Date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!employeeId || !branchId || !hours || !allotmentDate) return;
    try {
      const created = await resourceService.create("/hr/ot-allotments", {
        employee_id: employeeId,
        branch_id: branchId,
        hours: Number(hours),
        allotment_type: allotmentType,
        allotment_date: allotmentDate,
        status: "draft",
      });
      const id = (created.data as Row | undefined)?.id;
      if (id) await resourceService.action("/hr/ot-allotments", id, "submit");
      toast("OT allotment submitted", "success");
      void load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Create failed", "error");
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
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
            <Button size="sm" className="cursor-pointer" onClick={() => void createOt()}>
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
                    <Button size="sm" className="h-7 cursor-pointer" onClick={() => void act("/hr/on-duty-requests", r.id, "approve")}>
                      <Check className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 cursor-pointer" onClick={() => void act("/hr/on-duty-requests", r.id, "reject")}>
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
                  {String(r.allotment_date ?? "")} · {String(r.allotment_type ?? "")} · {String(r.hours ?? "")}h · {r.status}
                </span>
                {r.status === "submitted" ? (
                  <span className="flex gap-1">
                    <Button size="sm" className="h-7 cursor-pointer" onClick={() => void act("/hr/ot-allotments", r.id, "approve")}>
                      <Check className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 cursor-pointer" onClick={() => void act("/hr/ot-allotments", r.id, "reject")}>
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
                  {String(r.earned_date ?? "")} · {String(r.extra_hours ?? "")}h → {String(r.requested_days ?? "")}d · {r.status}
                  <span className="ml-2 text-xs text-muted-foreground">{r.employee_id}</span>
                </span>
                {r.status === "submitted" ? (
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      className="h-7 cursor-pointer"
                      onClick={() => void act("/hr/compoff-requests", r.id, "manager-approve")}
                    >
                      Mgr
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 cursor-pointer" onClick={() => void act("/hr/compoff-requests", r.id, "reject")}>
                      <X className="size-3.5" />
                    </Button>
                  </span>
                ) : null}
                {r.status === "manager_approved" ? (
                  <span className="flex gap-1">
                    <Button size="sm" className="h-7 cursor-pointer" onClick={() => void act("/hr/compoff-requests", r.id, "approve")}>
                      HR Allocate
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 cursor-pointer" onClick={() => void act("/hr/compoff-requests", r.id, "reject")}>
                      <X className="size-3.5" />
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
