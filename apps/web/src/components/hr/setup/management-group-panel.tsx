"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { nextCode, type HrSetupTab } from "@/config/hr-setup";
import { ApiClientError, resourceService } from "@/services/api-client";
import {
  createManagementGroup,
  deleteManagementGroup,
  loadManagementGroupCatalog,
  listManagementGroups,
  updateManagementGroup,
  type FeatureCatalogSection,
  type ManagementGroup,
} from "@/services/management-group-service";
import { cn } from "@/lib/utils";

type Lookup = { id: string; label: string };

type Mode = "create" | "edit" | null;

export function ManagementGroupPanel({ tab }: { tab: HrSetupTab }) {
  const [rows, setRows] = useState<ManagementGroup[]>([]);
  const [catalog, setCatalog] = useState<FeatureCatalogSection[]>([]);
  const [shifts, setShifts] = useState<Lookup[]>([]);
  const [rotations, setRotations] = useState<Lookup[]>([]);
  const [attRules, setAttRules] = useState<Lookup[]>([]);
  const [holidays, setHolidays] = useState<Lookup[]>([]);
  const [weeklyOff, setWeeklyOff] = useState<Lookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [active, setActive] = useState<ManagementGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ManagementGroup | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const [groupCode, setGroupCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [employmentType, setEmploymentType] = useState("permanent");
  const [status, setStatus] = useState("active");
  const [defaultShiftId, setDefaultShiftId] = useState("");
  const [rotationId, setRotationId] = useState("");
  const [attRuleId, setAttRuleId] = useState("");
  const [holidayId, setHolidayId] = useState("");
  const [weeklyOffId, setWeeklyOffId] = useState("");
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  const loadLookups = useCallback(async () => {
    const mapRows = (data: unknown, labelKeys: string[]) => {
      const list = Array.isArray(data) ? data : [];
      return list.map((row) => {
        const r = row as Record<string, unknown>;
        const label =
          labelKeys.map((k) => r[k]).find((v) => v != null && String(v).trim()) ?? r.id;
        return { id: String(r.id), label: String(label) };
      });
    };
    const [shiftRes, rotRes, ruleRes, holRes, offRes] = await Promise.all([
      resourceService.list("/hr/shifts", { page_size: 200 }).catch(() => ({ data: [] })),
      resourceService.list("/hr/shift-rotations", { page_size: 200 }).catch(() => ({ data: [] })),
      resourceService.list("/hr/attendance-rules", { page_size: 200 }).catch(() => ({ data: [] })),
      resourceService.list("/hr/holiday-calendars", { page_size: 200 }).catch(() => ({ data: [] })),
      resourceService.list("/hr/weekly-off-policies", { page_size: 200 }).catch(() => ({ data: [] })),
    ]);
    setShifts(mapRows(shiftRes.data, ["shift_name", "shift_code", "name"]));
    setRotations(mapRows(rotRes.data, ["rotation_name", "rotation_code"]));
    setAttRules(mapRows(ruleRes.data, ["rule_name", "rule_code"]));
    setHolidays(mapRows(holRes.data, ["calendar_name", "name", "calendar_code"]));
    setWeeklyOff(mapRows(offRes.data, ["policy_name", "policy_code"]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [groups, cat] = await Promise.all([
        listManagementGroups(),
        catalog.length ? Promise.resolve(catalog) : loadManagementGroupCatalog(),
      ]);
      setRows(groups);
      if (!catalog.length) setCatalog(cat);
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to load management groups", "error");
    } finally {
      setLoading(false);
    }
  }, [catalog]);

  useEffect(() => {
    void loadLookups();
    void load();
  }, [load, loadLookups]);

  function seedTogglesFromCatalog(existing?: Record<string, boolean>) {
    const base: Record<string, boolean> = { ...existing };
    for (const section of catalog) {
      for (const f of section.features) {
        if (base[f.key] === undefined) base[f.key] = f.default;
      }
    }
    setToggles(base);
  }

  function openCreate() {
    setMode("create");
    setActive(null);
    setGroupCode(nextCode(tab.codePrefix ?? "MG", rows.length + 1));
    setGroupName("");
    setDescription("");
    setEmploymentType("permanent");
    setStatus("active");
    setDefaultShiftId(shifts[0]?.id ?? "");
    setRotationId("");
    setAttRuleId("");
    setHolidayId("");
    setWeeklyOffId("");
    seedTogglesFromCatalog();
  }

  function openEdit(row: ManagementGroup) {
    setMode("edit");
    setActive(row);
    setGroupCode(row.group_code);
    setGroupName(row.group_name);
    setDescription(row.description ?? "");
    setEmploymentType(row.employment_type);
    setStatus(row.status);
    setDefaultShiftId(row.default_shift_id);
    setRotationId(row.default_shift_rotation_id ?? "");
    setAttRuleId(row.default_attendance_rule_id ?? "");
    setHolidayId(row.default_holiday_calendar_id ?? "");
    setWeeklyOffId(row.default_weekly_off_policy_id ?? "");
    seedTogglesFromCatalog(row.feature_toggles_json);
  }

  function setToggle(key: string, on: boolean, parentKey: string | null) {
    setToggles((prev) => {
      const next = { ...prev, [key]: on };
      if (!on) {
        for (const section of catalog) {
          for (const f of section.features) {
            if (f.parent_key === key) next[f.key] = false;
          }
        }
      }
      if (on && parentKey && !prev[parentKey]) {
        next[parentKey] = true;
      }
      return next;
    });
  }

  async function save() {
    if (!groupName.trim() || !groupCode.trim()) {
      toast("Group name and code are required", "error");
      return;
    }
    if (!defaultShiftId) {
      toast("Default attendance shift group is required", "error");
      return;
    }
    const body = {
      group_code: groupCode.trim(),
      group_name: groupName.trim(),
      description: description.trim() || null,
      employment_type: employmentType,
      status,
      default_shift_id: defaultShiftId,
      default_shift_rotation_id: rotationId || null,
      default_attendance_rule_id: attRuleId || null,
      default_holiday_calendar_id: holidayId || null,
      default_weekly_off_policy_id: weeklyOffId || null,
      feature_toggles_json: toggles,
    };
    setSaving(true);
    try {
      if (mode === "edit" && active) {
        const warn =
          (active.employee_count ?? 0) > 0
            ? window.confirm(
                `This group is assigned to ${active.employee_count} employee(s). Saving may change shift and feature access. Continue?`,
              )
            : true;
        if (!warn) return;
        await updateManagementGroup(active.id, { ...body, version: active.version });
        toast("Management group updated", "success");
      } else {
        await createManagementGroup(body);
        toast("Management group created", "success");
      }
      setMode(null);
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.group_name, r.group_code, r.description ?? "", r.employment_type]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Management groups (employment types) control default shifts, calendars, and HRMS feature toggles.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" className="cursor-pointer" onClick={openCreate}>
            <Plus className="size-3.5" />
            Add management group
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search groups…"
          className="h-9 pl-8"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {!filtered.length ? (
          <p className="p-4 text-sm text-muted-foreground">
            {loading ? "Loading…" : "No management groups yet. Add one or ensure at least one shift exists for defaults."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Employment type</th>
                <th className="px-3 py-2">Employees</th>
                <th className="px-3 py-2">Status</th>
                <th className="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">{row.group_name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.group_code}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.employment_type}</td>
                  <td className="px-3 py-2 tabular-nums">{row.employee_count ?? 0}</td>
                  <td className="px-3 py-2">
                    <HrStatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2">
                    <RowActionsMenu
                      open={menuId === row.id}
                      onOpenChange={(o) => setMenuId(o ? row.id : null)}
                    >
                      <RowActionsItem
                        onClick={() => {
                          setMenuId(null);
                          openEdit(row);
                        }}
                      >
                        <Pencil className="size-3.5 text-muted-foreground" />
                        Edit
                      </RowActionsItem>
                      <RowActionsItem
                        destructive
                        onClick={() => {
                          setMenuId(null);
                          setConfirmDelete(row);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </RowActionsItem>
                    </RowActionsMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SetupDrawer
        open={mode !== null}
        wide
        title={mode === "edit" ? "Edit management group" : "Add management group"}
        description="General info, attendance defaults, and feature toggles for this employment type."
        onClose={() => setMode(null)}
        footer={
          <>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button size="sm" className="cursor-pointer" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              General
            </h3>
            <SetupField label="Group name" required>
              <SetupInput value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            </SetupField>
            <SetupField label="Code" required>
              <SetupInput
                value={groupCode}
                readOnly={mode === "edit"}
                onChange={(e) => setGroupCode(e.target.value)}
              />
            </SetupField>
            <SetupField label="Description">
              <SetupTextarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </SetupField>
            <div className="grid gap-3 sm:grid-cols-2">
              <SetupField label="Linked employment type">
                <SetupSelect value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
                  {["permanent", "contract", "intern", "consultant"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Status">
                <SetupSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </SetupSelect>
              </SetupField>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Attendance configuration
            </h3>
            <SetupField label="Default attendance shift group" required hint="Required — auto-assigned to employees">
              <SetupSelect value={defaultShiftId} onChange={(e) => setDefaultShiftId(e.target.value)}>
                <option value="">Select shift…</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
            <SetupField label="Shift rotation (optional)">
              <SetupSelect value={rotationId} onChange={(e) => setRotationId(e.target.value)}>
                <option value="">None</option>
                {rotations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
            <SetupField label="Working calendar (attendance policy)">
              <SetupSelect value={attRuleId} onChange={(e) => setAttRuleId(e.target.value)}>
                <option value="">Company default</option>
                {attRules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
            <SetupField label="Holiday calendar">
              <SetupSelect value={holidayId} onChange={(e) => setHolidayId(e.target.value)}>
                <option value="">None</option>
                {holidays.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
            <SetupField label="Weekly off policy">
              <SetupSelect value={weeklyOffId} onChange={(e) => setWeeklyOffId(e.target.value)}>
                <option value="">None</option>
                {weeklyOff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Feature toggles
            </h3>
            {catalog.map((section) => (
              <div key={section.id} className="rounded-lg border border-border/70 p-3">
                <p className="mb-2 text-sm font-medium">{section.title}</p>
                <ul className="space-y-2">
                  {section.features.map((f) => {
                    const parentOff = f.parent_key ? !toggles[f.parent_key] : false;
                    return (
                      <li key={f.key} className="flex items-center justify-between gap-3 text-sm">
                        <span className={cn(parentOff && "text-muted-foreground")}>{f.label}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(toggles[f.key])}
                          disabled={parentOff}
                          className={cn(
                            "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
                            toggles[f.key] ? "bg-primary" : "bg-muted",
                            parentOff && "cursor-not-allowed opacity-50",
                          )}
                          onClick={() => setToggle(f.key, !toggles[f.key], f.parent_key)}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200",
                              toggles[f.key] ? "translate-x-5" : "translate-x-0.5",
                            )}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        </div>
      </SetupDrawer>

      <SetupConfirmDialog
        open={!!confirmDelete}
        title="Delete management group?"
        message={
          confirmDelete?.employee_count
            ? `Assigned to ${confirmDelete.employee_count} employee(s). Reassign them before delete.`
            : "This cannot be undone."
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await deleteManagementGroup(confirmDelete.id);
            toast("Deleted", "success");
            setConfirmDelete(null);
            await load();
          } catch (err) {
            toast(err instanceof ApiClientError ? err.message : "Delete failed", "error");
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
