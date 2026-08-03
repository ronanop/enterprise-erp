"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ApplyLeaveDialog } from "@/components/hr/forms/apply-leave-dialog";
import { DesignationFormDialog } from "@/components/hr/forms/designation-form-dialog";
import { MarkAttendanceDialog } from "@/components/hr/forms/mark-attendance-dialog";
import {
  HrAuthBanner,
  HrEmptyState,
  HrKpiGrid,
  HrLoadingBlock,
  HrSection,
  HrSetupCard,
  HrStatusBadge,
  HrTable,
  HrToolbar,
} from "@/components/hr/hr-primitives";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { ApiClientError, downloadApiFile, resourceService } from "@/services/api-client";
import {
  countByAttendanceStatus,
  countByStatus,
  countOpenDocs,
  employeeDisplayName,
  formatQty,
  loadHrOverview,
  type HrOverview,
  type HrRow,
} from "@/services/hr-service";
import { loadPayrollOverview, type PayrollOverview } from "@/services/payroll-service";
import {
  candidateDisplayName,
  loadRecruitmentOverview,
  type RecruitmentOverview,
} from "@/services/recruitment-service";

function useHrData() {
  const [data, setData] = useState<HrOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadHrOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return { data, loading, load, authBlocked, authenticated };
}

function filterRows(rows: HrRow[], q: string, fields: string[]): HrRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    fields.some((f) => String(row[f] ?? "").toLowerCase().includes(needle)),
  );
}

export function WorkforceHub() {
  const { data, loading, load, authBlocked } = useHrData();
  const [q, setQ] = useState("");

  const rows = useMemo(
    () => filterRows(data?.profiles ?? [], q, ["employee_name", "employee_code", "status", "first_name", "last_name"]),
    [data, q],
  );

  const employmentByEmployee = useMemo(() => {
    const map = new Map<string, HrRow>();
    for (const row of data?.employment ?? []) {
      map.set(String(row.employee_id), row);
    }
    return map;
  }, [data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workforce"
        description="Employee directory — profiles, employment status, and quick access to HR records."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Link href="/hr/employee-profiles" className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground hover:bg-primary/80">All profiles</Link>
            <Link href="/hr/employment" className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted">Employment</Link>
          </HrToolbar>
        }
      />
      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !data ? <HrLoadingBlock /> : null}
      <HrKpiGrid
        items={[
          {
            label: "Profiles",
            value: data?.profiles.length ?? 0,
            hint: "Employee HR profiles",
          },
          {
            label: "Active",
            value: countByStatus(data?.profiles ?? [], ["active"]),
          },
          {
            label: "Employment records",
            value: data?.employment.length ?? 0,
          },
          {
            label: "Documents",
            value: data?.documents.length ?? 0,
          },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, code, status…"
          className="max-w-sm"
        />
      </div>
      <HrTable
        columns={[
          { key: "name", label: "Employee" },
          { key: "code", label: "Code" },
          { key: "type", label: "Employment" },
          { key: "joined", label: "Joined" },
          { key: "status", label: "Status" },
        ]}
        emptyTitle="No employees found"
        emptyDescription="Seed demo HR data or create employee profiles from master data."
        rows={rows.map((row) => {
          const emp = employmentByEmployee.get(String(row.employee_id));
          return {
            __key: String(row.id),
            name: employeeDisplayName(row),
            code: String(row.employee_code ?? "—"),
            type: String(emp?.employment_type ?? "—"),
            joined: String(emp?.date_of_joining ?? "—"),
            status: <HrStatusBadge status={String(row.status ?? "—")} />,
          };
        })}
      />
    </div>
  );
}

export function LeaveHub() {
  const { data, loading, load, authBlocked } = useHrData();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const requests = useMemo(
    () => filterRows(data?.leaveRequests ?? [], q, ["document_number", "status", "employee_id"]),
    [data, q],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leave management"
        description="Balances, requests, and approval-friendly leave tracking."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button size="sm" className="cursor-pointer" onClick={() => setOpen(true)}>
              <Plus className="size-3.5" />
              Apply leave
            </Button>
          </HrToolbar>
        }
      />
      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !data ? <HrLoadingBlock /> : null}
      <HrKpiGrid
        items={[
          {
            label: "Pending",
            value: countByStatus(data?.leaveRequests ?? [], ["draft", "submitted"]),
          },
          {
            label: "Approved",
            value: countByStatus(data?.leaveRequests ?? [], ["approved"]),
          },
          { label: "Balances", value: data?.leaveBalances.length ?? 0 },
          { label: "Leave types", value: data?.leaveTypes.length ?? 0 },
        ]}
      />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter requests…"
        className="max-w-sm"
      />
      <HrSection title="Leave requests" description="Recent and open requests">
        <HrTable
          columns={[
            { key: "doc", label: "Document" },
            { key: "dates", label: "Period" },
            { key: "days", label: "Days" },
            { key: "status", label: "Status" },
          ]}
          emptyTitle="No leave requests"
          emptyDescription="Apply leave to create the first request."
          rows={requests.map((row) => ({
            __key: String(row.id),
            doc: String(row.document_number ?? row.id),
            dates: `${String(row.start_date ?? "—")} → ${String(row.end_date ?? "—")}`,
            days: formatQty(Number(row.days_count ?? 0)),
            status: <HrStatusBadge status={String(row.status ?? "—")} />,
          }))}
        />
      </HrSection>
      <HrSection
        title="Balances"
        actions={
          <Link href="/hr/leave-balances" className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted">Open list</Link>
        }
      >
        <HrTable
          columns={[
            { key: "emp", label: "Employee" },
            { key: "type", label: "Type" },
            { key: "bal", label: "Balance" },
          ]}
          emptyTitle="No leave balances"
          rows={(data?.leaveBalances ?? []).slice(0, 20).map((row) => ({
            __key: String(row.id),
            emp: String(row.employee_id ?? "—").slice(0, 8),
            type: String(row.leave_type_id ?? "—").slice(0, 8),
            bal: formatQty(Number(row.balance_days ?? row.remaining_days ?? row.available_days ?? 0)),
          }))}
        />
      </HrSection>
      <ApplyLeaveDialog open={open} onClose={() => setOpen(false)} onSaved={() => void load()} />
    </div>
  );
}

export function TimeHub() {
  const { data, loading, load, authBlocked } = useHrData();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rows = useMemo(
    () => filterRows(data?.attendance ?? [], q, ["attendance_status", "employee_id", "attendance_date"]),
    [data, q],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance / Time"
        description="Daily attendance, presence mix, and late/absent indicators."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button size="sm" className="cursor-pointer" onClick={() => setOpen(true)}>
              <Plus className="size-3.5" />
              Mark attendance
            </Button>
          </HrToolbar>
        }
      />
      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !data ? <HrLoadingBlock /> : null}
      <HrKpiGrid
        items={[
          {
            label: "Present",
            value: countByAttendanceStatus(data?.attendance ?? [], ["present", "work_from_home"]),
          },
          {
            label: "Absent",
            value: countByAttendanceStatus(data?.attendance ?? [], ["absent"]),
          },
          {
            label: "Half day",
            value: countByAttendanceStatus(data?.attendance ?? [], ["half_day"]),
          },
          { label: "Records", value: data?.attendance.length ?? 0 },
        ]}
      />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter attendance…"
        className="max-w-sm"
      />
      <HrTable
        columns={[
          { key: "date", label: "Date" },
          { key: "emp", label: "Employee" },
          { key: "att", label: "Attendance" },
          { key: "status", label: "Doc status" },
        ]}
        emptyTitle="No attendance rows"
        emptyDescription="Mark attendance to populate today’s register."
        rows={rows.map((row) => ({
          __key: String(row.id),
          date: String(row.attendance_date ?? "—"),
          emp: String(row.employee_id ?? "—").slice(0, 8),
          att: <HrStatusBadge status={String(row.attendance_status ?? "—")} />,
          status: <HrStatusBadge status={String(row.status ?? "—")} />,
        }))}
      />
      <MarkAttendanceDialog open={open} onClose={() => setOpen(false)} onSaved={() => void load()} />
    </div>
  );
}

export function SetupHub() {
  const { data, loading, load, authBlocked } = useHrData();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader
        title="HR Setup"
        description="Masters for designations, shifts, leave types, and holiday calendars."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button size="sm" className="cursor-pointer" onClick={() => setOpen(true)}>
              <Plus className="size-3.5" />
              Add designation
            </Button>
          </HrToolbar>
        }
      />
      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !data ? <HrLoadingBlock /> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <HrSetupCard
          title="Designations"
          description="Job designation masters"
          count={data?.designations.length ?? 0}
          href="/hr/designations"
        />
        <HrSetupCard
          title="Shifts"
          description="Working shift definitions"
          count={data?.shifts.length ?? 0}
          href="/hr/shifts"
        />
        <HrSetupCard
          title="Leave types"
          description="Casual, sick, privilege…"
          count={data?.leaveTypes.length ?? 0}
          href="/hr/leave-types"
        />
        <HrSetupCard
          title="Holiday calendars"
          description="Company holiday sets"
          count={data?.holidayCalendars.length ?? 0}
          href="/hr/holiday-calendars"
        />
        <HrSetupCard
          title="Departments"
          description="Org departments (Organization module)"
          count={0}
          href="/organization/departments"
        />
        <HrSetupCard
          title="Employees (master)"
          description="Master employee records"
          count={0}
          href="/master-data/employees"
        />
      </div>
      <HrSection title="Designations">
        <HrTable
          columns={[
            { key: "code", label: "Code" },
            { key: "name", label: "Name" },
            { key: "level", label: "Level" },
            { key: "status", label: "Status" },
          ]}
          emptyTitle="No designations"
          emptyDescription="Add a designation to get started."
          rows={(data?.designations ?? []).map((row) => ({
            __key: String(row.id),
            code: String(row.designation_code ?? "—"),
            name: String(row.designation_name ?? "—"),
            level: String(row.job_level ?? "—"),
            status: <HrStatusBadge status={String(row.status ?? "—")} />,
          }))}
        />
      </HrSection>
      <DesignationFormDialog open={open} onClose={() => setOpen(false)} onSaved={() => void load()} />
    </div>
  );
}

export function ShiftsHub() {
  const { data, loading, load, authBlocked } = useHrData();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Shifts & roster"
        description="Shift masters and employee shift assignments."
        actions={<HrToolbar onRefresh={() => void load()} loading={loading} />}
      />
      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !data ? <HrLoadingBlock /> : null}
      <HrKpiGrid
        items={[
          { label: "Shifts", value: data?.shifts.length ?? 0 },
          { label: "Assignments", value: data?.shiftAssignments.length ?? 0 },
          { label: "Holidays", value: data?.holidayCalendars.length ?? 0 },
          { label: "Active shifts", value: countByStatus(data?.shifts ?? [], ["active"]) },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <HrSection
          title="Shifts"
          actions={
            <Link href="/hr/shifts" className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted">Manage</Link>
          }
        >
          <HrTable
            columns={[
              { key: "code", label: "Code" },
              { key: "name", label: "Name" },
              { key: "status", label: "Status" },
            ]}
            emptyTitle="No shifts"
            rows={(data?.shifts ?? []).map((row) => ({
              __key: String(row.id),
              code: String(row.shift_code ?? "—"),
              name: String(row.shift_name ?? "—"),
              status: <HrStatusBadge status={String(row.status ?? "—")} />,
            }))}
          />
        </HrSection>
        <HrSection
          title="Assignments"
          actions={
            <Link href="/hr/shift-assignments" className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted">Manage</Link>
          }
        >
          <HrTable
            columns={[
              { key: "emp", label: "Employee" },
              { key: "shift", label: "Shift" },
              { key: "status", label: "Status" },
            ]}
            emptyTitle="No shift assignments"
            rows={(data?.shiftAssignments ?? []).map((row) => ({
              __key: String(row.id),
              emp: String(row.employee_id ?? "—").slice(0, 8),
              shift: String(row.shift_id ?? "—").slice(0, 8),
              status: <HrStatusBadge status={String(row.status ?? "—")} />,
            }))}
          />
        </HrSection>
      </div>
    </div>
  );
}

export function TalentHub() {
  const { data, loading, load, authBlocked } = useHrData();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Talent / Performance"
        description="Reviews, goals, and appraisals."
        actions={<HrToolbar onRefresh={() => void load()} loading={loading} />}
      />
      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !data ? <HrLoadingBlock /> : null}
      <HrKpiGrid
        items={[
          {
            label: "Open reviews",
            value: countOpenDocs(data?.reviews ?? [], ["closed", "cancelled", "approved"]),
          },
          { label: "Goals", value: data?.goals.length ?? 0 },
          { label: "Appraisals", value: data?.appraisals.length ?? 0 },
          { label: "Reviews", value: data?.reviews.length ?? 0 },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <HrSetupCard title="Reviews" description="Performance cycles" count={data?.reviews.length ?? 0} href="/hr/performance-reviews" />
        <HrSetupCard title="Goals" description="Employee goals" count={data?.goals.length ?? 0} href="/hr/goals" />
        <HrSetupCard title="Appraisals" description="Appraisal sheets" count={data?.appraisals.length ?? 0} href="/hr/appraisals" />
      </div>
      <HrTable
        columns={[
          { key: "doc", label: "Review" },
          { key: "emp", label: "Employee" },
          { key: "status", label: "Status" },
        ]}
        emptyTitle="No performance reviews"
        rows={(data?.reviews ?? []).map((row) => ({
          __key: String(row.id),
          doc: String(row.document_number ?? row.id),
          emp: String(row.employee_id ?? "—").slice(0, 8),
          status: <HrStatusBadge status={String(row.status ?? "—")} />,
        }))}
      />
    </div>
  );
}

export function TrainingHubPage() {
  const { data, loading, load, authBlocked } = useHrData();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Training / Learning"
        description="Programs, assignments, and completion status."
        actions={<HrToolbar onRefresh={() => void load()} loading={loading} />}
      />
      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !data ? <HrLoadingBlock /> : null}
      <HrKpiGrid
        items={[
          { label: "Programs", value: data?.training.length ?? 0 },
          {
            label: "Open",
            value: countOpenDocs(data?.training ?? [], ["completed", "cancelled", "closed"]),
          },
          {
            label: "Completed",
            value: countByStatus(data?.training ?? [], ["completed"]),
          },
          { label: "Documents vault", value: data?.documents.length ?? 0 },
        ]}
      />
      <HrTable
        columns={[
          { key: "doc", label: "Training" },
          { key: "title", label: "Title" },
          { key: "status", label: "Status" },
        ]}
        emptyTitle="No training programs"
        emptyDescription="Create training records from the training list."
        rows={(data?.training ?? []).map((row) => ({
          __key: String(row.id),
          doc: String(row.document_number ?? row.id),
          title: String(row.training_name ?? row.title ?? "—"),
          status: <HrStatusBadge status={String(row.status ?? "—")} />,
        }))}
      />
      <Link href="/hr/training" className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted">Open training list</Link>
    </div>
  );
}

export function SeparationHub() {
  const { data, loading, load, authBlocked } = useHrData();
  const [actingId, setActingId] = useState<string | null>(null);

  async function runAction(
    id: string,
    action: string,
    body?: Record<string, unknown>,
    label?: string,
  ) {
    setActingId(id);
    try {
      await resourceService.action("/hr/separation", id, action, body ?? {});
      toast(label ?? `Separation ${action}`);
      await load();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Action failed", "error");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Separation / Exit"
        description="Exit requests, last working day, FNF settlement, and clearance tracking."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => toast("Create via API POST /hr/separation or seed demo rows", "info")}
            >
              <Plus className="size-3.5" />
              New separation
            </Button>
          </HrToolbar>
        }
      />
      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !data ? <HrLoadingBlock /> : null}
      <HrKpiGrid
        items={[
          { label: "Separations", value: data?.separation.length ?? 0 },
          {
            label: "Open",
            value: countOpenDocs(data?.separation ?? [], ["completed", "cancelled", "closed"]),
          },
          {
            label: "Completed",
            value: countByStatus(data?.separation ?? [], ["completed", "closed"]),
          },
          { label: "Attrition (records)", value: data?.separation.length ?? 0 },
        ]}
      />
      <HrTable
        columns={[
          { key: "doc", label: "Document" },
          { key: "emp", label: "Employee" },
          { key: "lwd", label: "Last working day" },
          { key: "status", label: "Status" },
          { key: "fnf", label: "FNF" },
          { key: "actions", label: "Actions" },
        ]}
        emptyTitle="No separations"
        emptyDescription="Exit requests will appear here when created."
        rows={(data?.separation ?? []).map((row) => {
          const id = String(row.id);
          const status = String(row.status ?? "").toLowerCase();
          const fnfStatus = String(row.fnf_status ?? "pending").toLowerCase();
          const busy = actingId === id;
          const canFnf =
            (status === "hr_approved" || status === "manager_approved") &&
            (fnfStatus === "pending" || fnfStatus === "prepared");
          const canSettle = fnfStatus === "calculated" || fnfStatus === "prepared";
          const canComplete =
            status === "hr_approved" &&
            (fnfStatus === "calculated" || fnfStatus === "settled" || fnfStatus === "waived");
          return {
            __key: id,
            doc: String(row.document_number ?? row.id),
            emp: String(row.employee_id ?? "—").slice(0, 8),
            lwd: String(
              row.approved_last_working_date ??
                row.requested_last_working_date ??
                row.last_working_date ??
                row.relieving_date ??
                "—",
            ),
            status: <HrStatusBadge status={String(row.status ?? "—")} />,
            fnf: <HrStatusBadge status={fnfStatus} />,
            actions: (
              <div className="flex flex-wrap gap-1">
                {status === "draft" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 cursor-pointer px-2 text-[0.75rem]"
                    disabled={busy}
                    onClick={() => void runAction(id, "submit", {}, "Submitted")}
                  >
                    Submit
                  </Button>
                ) : null}
                {status === "submitted" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 cursor-pointer px-2 text-[0.75rem]"
                    disabled={busy}
                    onClick={() =>
                      void runAction(id, "approve", { stage: "manager" }, "Reporting manager approved")
                    }
                  >
                    Reporting manager approve
                  </Button>
                ) : null}
                {status === "manager_approved" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 cursor-pointer px-2 text-[0.75rem]"
                    disabled={busy}
                    onClick={() => void runAction(id, "approve", { stage: "hr" }, "HR approved")}
                  >
                    HR Approve
                  </Button>
                ) : null}
                {canFnf ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 cursor-pointer px-2 text-[0.75rem]"
                    disabled={busy}
                    onClick={() => void runAction(id, "fnf/prepare", {}, "FNF prepared")}
                  >
                    Prepare FNF
                  </Button>
                ) : null}
                {canSettle ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 cursor-pointer px-2 text-[0.75rem]"
                    disabled={busy}
                    onClick={() => void runAction(id, "fnf/settle", {}, "FNF settled")}
                  >
                    Settle FNF
                  </Button>
                ) : null}
                {canComplete ? (
                  <Button
                    size="sm"
                    className="h-7 cursor-pointer px-2 text-[0.75rem]"
                    disabled={busy}
                    onClick={() => void runAction(id, "complete", {}, "Completed")}
                  >
                    Complete
                  </Button>
                ) : null}
                {status !== "draft" && status !== "completed" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer px-2 text-[0.75rem]"
                      disabled={busy}
                      onClick={() =>
                        void runAction(
                          id,
                          "checklist",
                          { item_key: "assets", done: true },
                          "Assets cleared",
                        )
                      }
                    >
                      Clear assets
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer px-2 text-[0.75rem]"
                      disabled={busy}
                      onClick={() =>
                        void runAction(
                          id,
                          "checklist",
                          { item_key: "it", done: true },
                          "IT cleared",
                        )
                      }
                    >
                      Clear IT
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer px-2 text-[0.75rem]"
                      disabled={busy}
                      onClick={() =>
                        void runAction(
                          id,
                          "exit-interview",
                          {
                            answers: {
                              reason: "career_growth",
                              recommend: "yes",
                              comments: "Recorded via Separation Hub",
                            },
                            interviewer_notes: "Quick capture from hub",
                          },
                          "Exit interview saved",
                        )
                      }
                    >
                      Exit interview
                    </Button>
                  </>
                ) : null}
              </div>
            ),
          };
        })}
      />
    </div>
  );
}

export function ReportsHub() {
  const { data, loading, load, authBlocked } = useHrData();
  const [exporting, setExporting] = useState<string | null>(null);
  const kpis = useMemo(() => {
    const profiles = data?.profiles ?? [];
    const employment = data?.employment ?? [];
    const leave = data?.leaveRequests ?? [];
    const attendance = data?.attendance ?? [];
    const headcount = profiles.length > 0 ? profiles.length : employment.length;
    const active =
      profiles.length > 0
        ? countByStatus(profiles, ["active"])
        : countByStatus(employment, ["active", "confirmed", "probation"]);
    return [
      { label: "Headcount", value: headcount },
      { label: "Active employees", value: active },
      {
        label: "Pending leave",
        value: countByStatus(leave, ["draft", "submitted"]),
      },
      {
        label: "Absent records",
        value: countByAttendanceStatus(attendance, ["absent"]),
      },
      {
        label: "Open reviews",
        value: countOpenDocs(data?.reviews ?? [], ["closed", "cancelled"]),
      },
      { label: "Exits", value: data?.separation.length ?? 0 },
      { label: "Training programs", value: data?.training.length ?? 0 },
      { label: "Shift assignments", value: data?.shiftAssignments.length ?? 0 },
    ];
  }, [data]);

  const reportTypes = [
    { type: "attendance", label: "Attendance" },
    { type: "leave", label: "Leave" },
    { type: "headcount", label: "Headcount" },
    { type: "late", label: "Late coming" },
    { type: "overtime", label: "Overtime" },
    { type: "probation", label: "Probation" },
    { type: "joining", label: "Joining" },
    { type: "exit", label: "Exit / Attrition" },
  ] as const;

  async function exportCsv(reportType: string) {
    setExporting(reportType);
    try {
      await downloadApiFile(
        "/hr/reports/export",
        { report_type: reportType, fmt: "csv" },
        `${reportType}.csv`,
      );
      toast(`Downloaded ${reportType} CSV`);
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Export failed", "error");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="HR reports & KPIs"
        description="Workforce health snapshot and CSV exports from live HR data."
        actions={<HrToolbar onRefresh={() => void load()} loading={loading} />}
      />
      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !data ? <HrLoadingBlock /> : null}
      <HrKpiGrid items={kpis.map((k) => ({ ...k, value: k.value }))} />
      <HrSection title="Exports" description="Download Excel-friendly CSV (UTF-8 BOM).">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {reportTypes.map((r) => (
            <div
              key={r.type}
              className="flex items-center justify-between gap-2 border border-border px-3 py-2"
            >
              <span className="text-[0.85rem] font-medium">{r.label}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 cursor-pointer px-2.5 text-[0.75rem]"
                disabled={exporting !== null}
                onClick={() => void exportCsv(r.type)}
              >
                {exporting === r.type ? "…" : "Download CSV"}
              </Button>
            </div>
          ))}
        </div>
      </HrSection>
      {!loading && data && data.profiles.length === 0 && data.employment.length === 0 ? (
        <HrEmptyState
          title="No KPI source data yet"
          description="Seed HR demo rows or create profiles, leave, and attendance to populate reports."
        />
      ) : null}
    </div>
  );
}

export function PayrollHubInHr() {
  const [data, setData] = useState<PayrollOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadPayrollOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll"
        description="Payroll cycle snapshot inside HRMS. Full payroll workspace remains under /payroll."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Link href="/payroll" className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted">Open payroll module</Link>
          </HrToolbar>
        }
      />
      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !data ? <HrLoadingBlock /> : null}
      <HrKpiGrid
        items={[
          { label: "Periods", value: data?.periods.length ?? 0 },
          { label: "Runs", value: data?.runs.length ?? 0 },
          { label: "Payslips", value: data?.payslips.length ?? 0 },
          { label: "Loans", value: data?.loans.length ?? 0 },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <HrSetupCard title="Payroll runs" description="Calculation runs" count={data?.runs.length ?? 0} href="/payroll/payroll-runs" />
        <HrSetupCard title="Payslips" description="Employee payslips" count={data?.payslips.length ?? 0} href="/payroll/payslips" />
        <HrSetupCard title="Salary structures" description="CTC structures" count={data?.structures.length ?? 0} href="/payroll/salary-structures" />
      </div>
      <HrTable
        columns={[
          { key: "doc", label: "Run" },
          { key: "status", label: "Status" },
        ]}
        emptyTitle="No payroll runs"
        rows={(data?.runs ?? []).slice(0, 15).map((row) => ({
          __key: String(row.id),
          doc: String(row.document_number ?? row.id),
          status: <HrStatusBadge status={String(row.status ?? "—")} />,
        }))}
      />
    </div>
  );
}

export function RecruitmentHubInHr() {
  const [data, setData] = useState<RecruitmentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadRecruitmentOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recruitment"
        description="Open roles and hiring pipeline inside HRMS."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Link href="/recruitment" className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted">Open recruitment module</Link>
          </HrToolbar>
        }
      />
      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !data ? <HrLoadingBlock /> : null}
      <HrKpiGrid
        items={[
          { label: "Requisitions", value: data?.requisitions.length ?? 0 },
          { label: "Candidates", value: data?.candidates.length ?? 0 },
          { label: "Applications", value: data?.applications.length ?? 0 },
          { label: "Interviews", value: data?.interviews.length ?? 0 },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <HrSetupCard title="Job requisitions" description="Open positions" count={data?.requisitions.length ?? 0} href="/recruitment/job-requisitions" />
        <HrSetupCard title="Candidates" description="Talent pool" count={data?.candidates.length ?? 0} href="/recruitment/candidates" />
        <HrSetupCard title="Offers" description="Offer letters" count={data?.offers.length ?? 0} href="/recruitment/offers" />
      </div>
      <HrTable
        columns={[
          { key: "name", label: "Candidate" },
          { key: "status", label: "Status" },
        ]}
        emptyTitle="No candidates"
        rows={(data?.candidates ?? []).slice(0, 15).map((row) => ({
          __key: String(row.id),
          name: candidateDisplayName(row),
          status: <HrStatusBadge status={String(row.status ?? "—")} />,
        }))}
      />
    </div>
  );
}

export function OnboardingHub() {
  const [data, setData] = useState<RecruitmentOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadRecruitmentOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Onboarding"
        description="Pre-employee handoff and onboarding task tracking."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Link href="/recruitment/onboarding" className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted">Open onboarding list</Link>
          </HrToolbar>
        }
      />
      {loading && !data ? <HrLoadingBlock /> : null}
      <HrKpiGrid
        items={[
          { label: "Onboarding cases", value: data?.onboarding.length ?? 0 },
          { label: "Tasks", value: data?.onboardingTasks.length ?? 0 },
          {
            label: "Open cases",
            value: countOpenDocs(data?.onboarding ?? [], ["completed", "cancelled", "closed"]),
          },
          { label: "Offers", value: data?.offers.length ?? 0 },
        ]}
      />
      <HrTable
        columns={[
          { key: "doc", label: "Case" },
          { key: "status", label: "Status" },
        ]}
        emptyTitle="No onboarding cases"
        emptyDescription="Onboarding records appear after offer acceptance."
        rows={(data?.onboarding ?? []).map((row) => ({
          __key: String(row.id),
          doc: String(row.document_number ?? row.id),
          status: <HrStatusBadge status={String(row.status ?? "—")} />,
        }))}
      />
    </div>
  );
}

