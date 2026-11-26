"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, GraduationCap, Pencil, Plus, Search, Trash2 } from "lucide-react";

import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
  HrToolbar,
  HrUnderlineTabs,
  type HrTabItem,
} from "@/components/hr/hr-primitives";
import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ApiClientError, formatApiError } from "@/services/api-client";
import {
  createTrainingProgram,
  deleteTrainingProgram,
  loadTrainingDirectory,
  markTrainingNotificationsRead,
  updateTrainingProgram,
  type TrainingDirectory,
} from "@/services/training-management-service";
import type { TrainingProgram } from "@/types/training-management";

type Tab = "training" | "notifications";

const TRAINING_TABS: HrTabItem[] = [
  { id: "training", label: "Training", icon: GraduationCap },
  { id: "notifications", label: "Notifications", icon: Bell },
];

export function TrainingManagementPage() {
  const [dir, setDir] = useState<TrainingDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("training");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingProgram | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TrainingProgram | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDir(await loadTrainingDirectory());
    } catch {
      toast("Couldn't load training data. Refresh the page.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const unread = (dir?.notifications ?? []).filter((n) => !n.read && n.date === today);
  const programs = dir?.programs ?? [];
  const q = query.trim().toLowerCase();

  const statusOptions = useMemo(() => {
    const fromData = [...new Set(programs.map((p) => p.status.trim()).filter(Boolean))];
    const defaults = ["planned", "in_progress", "completed", "cancelled"];
    return [...new Set([...defaults, ...fromData])];
  }, [programs]);

  const filtered = useMemo(() => {
    return programs.filter((p) => {
      if (q) {
        const hay = [p.name, p.startDate, p.startTime, p.endTime, p.hostName, p.roomName, p.status, String(p.attendeeCount)]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter && p.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (timeFilter) {
        const start = (p.startTime || "").slice(0, 5);
        if (start !== timeFilter) return false;
      }
      return true;
    });
  }, [programs, q, statusFilter, timeFilter]);

  const filteredNotifications = useMemo(() => {
    const items = dir?.notifications ?? [];
    return items.filter((n) => {
      if (q) {
        const hay = [n.employeeName, n.trainingName, n.message, n.date, n.time].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (timeFilter) {
        const t = (n.time || "").slice(0, 5);
        if (t !== timeFilter) return false;
      }
      return true;
    });
  }, [dir, q, timeFilter]);

  const authBlocked = !isAuthenticated() && !loading && !dir?.programs.length;

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Training"
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button
              size="sm"
              className="cursor-pointer"
              onClick={() => {
                setEditing(null);
                setDrawerOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              Create Training
            </Button>
          </HrToolbar>
        }
      />

      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !dir ? <EmsSkeleton /> : null}

      {unread.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
          <p className="flex items-center gap-2">
            <Bell className="size-3.5" />
            {unread.length} training reminder{unread.length === 1 ? "" : "s"} for today.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 cursor-pointer"
            onClick={() => {
              markTrainingNotificationsRead(unread.map((n) => n.id));
              setTab("notifications");
              void load();
            }}
          >
            View notifications
          </Button>
        </div>
      ) : null}

      <HrUnderlineTabs
        tabs={TRAINING_TABS.map((t) =>
          t.id === "notifications" ? { ...t, badge: unread.length || undefined } : t,
        )}
        value={tab}
        onChange={(id) => setTab(id as Tab)}
        trailing={
          <>
            <div className="relative min-w-[180px] flex-1 sm:w-56 sm:flex-none">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-8"
                placeholder={tab === "notifications" ? "Filter notifications…" : "Filter training…"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {tab === "training" ? (
              <SetupSelect
                aria-label="Filter by status"
                className={cn("h-8 w-[150px]", statusFilter && "border-primary/40 bg-primary/5")}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </SetupSelect>
            ) : null}
            <Input
              type="time"
              aria-label="Filter by time"
              className={cn("h-8 w-[130px]", timeFilter && "border-primary/40 bg-primary/5")}
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            />
          </>
        }
      />

      {tab === "training" ? (
        !programs.length ? (
          <HrEmptyState
            title="No training sessions"
            description="Create a training with date, time, host, room, and attendees."
            action={
              <Button
                size="sm"
                className="cursor-pointer"
                onClick={() => {
                  setEditing(null);
                  setDrawerOpen(true);
                }}
              >
                Create Training
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b bg-muted/50 text-[10px] uppercase text-muted-foreground">
                <tr>
                  {["Name", "Date", "Time", "Host", "Room", "Attendees", "Status", "Actions"].map((h) => (
                    <th key={h} className={cn("px-3 py-2 font-medium", h === "Actions" && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((p) => (
                    <TrainingRow
                      key={p.id}
                      program={p}
                      onEdit={() => {
                        setEditing(p);
                        setDrawerOpen(true);
                      }}
                      onDelete={() => setConfirmDelete(p)}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      No training matches the filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === "notifications" ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Upcoming training notifications</h3>
            <Button
              size="sm"
              variant="outline"
              className="h-7 cursor-pointer"
              onClick={() => {
                markTrainingNotificationsRead();
                void load();
                toast("Marked all as read", "success");
              }}
            >
              Mark all read
            </Button>
          </div>
          {!dir?.notifications.length ? (
            <p className="text-xs text-muted-foreground">
              No notifications yet. Enroll attendees when creating a training — they also get an email.
            </p>
          ) : !filteredNotifications.length ? (
            <p className="text-xs text-muted-foreground">No notifications match the filter.</p>
          ) : (
            <ul className="space-y-2">
              {filteredNotifications.slice(0, 50).map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "rounded-lg border border-border/60 px-3 py-2 text-xs",
                    !n.read && n.date === today && "border-amber-200 bg-amber-50/60",
                  )}
                >
                  <p className="font-medium">
                    {n.employeeName} · {n.trainingName}
                  </p>
                  <p className="text-muted-foreground">{n.message}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {n.date}
                    {n.time ? ` ${n.time}` : ""} · {n.read ? "Read" : "Unread"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <TrainingFormDrawer
        open={drawerOpen}
        program={editing}
        directory={dir}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        onSaved={() => void load()}
      />

      <SetupConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete training"
        message={
          confirmDelete
            ? `Remove “${confirmDelete.name}”? Attendees will be unenrolled.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          setDeleting(true);
          void deleteTrainingProgram(confirmDelete.id)
            .then(() => {
              toast("Training deleted", "success");
              setConfirmDelete(null);
              void load();
            })
            .catch((e) => toast(formatApiError(e, "Couldn't delete. Try again."), "error"))
            .finally(() => setDeleting(false));
        }}
      />
    </div>
  );
}

function TrainingRow({
  program: p,
  onEdit,
  onDelete,
}: {
  program: TrainingProgram;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-border/40 hover:bg-muted/30">
      <td className="px-3 py-2 text-xs font-medium">{p.name}</td>
      <td className="px-3 py-2 text-xs">{p.startDate || "-"}</td>
      <td className="px-3 py-2 text-xs">
        {p.startTime || "-"}
        {p.endTime ? `-${p.endTime}` : ""}
      </td>
      <td className="px-3 py-2 text-xs">{p.hostName || "-"}</td>
      <td className="px-3 py-2 text-xs">{p.roomName || "-"}</td>
      <td className="px-3 py-2 text-xs">{p.attendeeCount}</td>
      <td className="px-3 py-2">
        <HrStatusBadge status={p.status} />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
            aria-label={`Edit ${p.name}`}
            title="Edit"
            onClick={onEdit}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-destructive"
            aria-label={`Delete ${p.name}`}
            title="Delete"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function TrainingFormDrawer({
  open,
  program,
  directory,
  onClose,
  onSaved,
}: {
  open: boolean;
  program: TrainingProgram | null;
  directory: TrainingDirectory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(program);
  const [name, setName] = useState("");
  const [type, setType] = useState("technical");
  const [branchId, setBranchId] = useState("");
  const [hostId, setHostId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [roomId, setRoomId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState("weekly");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("planned");
  const [selected, setSelected] = useState<string[]>([]);
  const [attendeeQuery, setAttendeeQuery] = useState("");
  const [departmentPick, setDepartmentPick] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !directory) return;
    if (program) {
      setName(program.name);
      setType(program.type || "technical");
      setBranchId(program.branchId || directory.options.branches[0]?.id || "");
      setHostId(program.hostEmployeeId);
      setStartDate(program.startDate);
      setEndDate(program.endDate && program.endDate !== program.startDate ? program.endDate : "");
      setStartTime(program.startTime || "10:00");
      setEndTime(program.endTime || "12:00");
      setRoomId(program.roomId === "—" ? "" : program.roomId);
      setIsRecurring(program.isRecurring);
      setRecurrence(
        program.recurrenceRule && program.recurrenceRule !== "none" ? program.recurrenceRule : "weekly",
      );
      setNotes(program.notes);
      setStatus(program.status || "planned");
      setSelected(program.attendeeIds);
    } else {
      setBranchId(directory.options.branches[0]?.id ?? "");
      setHostId(directory.options.employees[0]?.id ?? "");
      setRoomId(directory.rooms[0]?.id ?? "");
      setName("");
      setType("technical");
      setStartDate("");
      setEndDate("");
      setStartTime("10:00");
      setEndTime("12:00");
      setIsRecurring(false);
      setRecurrence("weekly");
      setNotes("");
      setStatus("planned");
      setSelected([]);
    }
    setAttendeeQuery("");
    setDepartmentPick("");
    setBusy(false);
  }, [open, directory, program]);

  const employees = directory?.options.employees ?? [];
  const departments = useMemo(() => {
    const fromOptions = directory?.options.departments ?? [];
    if (fromOptions.length) {
      return [...fromOptions].sort((a, b) => a.label.localeCompare(b.label));
    }
    const map = new Map<string, { id: string; label: string; branchId: string }>();
    for (const e of employees) {
      if (!e.departmentId) continue;
      if (!map.has(e.departmentId)) {
        map.set(e.departmentId, {
          id: e.departmentId,
          label: e.departmentName || "Department",
          branchId: e.branchId,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [directory?.options.departments, employees]);

  const attendeeQ = attendeeQuery.trim().toLowerCase();
  const visibleEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (!attendeeQ) return true;
      return (
        e.label.toLowerCase().includes(attendeeQ) ||
        e.code.toLowerCase().includes(attendeeQ) ||
        e.departmentName.toLowerCase().includes(attendeeQ)
      );
    });
  }, [employees, attendeeQ]);

  const allVisibleSelected =
    visibleEmployees.length > 0 && visibleEmployees.every((e) => selected.includes(e.id));

  function selectAllEmployees() {
    setSelected(employees.map((e) => e.id));
  }

  function clearAttendees() {
    setSelected([]);
  }

  function toggleVisibleAll() {
    if (allVisibleSelected) {
      const drop = new Set(visibleEmployees.map((e) => e.id));
      setSelected((prev) => prev.filter((id) => !drop.has(id)));
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of visibleEmployees) next.add(e.id);
      return [...next];
    });
  }

  function addDepartment(departmentId: string) {
    if (!departmentId) return;
    const ids = employees.filter((e) => e.departmentId === departmentId).map((e) => e.id);
    if (!ids.length) {
      toast("No employees in that department", "error");
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return [...next];
    });
    const label = departments.find((d) => d.id === departmentId)?.label ?? "Department";
    toast(`Added ${ids.length} from ${label}`);
  }

  const host = employees.find((e) => e.id === hostId);

  return (
    <SetupDrawer
      open={open}
      title={isEdit ? "Edit Training" : "Create Training"}
      description="Name, schedule, host, room, and attendees"
      wide
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
            disabled={busy}
            onClick={() => {
              if (!name || !startDate) {
                toast("Name and date are required", "error");
                return;
              }
              const payload = {
                branchId,
                name,
                type,
                hostEmployeeId: hostId,
                hostName: host?.label ?? "",
                startDate,
                endDate: endDate || startDate,
                startTime,
                endTime,
                roomId,
                isRecurring,
                recurrenceRule: recurrence,
                notes,
                status,
                employeeIds: selected,
                employeeLabels: (directory?.options.employees ?? [])
                  .filter((e) => selected.includes(e.id))
                  .map((e) => ({ id: e.id, label: e.label })),
              };
              setBusy(true);
              const save = program
                ? updateTrainingProgram(program.id, payload)
                : createTrainingProgram(payload);
              void save
                .then(() => {
                  toast(
                    program
                      ? "Training updated"
                      : selected.length
                        ? `Training created — enrollment email sent to ${selected.length} attendee${selected.length === 1 ? "" : "s"}`
                        : "Training created",
                    "success",
                  );
                  onSaved();
                  onClose();
                })
                .catch((e) =>
                  toast(formatApiError(e, program ? "Couldn't update. Try again." : "Couldn't create. Try again."), "error"),
                )
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : isEdit ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SetupField label="Training name" required>
          <SetupInput value={name} onChange={(e) => setName(e.target.value)} />
        </SetupField>
        <SetupField label="Type">
          <SetupSelect value={type} onChange={(e) => setType(e.target.value)}>
            <option value="technical">Technical</option>
            <option value="compliance">Compliance</option>
            <option value="soft_skills">Soft skills</option>
            <option value="leadership">Leadership</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="Branch">
          <SetupSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {directory?.options.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Host">
          <SetupSelect value={hostId} onChange={(e) => setHostId(e.target.value)}>
            <option value="">Select host</option>
            {directory?.options.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label} ({e.code})
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Date" required>
          <SetupInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </SetupField>
        <SetupField label="End date">
          <SetupInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </SetupField>
        <SetupField label="Start time">
          <SetupInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </SetupField>
        <SetupField label="End time">
          <SetupInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </SetupField>
        <SetupField label="Room">
          <SetupSelect value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">No room</option>
            {directory?.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} (cap {r.capacity})
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Repeat">
          <SetupSelect
            value={isRecurring ? recurrence : "none"}
            onChange={(e) => {
              const v = e.target.value;
              setIsRecurring(v !== "none");
              if (v !== "none") setRecurrence(v);
            }}
          >
            <option value="none">One-time</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </SetupSelect>
        </SetupField>
        {isEdit ? (
          <SetupField label="Status">
            <SetupSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="planned">Planned</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </SetupSelect>
          </SetupField>
        ) : null}
        <div className="sm:col-span-2">
          <SetupField label="Notes">
            <SetupTextarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </SetupField>
        </div>
        <div className="sm:col-span-2">
          <SetupField label="Attendees (notified on training day)">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 cursor-pointer px-2.5 text-xs transition-colors duration-200"
                  onClick={selectAllEmployees}
                  disabled={!employees.length}
                >
                  All employees
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 cursor-pointer px-2.5 text-xs transition-colors duration-200"
                  onClick={clearAttendees}
                  disabled={!selected.length}
                >
                  Clear
                </Button>
                <SetupSelect
                  value={departmentPick}
                  onChange={(e) => setDepartmentPick(e.target.value)}
                  className="h-8 min-w-[10rem] flex-1 text-xs"
                >
                  <option value="">Select department…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </SetupSelect>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 cursor-pointer px-2.5 text-xs transition-colors duration-200"
                  disabled={!departmentPick}
                  onClick={() => {
                    addDepartment(departmentPick);
                    setDepartmentPick("");
                  }}
                >
                  Add department
                </Button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={attendeeQuery}
                  onChange={(e) => setAttendeeQuery(e.target.value)}
                  placeholder="Search employee or department…"
                  className="h-8 cursor-text pl-8 text-xs transition-colors duration-200"
                />
              </div>
              <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-border/60 p-2">
                {visibleEmployees.length ? (
                  <>
                    <label className="flex cursor-pointer items-center gap-2 border-b border-border/50 pb-1.5 text-xs font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleVisibleAll}
                        className="cursor-pointer"
                      />
                      {attendeeQ ? `Select filtered (${visibleEmployees.length})` : "Select all in list"}
                    </label>
                    {visibleEmployees.map((e) => {
                      const on = selected.includes(e.id);
                      return (
                        <label key={e.id} className="flex cursor-pointer items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={on}
                            className="cursor-pointer"
                            onChange={() =>
                              setSelected((prev) =>
                                on ? prev.filter((id) => id !== e.id) : [...prev, e.id],
                              )
                            }
                          />
                          <span className="min-w-0 truncate">
                            {e.label} · {e.code}
                            {e.departmentName ? (
                              <span className="text-muted-foreground"> · {e.departmentName}</span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </>
                ) : (
                  <p className="px-1 py-2 text-xs text-muted-foreground">
                    {employees.length ? "No employees match your search." : "No employees available."}
                  </p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{selected.length} selected</p>
            </div>
          </SetupField>
        </div>
      </div>
    </SetupDrawer>
  );
}
