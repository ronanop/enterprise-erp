"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  Plus,
  Users,
  X,
} from "lucide-react";

import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
  HrToolbar,
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
  createMeetingRequest,
  createTrainingProgram,
  createTrainingRoom,
  decideMeetingRequest,
  loadTrainingDirectory,
  markTrainingNotificationsRead,
  type TrainingDirectory,
} from "@/services/training-management-service";
import type { TrainingRequest } from "@/types/training-management";

type Tab = "programs" | "rooms" | "requests" | "notifications";

export function TrainingManagementPage() {
  const [dir, setDir] = useState<TrainingDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("programs");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [detail, setDetail] = useState<TrainingRequest | null>(null);

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

  const programs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (dir?.programs ?? []).filter((p) => {
      if (!q) return true;
      return [p.code, p.name, p.hostName, p.roomName, p.status].join(" ").toLowerCase().includes(q);
    });
  }, [dir, query]);

  const rooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (dir?.rooms ?? []).filter((r) => {
      if (!q) return true;
      return [r.code, r.name, r.equipment.join(" "), r.status].join(" ").toLowerCase().includes(q);
    });
  }, [dir, query]);

  const requests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (dir?.requests ?? []).filter((r) => {
      if (!q) return true;
      return [r.code, r.title, r.hostName, r.status, r.requestType].join(" ").toLowerCase().includes(q);
    });
  }, [dir, query]);

  const authBlocked = !isAuthenticated() && !loading && !dir?.programs.length;

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Training / Learning"
        description="Create programs, manage rooms, and approve meeting requests. Attendees are notified on the training day."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button size="sm" className="cursor-pointer" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              Create Training
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setRoomOpen(true)}>
              <Building2 className="size-3.5" />
              Add room
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setRequestOpen(true)}>
              <CalendarDays className="size-3.5" />
              Request Meeting
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
            className="cursor-pointer h-7"
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Programs", dir?.programs.length ?? 0],
          ["Rooms", dir?.rooms.length ?? 0],
          ["Pending requests", (dir?.requests ?? []).filter((r) => r.status === "submitted").length],
          ["Today reminders", unread.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-2">
        {(
          [
            ["programs", "Programs"],
            ["rooms", "Rooms"],
            ["requests", "Meeting Requests"],
            ["notifications", "Notifications"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <Input
        className="max-w-md"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {tab === "programs" ? (
        !programs.length ? (
          <HrEmptyState
            title="No training programs"
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
                  {["Code", "Name", "Date", "Time", "Host", "Room", "Repeat", "Attendees", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => (
                  <tr key={p.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-[10px]">{p.code}</td>
                    <td className="px-3 py-2 text-xs font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-xs">{p.startDate || "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {p.startTime || "—"}
                      {p.endTime ? `–${p.endTime}` : ""}
                    </td>
                    <td className="px-3 py-2 text-xs">{p.hostName}</td>
                    <td className="px-3 py-2 text-xs">{p.roomName}</td>
                    <td className="px-3 py-2 text-xs capitalize">
                      {p.isRecurring ? p.recurrenceRule : "No"}
                    </td>
                    <td className="px-3 py-2 text-xs">{p.attendeeCount}</td>
                    <td className="px-3 py-2">
                      <HrStatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === "rooms" ? (
        !rooms.length ? (
          <HrEmptyState
            title="No rooms"
            description="Add rooms with capacity and equipment for training and meetings."
            action={
              <Button size="sm" className="cursor-pointer" onClick={() => setRoomOpen(true)}>
                Add room
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => (
              <div key={r.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{r.name}</h3>
                    <p className="font-mono text-[10px] text-muted-foreground">{r.code}</p>
                  </div>
                  <HrStatusBadge status={r.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Capacity {r.capacity} ·{" "}
                  {r.equipment.length ? r.equipment.join(", ") : "No equipment listed"}
                </p>
                {r.notes ? <p className="mt-1 text-[11px] text-muted-foreground">{r.notes}</p> : null}
              </div>
            ))}
          </div>
        )
      ) : null}

      {tab === "requests" ? (
        !requests.length ? (
          <HrEmptyState
            title="No meeting requests"
            description="Submit a meeting or training request for approval."
            action={
              <Button size="sm" className="cursor-pointer" onClick={() => setRequestOpen(true)}>
                Request Meeting
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b bg-muted/50 text-[10px] uppercase text-muted-foreground">
                <tr>
                  {["Code", "Title", "Type", "Date", "Host", "Room", "Attendees", "Status", ""].map((h) => (
                    <th key={h || "a"} className="px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-[10px]">{r.code}</td>
                    <td className="px-3 py-2 text-xs font-medium">{r.title}</td>
                    <td className="px-3 py-2 text-xs capitalize">{r.requestType}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.requestDate} {r.startTime || ""}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.hostName}</td>
                    <td className="px-3 py-2 text-xs">{r.roomName}</td>
                    <td className="px-3 py-2 text-xs">{r.attendees.length}</td>
                    <td className="px-3 py-2">
                      <HrStatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="cursor-pointer h-7 text-xs"
                        onClick={() => setDetail(r)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === "notifications" ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Employee Training Notifications</h3>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer h-7"
              onClick={() => {
                markTrainingNotificationsRead();
                void load();
                toast("Marked all as read", "success");
              }}
            >
              Mark all read
            </Button>
          </div>
          {!(dir?.notifications.length) ? (
            <p className="text-xs text-muted-foreground">No notifications yet. Enroll attendees when creating training.</p>
          ) : (
            <ul className="space-y-2">
              {dir!.notifications.slice(0, 50).map((n) => (
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
      <CreateRoomDrawer
        open={roomOpen}
        directory={dir}
        onClose={() => setRoomOpen(false)}
        onSaved={() => void load()}
      />
      <CreateRequestDrawer
        open={requestOpen}
        directory={dir}
        onClose={() => setRequestOpen(false)}
        onSaved={() => void load()}
      />
      <RequestDetailDrawer
        open={Boolean(detail)}
        request={detail}
        onClose={() => setDetail(null)}
        onSaved={() => {
          setDetail(null);
          void load();
        }}
      />
    </div>
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
      description="Name, schedule, host, room, recurrence, and attendees"
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
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Host">
          <SetupSelect value={hostId} onChange={(e) => setHostId(e.target.value)}>
            <option value="">Select host</option>
            {directory?.options.employees.map((e) => (
              <option key={e.id} value={e.id}>{e.label} ({e.code})</option>
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

function CreateRoomDrawer({
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
  const [capacity, setCapacity] = useState("20");
  const [equipment, setEquipment] = useState("Projector, Whiteboard");
  const [notes, setNotes] = useState("");
  const [branchId, setBranchId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setCapacity("20");
    setEquipment("Projector, Whiteboard");
    setNotes("");
    setBranchId(directory?.options.branches[0]?.id ?? "");
    setBusy(false);
  }, [open, directory]);

  return (
    <SetupDrawer
      open={open}
      title="Create Room"
      description="Name, capacity, and equipment"
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
              if (!name.trim()) {
                toast("Room name required", "error");
                return;
              }
              setBusy(true);
              void createTrainingRoom({
                branchId,
                name: name.trim(),
                capacity: Number(capacity) || 10,
                equipment: equipment
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                notes,
              })
                .then(() => {
                  toast("Room created", "success");
                  onSaved();
                  onClose();
                })
                .catch((e) => toast(e instanceof ApiClientError ? e.message : "Failed", "error"))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : "Save room"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SetupField label="Room name" required>
          <SetupInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Conference Hall A" />
        </SetupField>
        <SetupField label="Branch">
          <SetupSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">None</option>
            {directory?.options.branches.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Capacity">
          <SetupInput type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </SetupField>
        <SetupField label="Equipment (comma separated)">
          <SetupInput value={equipment} onChange={(e) => setEquipment(e.target.value)} />
        </SetupField>
        <SetupField label="Notes">
          <SetupTextarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

function CreateRequestDrawer({
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
  const [title, setTitle] = useState("");
  const [requestType, setRequestType] = useState("meeting");
  const [branchId, setBranchId] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [hostId, setHostId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("11:00");
  const [endTime, setEndTime] = useState("12:00");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState("weekly");
  const [agenda, setAgenda] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !directory) return;
    setBranchId(directory.options.branches[0]?.id ?? "");
    setRequestedBy(directory.options.employees[0]?.id ?? "");
    setHostId(directory.options.employees[0]?.id ?? "");
    setRoomId(directory.rooms[0]?.id ?? "");
    setTitle("");
    setSelected([]);
    setBusy(false);
  }, [open, directory]);

  return (
    <SetupDrawer
      open={open}
      title="Request Meeting / Training"
      description="Submit for approval with attendees"
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
              if (!title || !date || !branchId || !requestedBy) {
                toast("Title, date, branch, and requester are required", "error");
                return;
              }
              const host = directory?.options.employees.find((e) => e.id === hostId);
              setBusy(true);
              void createMeetingRequest({
                branchId,
                title,
                requestType,
                requestedByEmployeeId: requestedBy,
                hostEmployeeId: hostId,
                hostName: host?.label ?? "",
                roomId,
                requestDate: date,
                startTime,
                endTime,
                isRecurring,
                recurrenceRule: recurrence,
                agenda,
                attendees: (directory?.options.employees ?? [])
                  .filter((e) => selected.includes(e.id))
                  .map((e) => ({
                    employeeId: e.id,
                    employeeName: e.label,
                    employeeCode: e.code,
                  })),
              })
                .then(() => {
                  toast("Request submitted", "success");
                  onSaved();
                  onClose();
                })
                .catch((e) => toast(e instanceof ApiClientError ? e.message : "Failed", "error"))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Submitting…" : "Submit request"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SetupField label="Title" required>
          <SetupInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </SetupField>
        <SetupField label="Type">
          <SetupSelect value={requestType} onChange={(e) => setRequestType(e.target.value)}>
            <option value="meeting">Meeting</option>
            <option value="training">Training</option>
            <option value="workshop">Workshop</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="Branch" required>
          <SetupSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {directory?.options.branches.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Requested by">
          <SetupSelect value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)}>
            {directory?.options.employees.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Host">
          <SetupSelect value={hostId} onChange={(e) => setHostId(e.target.value)}>
            {directory?.options.employees.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Room">
          <SetupSelect value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">None</option>
            {directory?.rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Date" required>
          <SetupInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
        <SetupField label="Start time">
          <SetupInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </SetupField>
        <SetupField label="End time">
          <SetupInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </SetupField>
        <div className="sm:col-span-2">
          <SetupField label="Agenda">
            <SetupTextarea value={agenda} onChange={(e) => setAgenda(e.target.value)} />
          </SetupField>
        </div>
        <div className="sm:col-span-2">
          <SetupField label="Attendees">
            <div className="max-h-36 space-y-1 overflow-auto rounded-lg border border-border/60 p-2">
              {(directory?.options.employees ?? []).map((e) => {
                const on = selected.includes(e.id);
                return (
                  <label key={e.id} className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setSelected((prev) => (on ? prev.filter((id) => id !== e.id) : [...prev, e.id]))
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

function RequestDetailDrawer({
  open,
  request,
  onClose,
  onSaved,
}: {
  open: boolean;
  request: TrainingRequest | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNotes("");
    setBusy(false);
  }, [open, request]);

  if (!request) return null;

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    try {
      await decideMeetingRequest(request!.id, action, notes);
      toast(action === "approve" ? "Request approved" : "Request rejected", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Action failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      title={`${request.code} · ${request.title}`}
      description="Meeting request details and attendees"
      wide
      onClose={onClose}
      footer={
        request.status === "submitted" || request.status === "draft" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="cursor-pointer"
              disabled={busy}
              onClick={() => void decide("approve")}
            >
              <Check className="size-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="cursor-pointer"
              disabled={busy}
              onClick={() => void decide("reject")}
            >
              <X className="size-3.5" />
              Reject
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="cursor-pointer" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          <span className="text-muted-foreground">Type:</span> {request.requestType} ·{" "}
          <HrStatusBadge status={request.status} />
        </p>
        <p>
          <span className="text-muted-foreground">When:</span> {request.requestDate}{" "}
          {request.startTime || "—"}–{request.endTime || "—"}
          {request.isRecurring ? ` · repeats ${request.recurrenceRule}` : ""}
        </p>
        <p>
          <span className="text-muted-foreground">Host:</span> {request.hostName}
        </p>
        <p>
          <span className="text-muted-foreground">Room:</span> {request.roomName}
        </p>
        <p>
          <span className="text-muted-foreground">Agenda:</span> {request.agenda || "—"}
        </p>
        <div>
          <h4 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
            <Users className="size-3.5" />
            Attendees ({request.attendees.length})
          </h4>
          <ul className="space-y-1 text-xs">
            {request.attendees.map((a) => (
              <li key={a.employeeId} className="rounded border border-border/50 px-2 py-1.5">
                {a.employeeName}{" "}
                <span className="font-mono text-[10px] text-muted-foreground">{a.employeeCode}</span>
              </li>
            ))}
            {!request.attendees.length ? (
              <li className="text-muted-foreground">No attendees listed</li>
            ) : null}
          </ul>
        </div>
        {(request.status === "submitted" || request.status === "draft") && (
          <SetupField label="Approval notes">
            <SetupTextarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </SetupField>
        )}
        {request.approvalNotes ? (
          <p className="text-xs text-muted-foreground">Decision notes: {request.approvalNotes}</p>
        ) : null}
      </div>
    </SetupDrawer>
  );
}
