"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { HrStatusBadge } from "@/components/hr/hr-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { nextCode, type HrSetupTab } from "@/config/hr-setup";
import { ApiClientError, resourceService } from "@/services/api-client";
import { listSetupApi, loadSetupOrgLookups, type SetupRow } from "@/services/hr-setup-service";
import {
  emptyHolidayEntry,
  HOLIDAY_APPLICABLE,
  HOLIDAY_FREQUENCY,
  HOLIDAY_HALF_SESSIONS,
  HOLIDAY_REPEAT,
  HOLIDAY_TYPES,
  parseHolidaysJson,
  serializeHolidays,
  validateHolidayEntry,
  type HolidayEntry,
} from "@/types/holiday-calendar";
import { cn } from "@/lib/utils";

const API = "/hr/holiday-calendars";

type Mode = "create" | "edit" | null;

export function HolidayCalendarPanel({ tab }: { tab: HrSetupTab }) {
  const [rows, setRows] = useState<SetupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [active, setActive] = useState<SetupRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SetupRow | null>(null);

  const [calendarName, setCalendarName] = useState("");
  const [calendarYear, setCalendarYear] = useState(String(new Date().getFullYear()));
  const [calendarCode, setCalendarCode] = useState("");
  const [status, setStatus] = useState("draft");
  const [branchId, setBranchId] = useState("");
  const [holidays, setHolidays] = useState<HolidayEntry[]>([]);
  const [entryDraft, setEntryDraft] = useState<HolidayEntry>(emptyHolidayEntry());
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);

  const [branches, setBranches] = useState<{ value: string; label: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSetupApi(API);
      setRows(
        data.map((r) => ({
          ...r,
          code: r.calendar_code,
          name: r.calendar_name,
          year: r.calendar_year,
          holiday_count: parseHolidaysJson(r.holidays_json).length,
        })),
      );
      const lookups = await loadSetupOrgLookups();
      setBranches(lookups.branches);
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to load calendars", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.code, r.year, r.status]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q)),
    );
  }, [rows, query]);

  function openCreate() {
    const year = new Date().getFullYear();
    const codes = rows.map((r) => String(r.calendar_code ?? r.code ?? ""));
    setActive(null);
    setCalendarName("");
    setCalendarYear(String(year));
    setCalendarCode(nextCode(tab.codePrefix ?? "HOL", codes));
    setStatus("draft");
    setBranchId(branches[0]?.value ?? "");
    setHolidays([]);
    setEntryDraft(emptyHolidayEntry({ date: `${year}-01-01` }));
    setEditingEntryId(null);
    setEntryError(null);
    setMode("create");
  }

  function openEdit(row: SetupRow) {
    setActive(row);
    setCalendarName(String(row.calendar_name ?? row.name ?? ""));
    setCalendarYear(String(row.calendar_year ?? row.year ?? new Date().getFullYear()));
    setCalendarCode(String(row.calendar_code ?? row.code ?? ""));
    setStatus(String(row.status ?? "draft"));
    setBranchId(row.branch_id != null ? String(row.branch_id) : "");
    setHolidays(parseHolidaysJson(row.holidays_json));
    setEntryDraft(emptyHolidayEntry({ date: `${row.calendar_year ?? new Date().getFullYear()}-01-01` }));
    setEditingEntryId(null);
    setEntryError(null);
    setMode("edit");
    setMenuId(null);
  }

  function resetEntryDraft() {
    const year = Number(calendarYear) || new Date().getFullYear();
    setEntryDraft(emptyHolidayEntry({ date: `${year}-01-01` }));
    setEditingEntryId(null);
    setEntryError(null);
  }

  function startEditEntry(entry: HolidayEntry) {
    setEntryDraft({ ...entry });
    setEditingEntryId(entry.id);
    setEntryError(null);
  }

  function toggleApplicable(scope: (typeof HOLIDAY_APPLICABLE)[number]["value"]) {
    setEntryDraft((prev) => {
      let next = [...prev.applicable_to];
      if (scope === "all") {
        return { ...prev, applicable_to: ["all"] };
      }
      next = next.filter((s) => s !== "all");
      if (next.includes(scope)) next = next.filter((s) => s !== scope);
      else next.push(scope);
      if (!next.length) next = ["all"];
      return { ...prev, applicable_to: next };
    });
  }

  function addOrUpdateEntry() {
    const draft = {
      ...entryDraft,
      title: entryDraft.title.trim(),
      name: entryDraft.title.trim(),
      kind: entryDraft.holiday_type === "optional" ? ("optional" as const) : ("mandatory" as const),
      frequency:
        entryDraft.repeat === "never"
          ? null
          : entryDraft.frequency ||
            (entryDraft.repeat === "every_year"
              ? "yearly"
              : entryDraft.repeat === "monthly"
                ? "monthly"
                : "weekly"),
      half_day_session: entryDraft.half_day ? entryDraft.half_day_session || "morning" : null,
    };
    const err = validateHolidayEntry(draft);
    if (err) {
      setEntryError(err);
      return;
    }
    setEntryError(null);
    setHolidays((list) => {
      if (editingEntryId) {
        return list.map((h) => (h.id === editingEntryId ? { ...draft, id: editingEntryId } : h));
      }
      return [...list, { ...draft, id: draft.id || crypto.randomUUID() }];
    });
    resetEntryDraft();
    toast(editingEntryId ? "Holiday updated in list" : "Holiday added to list", "success");
  }

  function removeEntry(id: string) {
    setHolidays((list) => list.filter((h) => h.id !== id));
    if (editingEntryId === id) resetEntryDraft();
  }

  async function saveCalendar() {
    if (!calendarName.trim()) {
      toast("Holiday / Calendar Name is required", "error");
      return;
    }
    const year = Number(calendarYear);
    if (!year || year < 2000 || year > 2100) {
      toast("Enter a valid calendar year", "error");
      return;
    }
    if (!holidays.length) {
      toast("Add at least one holiday (title + date)", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        calendar_code: calendarCode,
        calendar_name: calendarName.trim(),
        calendar_year: year,
        branch_id: branchId || null,
        status: status || "draft",
        holidays_json: serializeHolidays(holidays),
      };
      if (mode === "create") {
        await resourceService.create(API, payload);
        toast("Holiday calendar created");
      } else if (active) {
        await resourceService.update(API, String(active.id), {
          calendar_name: payload.calendar_name,
          holidays_json: payload.holidays_json,
          status: payload.status,
          version: active.version ? Number(active.version) : undefined,
        });
        toast("Holiday calendar updated");
      }
      setMode(null);
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function setCalendarStatus(row: SetupRow, next: "published" | "archived" | "draft") {
    try {
      if (next === "published") {
        await resourceService.action(API, String(row.id), "publish");
      } else if (next === "archived") {
        await resourceService.action(API, String(row.id), "archive");
      } else {
        await resourceService.update(API, String(row.id), {
          status: next,
          version: row.version ? Number(row.version) : undefined,
        });
      }
      toast(`Calendar ${next}`);
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Status update failed", "error");
    }
  }

  async function deleteCalendar(row: SetupRow) {
    try {
      await resourceService.delete(API, String(row.id));
      toast("Calendar deleted");
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Delete failed", "error");
    }
  }

  const showFrequency = entryDraft.repeat !== "never";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">{tab.title}</h2>
            <Badge variant="secondary" className="text-[10px] uppercase">
              Live API
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Define holidays with title, date, type, repeat, and applicability — used by leave, ESS, and Comp Off.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button type="button" size="sm" className="cursor-pointer" onClick={openCreate}>
            <Plus className="size-3.5" />
            Add Calendar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["TOTAL", filtered.length],
          ["PUBLISHED", filtered.filter((r) => r.status === "published").length],
          ["DRAFT", filtered.filter((r) => r.status === "draft").length],
          [
            "HOLIDAYS",
            filtered.reduce((s, r) => s + Number(r.holiday_count ?? 0), 0),
          ],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search calendars…"
          className="h-8 max-w-xs"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-card/50 px-6 py-12 text-center">
          <CalendarDays className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No holiday calendars</p>
          <p className="mt-1 text-xs text-muted-foreground">Create a year calendar and add holiday entries.</p>
          <Button type="button" size="sm" className="mt-4 cursor-pointer" onClick={openCreate}>
            <Plus className="size-3.5" />
            Add Calendar
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border/70 bg-muted/40">
              <tr>
                {["Calendar", "Code", "Year", "Holidays", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={String(row.id)} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-medium">{String(row.name)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{String(row.code)}</td>
                  <td className="px-3 py-2.5">{String(row.year)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{String(row.holiday_count ?? 0)}</td>
                  <td className="px-3 py-2.5">
                    <HrStatusBadge status={String(row.status)} />
                  </td>
                  <td className="px-3 py-2">
                    <RowActionsMenu
                      open={menuId === String(row.id)}
                      onOpenChange={(open) => setMenuId(open ? String(row.id) : null)}
                      buttonSize="icon-xs"
                    >
                      <RowActionsItem onClick={() => openEdit(row)}>
                        <Pencil className="size-3.5 text-muted-foreground" />
                        Edit
                      </RowActionsItem>
                      {row.status !== "published" ? (
                        <RowActionsItem onClick={() => void setCalendarStatus(row, "published")}>
                          Publish
                        </RowActionsItem>
                      ) : null}
                      {row.status === "published" ? (
                        <RowActionsItem onClick={() => void setCalendarStatus(row, "archived")}>
                          Archive
                        </RowActionsItem>
                      ) : null}
                      <RowActionsItem destructive onClick={() => setConfirmDelete(row)}>
                        <Trash2 className="size-3.5" />
                        Delete
                      </RowActionsItem>
                    </RowActionsMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SetupDrawer
        open={mode === "create" || mode === "edit"}
        title={mode === "create" ? "Add Holiday Calendar" : "Edit Holiday Calendar"}
        description="Add each holiday with title, date, type, and optional repeat / half-day rules."
        wide
        onClose={() => setMode(null)}
        footer={
          <>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              disabled={saving}
              onClick={() => void saveCalendar()}
            >
              {saving ? "Saving…" : "Save calendar"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <SetupField label="Holiday / Calendar Name" required>
              <SetupInput
                value={calendarName}
                onChange={(e) => setCalendarName(e.target.value)}
                placeholder="India National Holidays 2026"
              />
            </SetupField>
            <SetupField label="Code" required hint="Auto-generated">
              <SetupInput value={calendarCode} readOnly />
            </SetupField>
            <SetupField label="Year" required>
              <SetupInput
                type="number"
                value={calendarYear}
                onChange={(e) => setCalendarYear(e.target.value)}
              />
            </SetupField>
            <SetupField label="Status">
              <SetupSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </SetupSelect>
            </SetupField>
            <div className="sm:col-span-2">
              <SetupField label="Branch" hint="Optional — leave blank for company-wide">
                <SetupSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">All branches</option>
                  {branches.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </SetupSelect>
              </SetupField>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {editingEntryId ? "Edit holiday entry" : "Add holiday"}
              </h3>
              {editingEntryId ? (
                <Button type="button" size="xs" variant="outline" className="cursor-pointer" onClick={resetEntryDraft}>
                  Cancel edit
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SetupField label="Holiday Title" required>
                <SetupInput
                  value={entryDraft.title}
                  onChange={(e) => setEntryDraft((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Christmas Day"
                />
              </SetupField>
              <SetupField label="Holiday Date" required>
                <SetupInput
                  type="date"
                  value={entryDraft.date}
                  onChange={(e) => setEntryDraft((p) => ({ ...p, date: e.target.value }))}
                />
              </SetupField>
              <SetupField label="Holiday Type" required>
                <SetupSelect
                  value={entryDraft.holiday_type}
                  onChange={(e) =>
                    setEntryDraft((p) => ({
                      ...p,
                      holiday_type: e.target.value as HolidayEntry["holiday_type"],
                    }))
                  }
                >
                  {HOLIDAY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Repeat">
                <SetupSelect
                  value={entryDraft.repeat}
                  onChange={(e) => {
                    const repeat = e.target.value as HolidayEntry["repeat"];
                    setEntryDraft((p) => ({
                      ...p,
                      repeat,
                      frequency:
                        repeat === "never"
                          ? null
                          : p.frequency ||
                            (repeat === "every_year"
                              ? "yearly"
                              : repeat === "monthly"
                                ? "monthly"
                                : "weekly"),
                    }));
                  }}
                >
                  {HOLIDAY_REPEAT.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </SetupSelect>
              </SetupField>
              {showFrequency ? (
                <SetupField label="Frequency" hint="Shown because Repeat is enabled">
                  <SetupSelect
                    value={entryDraft.frequency ?? "yearly"}
                    onChange={(e) =>
                      setEntryDraft((p) => ({
                        ...p,
                        frequency: e.target.value as NonNullable<HolidayEntry["frequency"]>,
                      }))
                    }
                  >
                    {HOLIDAY_FREQUENCY.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </SetupSelect>
                </SetupField>
              ) : null}
              <SetupField label="Half Day">
                <label className="flex h-8 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={entryDraft.half_day}
                    onChange={(e) =>
                      setEntryDraft((p) => ({
                        ...p,
                        half_day: e.target.checked,
                        half_day_session: e.target.checked ? p.half_day_session || "morning" : null,
                      }))
                    }
                  />
                  Enabled
                </label>
              </SetupField>
              {entryDraft.half_day ? (
                <SetupField label="Half Day Session" required>
                  <SetupSelect
                    value={entryDraft.half_day_session ?? "morning"}
                    onChange={(e) =>
                      setEntryDraft((p) => ({
                        ...p,
                        half_day_session: e.target.value as NonNullable<HolidayEntry["half_day_session"]>,
                      }))
                    }
                  >
                    {HOLIDAY_HALF_SESSIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </SetupSelect>
                </SetupField>
              ) : null}
              <div className="sm:col-span-2">
                <SetupField label="Applicable To" hint="Optional multi-select">
                  <div className="flex flex-wrap gap-3 pt-1">
                    {HOLIDAY_APPLICABLE.map((a) => (
                      <label key={a.value} className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          className="cursor-pointer"
                          checked={entryDraft.applicable_to.includes(a.value)}
                          onChange={() => toggleApplicable(a.value)}
                        />
                        {a.label}
                      </label>
                    ))}
                  </div>
                </SetupField>
              </div>
              <div className="sm:col-span-2">
                <SetupField label="Remarks">
                  <SetupTextarea
                    rows={2}
                    value={entryDraft.remarks}
                    onChange={(e) => setEntryDraft((p) => ({ ...p, remarks: e.target.value }))}
                    placeholder="Additional information"
                  />
                </SetupField>
              </div>
            </div>

            {entryError ? (
              <p className="mt-2 text-xs text-destructive">{entryError}</p>
            ) : null}

            <div className="mt-3 flex justify-end">
              <Button type="button" size="sm" className="cursor-pointer" onClick={addOrUpdateEntry}>
                <Plus className="size-3.5" />
                {editingEntryId ? "Update holiday" : "Add holiday"}
              </Button>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Holidays in this calendar ({holidays.length})
            </h3>
            {holidays.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
                No holidays yet. Fill the form above and click Add holiday.
              </p>
            ) : (
              <ul className="space-y-2">
                {holidays
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((h) => (
                    <li
                      key={h.id}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{h.title || h.name}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          {h.date}
                          {h.half_day ? ` · Half day (${h.half_day_session})` : ""} ·{" "}
                          {HOLIDAY_TYPES.find((t) => t.value === h.holiday_type)?.label ?? h.holiday_type}
                          {h.repeat !== "never"
                            ? ` · Repeat ${HOLIDAY_REPEAT.find((r) => r.value === h.repeat)?.label}`
                            : ""}
                        </p>
                        {h.remarks ? <p className="mt-0.5 text-muted-foreground">{h.remarks}</p> : null}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="cursor-pointer"
                          onClick={() => startEditEntry(h)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="cursor-pointer text-destructive"
                          onClick={() => removeEntry(h.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </SetupDrawer>

      <SetupConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete holiday calendar"
        message="This soft-deletes the calendar. Leave/ESS will stop using its holidays after refresh."
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) void deleteCalendar(confirmDelete);
        }}
      />
    </div>
  );
}
