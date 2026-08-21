"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, GraduationCap, Plus, Search } from "lucide-react";

import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
  HrToolbar,
  HrUnderlineTabs,
  type HrTabItem,
} from "@/components/hr/hr-primitives";
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
import { ApiClientError } from "@/services/api-client";
import {
  createTrainingProgram,
  loadTrainingDirectory,
  markTrainingNotificationsRead,
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
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDir(await loadTrainingDirectory());
    } catch {
      toast("Failed to load training data", "error");
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
            <Button size="sm" className="cursor-pointer" onClick={() => setCreateOpen(true)}>
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
              <Button size="sm" className="cursor-pointer" onClick={() => setCreateOpen(true)}>
                Create Training
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b bg-muted/50 text-[10px] uppercase text-muted-foreground">
                <tr>
                  {["Name", "Date", "Time", "Host", "Room", "Attendees", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((p) => (
                    <TrainingRow key={p.id} program={p} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-xs text-muted-foreground">
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
              No notifications yet. Enroll attendees when creating training.
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

      <CreateTrainingDrawer
        open={createOpen}
        directory={dir}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}

function TrainingRow({ program: p }: { program: TrainingProgram }) {
  return (
    <tr className="border-b border-border/40 hover:bg-muted/30">
      <td className="px-3 py-2 text-xs font-medium">{p.name}</td>
      <td className="px-3 py-2 text-xs">{p.startDate || "—"}</td>
      <td className="px-3 py-2 text-xs">
        {p.startTime || "—"}
        {p.endTime ? `–${p.endTime}` : ""}
      </td>
      <td className="px-3 py-2 text-xs">{p.hostName || "—"}</td>
      <td className="px-3 py-2 text-xs">{p.roomName || "—"}</td>
      <td className="px-3 py-2 text-xs">{p.attendeeCount}</td>
      <td className="px-3 py-2">
        <HrStatusBadge status={p.status} />
      </td>
    </tr>
  );
}

function CreateTrainingDrawer({
  open,
  directory,
  onClose,
  onSaved,
}: {
  open: boolean;
  directory: TrainingDirectory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
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
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !directory) return;
    setBranchId(directory.options.branches[0]?.id ?? "");
    setHostId(directory.options.employees[0]?.id ?? "");
    setRoomId(directory.rooms[0]?.id ?? "");
    setName("");
    setSelected([]);
    setBusy(false);
  }, [open, directory]);

  const host = directory?.options.employees.find((e) => e.id === hostId);

  return (
    <SetupDrawer
      open={open}
      title="Create Training"
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
              setBusy(true);
              void createTrainingProgram({
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
                employeeIds: selected,
                employeeLabels: (directory?.options.employees ?? [])
                  .filter((e) => selected.includes(e.id))
                  .map((e) => ({ id: e.id, label: e.label })),
              })
                .then(() => {
                  toast("Training created — attendees will be notified on the day", "success");
                  onSaved();
                  onClose();
                })
                .catch((e) => toast(e instanceof ApiClientError ? e.message : "Create failed", "error"))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : "Create"}
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
        <div className="sm:col-span-2">
          <SetupField label="Notes">
            <SetupTextarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </SetupField>
        </div>
        <div className="sm:col-span-2">
          <SetupField label="Attendees (notified on training day)">
            <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-border/60 p-2">
              {(directory?.options.employees ?? []).map((e) => {
                const on = selected.includes(e.id);
                return (
                  <label key={e.id} className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setSelected((prev) =>
                          on ? prev.filter((id) => id !== e.id) : [...prev, e.id],
                        )
                      }
                    />
                    {e.label} · {e.code}
                  </label>
                );
              })}
            </div>
          </SetupField>
        </div>
      </div>
    </SetupDrawer>
  );
}
