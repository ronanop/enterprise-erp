"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  Plus,
  RefreshCw,
  Repeat,
  Upload,
  UserPlus,
} from "lucide-react";

import { AssignShiftDrawer, CreateRotationDrawer } from "@/components/hr/shift-roster/assign-rotation-drawers";
import { CreateShiftDrawer } from "@/components/hr/shift-roster/create-shift-drawer";
import { RosterCalendarView } from "@/components/hr/shift-roster/roster-calendar-view";
import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
  HrToolbar,
} from "@/components/hr/hr-primitives";
import { SetupDrawer, SetupField, SetupInput, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  approveSwap,
  computeShiftDashboardStats,
  downloadTextFile,
  exportAssignmentsCsv,
  filterAssignments,
  filterShifts,
  listShiftAudit,
  loadShiftRosterDirectory,
  saveWeeklyOffRules,
  shiftUtilizationReport,
  submitShiftSwap,
  type ShiftRosterDirectory,
} from "@/services/shift-roster-service";
import type { ShiftFilters } from "@/types/shift-roster-management";
import { emptyShiftFilters, SHIFT_TYPE_LABELS } from "@/types/shift-roster-management";

const PAGE = 10;

type Tab = "shifts" | "assignments" | "calendar" | "rotations" | "rules" | "reports" | "audit";

export function ShiftRosterManagementPage() {
  const [dir, setDir] = useState<ShiftRosterDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("shifts");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ShiftFilters>(emptyShiftFilters());
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createShiftOpen, setCreateShiftOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [rotationOpen, setRotationOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDir(await loadShiftRosterDirectory());
    } catch {
      toast("Failed to load shift data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => (dir ? computeShiftDashboardStats(dir) : null), [dir]);
  const shiftsFiltered = useMemo(
    () => filterShifts(dir?.shifts ?? [], query, filters),
    [dir, query, filters],
  );
  const assignFiltered = useMemo(
    () => filterAssignments(dir?.assignments ?? [], query, filters),
    [dir, query, filters],
  );

  const shiftPage = shiftsFiltered.slice((page - 1) * PAGE, page * PAGE);
  const assignPage = assignFiltered.slice((page - 1) * PAGE, page * PAGE);

  const audit = useMemo(() => listShiftAudit(), [dir, tab]);
  const utilization = useMemo(() => (dir ? shiftUtilizationReport(dir) : []), [dir]);

  const authBlocked = !isAuthenticated() && !loading && !dir?.shifts.length;

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Shift & Roster"
        description="Manage shifts, rotations, weekly offs, and employee assignments."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button size="sm" className="cursor-pointer" onClick={() => setCreateShiftOpen(true)}>
              <Plus className="size-3.5" />
              Create shift
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setAssignOpen(true)}>
              <UserPlus className="size-3.5" />
              Assign shift
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setRotationOpen(true)}>
              <Repeat className="size-3.5" />
              Create rotation
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                setTab("calendar");
              }}
            >
              <CalendarDays className="size-3.5" />
              Roster calendar
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setImportOpen(true)}>
              <Upload className="size-3.5" />
              Import
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                downloadTextFile(
                  `shift-assignments-${new Date().toISOString().slice(0, 10)}.csv`,
                  exportAssignmentsCsv(assignFiltered),
                  "text/csv",
                );
                toast("Exported CSV", "success");
              }}
            >
              <Download className="size-3.5" />
              Export
            </Button>
            <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => void load()}>
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </HrToolbar>
        }
      />

      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !dir ? <EmsSkeleton /> : null}

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {[
            ["Total shifts", stats.totalShifts],
            ["Active shifts", stats.activeShifts],
            ["Employees assigned", stats.employeesAssigned],
            ["Rotations", stats.rotations],
            ["Night shifts", stats.nightShifts],
            ["Weekly off rules", stats.weeklyOffRules],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-2">
        {(
          [
            ["shifts", "Shift master"],
            ["assignments", "Assignments"],
            ["calendar", "Roster calendar"],
            ["rotations", "Rotations"],
            ["rules", "Rules & swap"],
            ["reports", "Reports"],
            ["audit", "Audit log"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
            onClick={() => {
              setTab(id);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "calendar" && tab !== "audit" && tab !== "reports" ? (
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-sm"
            placeholder="Search shift, employee, code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <SetupSelect
            className="h-9 w-40"
            value={filters.shiftType}
            onChange={(e) => setFilters((f) => ({ ...f, shiftType: e.target.value }))}
          >
            <option value="">All types</option>
            {Object.entries(SHIFT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </SetupSelect>
          <SetupSelect
            className="h-9 w-32"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SetupSelect>
        </div>
      ) : null}

      {tab === "shifts" ? (
        !shiftPage.length ? (
          <HrEmptyState title="No shifts" description="Create shift master records with SHIFT-001 codes." action={
            <Button size="sm" className="cursor-pointer" onClick={() => setCreateShiftOpen(true)}>Create shift</Button>
          } />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <div className="erp-scroll overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="sticky top-0 border-b bg-muted/90 backdrop-blur-sm">
                  <tr className="text-[10px] uppercase text-muted-foreground">
                    <th className="px-2 py-2 text-left">Shift</th>
                    <th className="px-2 py-2">Code</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Timing</th>
                    <th className="px-2 py-2">Grace</th>
                    <th className="px-2 py-2">Night</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftPage.map((s) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: s.extension.color }} />
                          <span className="font-medium">{s.shiftName}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{s.shiftCode}</td>
                      <td className="px-2 py-2 text-xs capitalize">{s.shiftType}</td>
                      <td className="px-2 py-2 text-xs">{s.startTime} – {s.endTime}</td>
                      <td className="px-2 py-2 text-xs">{s.graceMinutes}m</td>
                      <td className="px-2 py-2 text-xs">{s.isOvernight ? "Yes" : "—"}</td>
                      <td className="px-2 py-2"><HrStatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <EmsPagination page={page} pageSize={PAGE} total={shiftsFiltered.length} onPageChange={setPage} />
          </div>
        )
      ) : null}

      {tab === "assignments" ? (
        <>
          {selected.size > 0 ? (
            <div className="flex gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
              <span>{selected.size} selected</span>
              <Button size="sm" variant="outline" className="cursor-pointer h-7" onClick={() => {
                downloadTextFile("selected-assignments.csv", exportAssignmentsCsv(assignFiltered.filter((a) => selected.has(a.id))), "text/csv");
              }}>Export</Button>
            </div>
          ) : null}
          {!assignPage.length ? (
            <HrEmptyState title="No assignments" description="Assign shifts to employees with effective dates." action={
              <Button size="sm" className="cursor-pointer" onClick={() => setAssignOpen(true)}>Assign shift</Button>
            } />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="sticky top-0 border-b bg-muted/90">
                  <tr className="text-[10px] uppercase text-muted-foreground">
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2 text-left">Employee</th>
                    <th className="px-2 py-2">Department</th>
                    <th className="px-2 py-2">Shift</th>
                    <th className="px-2 py-2">From</th>
                    <th className="px-2 py-2">To</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assignPage.map((a) => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-2 py-2">
                        <input type="checkbox" className="cursor-pointer" checked={selected.has(a.id)} onChange={() => {
                          setSelected((prev) => {
                            const n = new Set(prev);
                            if (n.has(a.id)) n.delete(a.id); else n.add(a.id);
                            return n;
                          });
                        }} />
                      </td>
                      <td className="px-2 py-2 text-xs font-medium">{a.employeeName}</td>
                      <td className="px-2 py-2 text-xs">{a.departmentName}</td>
                      <td className="px-2 py-2 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <span className="size-2 rounded-full" style={{ backgroundColor: a.shiftColor }} />
                          {a.shiftName}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs">{a.effectiveFrom}</td>
                      <td className="px-2 py-2 text-xs">{a.effectiveTo || "—"}</td>
                      <td className="px-2 py-2 text-xs capitalize">{a.assignmentType}</td>
                      <td className="px-2 py-2"><HrStatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <EmsPagination page={page} pageSize={PAGE} total={assignFiltered.length} onPageChange={setPage} />
            </div>
          )}
        </>
      ) : null}

      {tab === "calendar" && dir ? <RosterCalendarView directory={dir} onUpdated={() => void load()} /> : null}

      {tab === "rotations" ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          {!dir?.rotations.length ? (
            <HrEmptyState title="No rotations" description="Define weekly / bi-weekly shift cycles." action={
              <Button size="sm" className="cursor-pointer" onClick={() => setRotationOpen(true)}>Create rotation</Button>
            } />
          ) : (
            <ul className="space-y-2 text-sm">
              {dir.rotations.map((r) => (
                <li key={r.id} className="rounded-lg border border-border/60 px-3 py-2">
                  <p className="font-medium">{r.name} <span className="font-mono text-xs text-muted-foreground">{r.code}</span></p>
                  <p className="text-xs text-muted-foreground capitalize">{r.cycle} · {r.sequence.join(" → ")}</p>
                  <p className="text-[10px] text-muted-foreground">{r.employeeIds.length} employees · from {r.effectiveFrom}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "rules" && dir ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold">Weekly off rules</h3>
            {(["sunday", "alternate_saturday", "second_saturday", "rotating", "custom"] as const).map((rule) => (
              <label key={rule} className="flex cursor-pointer items-center gap-2 text-xs capitalize">
                <input
                  type="checkbox"
                  checked={dir.weeklyOffRules.includes(rule)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...dir.weeklyOffRules, rule]
                      : dir.weeklyOffRules.filter((r) => r !== rule);
                    saveWeeklyOffRules(next).then(() => void load());
                  }}
                />
                {rule.replace(/_/g, " ")}
              </label>
            ))}
            <h3 className="text-sm font-semibold pt-2">Holiday rules</h3>
            <p className="text-xs text-muted-foreground">
              {dir.holidays.length} holidays loaded from HR holiday calendars (national / company).
            </p>
            <ul className="max-h-32 overflow-y-auto text-xs text-muted-foreground">
              {dir.holidays.slice(0, 12).map((h) => (
                <li key={h.date + h.name}>{h.date} — {h.name}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Shift swap requests</h3>
              <Button size="sm" variant="outline" className="cursor-pointer h-7" onClick={() => setSwapOpen(true)}>
                Request swap
              </Button>
            </div>
            {dir.swaps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No swap requests.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {dir.swaps.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 px-2 py-1.5">
                    <span>{s.employeeName} · {s.reason.slice(0, 40)}</span>
                    <span className="capitalize text-muted-foreground">{s.workflowStage}</span>
                    {s.workflowStage === "manager" ? (
                      <Button size="sm" className="cursor-pointer h-6 text-[10px]" onClick={() => { void approveSwap(s.id).then(() => void load()); }}>Approve</Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {tab === "reports" && dir ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Shift utilization</h3>
            <table className="mt-3 w-full text-xs">
              <thead><tr className="text-muted-foreground"><th className="py-1 text-left">Shift</th><th>Assigned</th></tr></thead>
              <tbody>
                {utilization.map((u) => (
                  <tr key={u.code} className="border-t border-border/40">
                    <td className="py-1.5">{u.shift}</td>
                    <td className="py-1.5 text-center">{u.assigned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Night shift report</h3>
            <p className="mt-2 text-2xl font-semibold">{stats?.nightShifts ?? 0}</p>
            <p className="text-xs text-muted-foreground">Active night / overnight shift definitions</p>
          </div>
        </div>
      ) : null}

      {tab === "audit" ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b text-muted-foreground"><th className="py-2">Action</th><th>Detail</th><th>Who</th><th>When</th></tr></thead>
            <tbody>
              {audit.slice(0, 40).map((a) => (
                <tr key={a.id} className="border-b border-border/40">
                  <td className="py-2 font-medium">{a.action}</td>
                  <td className="py-2 text-muted-foreground">{a.detail}</td>
                  <td className="py-2">{a.actor}</td>
                  <td className="py-2">{new Date(a.at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <CreateShiftDrawer open={createShiftOpen} directory={dir} onClose={() => setCreateShiftOpen(false)} onSaved={() => void load()} />
      <AssignShiftDrawer open={assignOpen} directory={dir} onClose={() => setAssignOpen(false)} onSaved={() => void load()} />
      <CreateRotationDrawer open={rotationOpen} directory={dir} onClose={() => setRotationOpen(false)} onSaved={() => void load()} />

      <SetupDrawer open={importOpen} title="Import roster" description="Shift assignment or roster Excel/CSV" onClose={() => setImportOpen(false)}>
        <SetupField label="Upload file"><input type="file" accept=".csv,.xlsx" className="text-xs" /></SetupField>
        <Button size="sm" variant="outline" className="cursor-pointer mt-2" onClick={() => toast("Import validation runs on employee+date duplicates", "info")}>Validate import</Button>
      </SetupDrawer>

      <SwapRequestDrawer open={swapOpen} directory={dir} onClose={() => { setSwapOpen(false); void load(); }} />

      <p className="text-[10px] text-muted-foreground">RBAC: hr.shift:* and hr.shift_assignment:* enforced by API.</p>
    </div>
  );
}

function SwapRequestDrawer({
  open,
  onClose,
  directory,
}: {
  open: boolean;
  onClose: () => void;
  directory: ShiftRosterDirectory | null;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [currentShiftId, setCurrentShiftId] = useState("");
  const [requestedShiftId, setRequestedShiftId] = useState("");
  const [swapWith, setSwapWith] = useState("");
  const [reason, setReason] = useState("");

  return (
    <SetupDrawer
      open={open}
      title="Shift swap request"
      onClose={onClose}
      footer={
        <Button size="sm" className="cursor-pointer" onClick={() => {
          const emp = directory?.options.employees.find((e) => e.id === employeeId);
          void submitShiftSwap({
            employeeId,
            employeeName: emp?.label ?? "",
            currentShiftId,
            requestedShiftId,
            swapWithEmployeeId: swapWith,
            reason,
          }).then(() => {
            toast("Swap submitted", "success");
            onClose();
          });
        }}>Submit</Button>
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
        <SetupField label="Current shift">
          <SetupSelect value={currentShiftId} onChange={(e) => setCurrentShiftId(e.target.value)}>
            {directory?.options.shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Requested shift">
          <SetupSelect value={requestedShiftId} onChange={(e) => setRequestedShiftId(e.target.value)}>
            {directory?.options.shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Swap with employee">
          <SetupSelect value={swapWith} onChange={(e) => setSwapWith(e.target.value)}>
            {directory?.options.employees.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Reason">
          <SetupInput value={reason} onChange={(e) => setReason(e.target.value)} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
