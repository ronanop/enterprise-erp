"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Shield, Trash2 } from "lucide-react";

import { HrEmptyState, HrLoadingBlock } from "@/components/hr/hr-primitives";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { ALL_HR_NAV_KEYS, hrNavAccessGroups } from "@/config/hr-nav";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  createAccessRole,
  deleteAccessRole,
  getAccessRoleCatalog,
  listAccessRoles,
  updateAccessRole,
  type HrAccessAreaActions,
  type HrAccessAreaCatalogItem,
  type HrAccessRoleRecord,
} from "@/services/hr-superadmin-service";

const NAV_GROUPS = hrNavAccessGroups();

function emptyActions(areas: HrAccessAreaCatalogItem[]): Record<string, HrAccessAreaActions> {
  const out: Record<string, HrAccessAreaActions> = {};
  for (const area of areas) {
    out[area.id] = { view: false, edit: false, delete: false };
  }
  return out;
}

function navFromAreas(
  areas: HrAccessAreaCatalogItem[],
  actions: Record<string, HrAccessAreaActions>,
): string[] {
  const keys = new Set<string>();
  for (const area of areas) {
    const a = actions[area.id];
    if (a?.view || a?.edit || a?.delete) {
      for (const k of area.nav_keys) keys.add(k);
    }
  }
  return ALL_HR_NAV_KEYS.filter((k) => keys.has(k));
}

export function AccessRolesPanel({ onChanged }: { onChanged?: () => void }) {
  const [roles, setRoles] = useState<HrAccessRoleRecord[]>([]);
  const [areas, setAreas] = useState<HrAccessAreaCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [actions, setActions] = useState<Record<string, HrAccessAreaActions>>({});
  const [navKeys, setNavKeys] = useState<string[]>([]);
  const [isSystemEdit, setIsSystemEdit] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [roleRows, catalog] = await Promise.all([listAccessRoles(), getAccessRoleCatalog()]);
      setRoles(roleRows);
      setAreas(catalog.areas);
    } catch (err) {
      toast(formatApiError(err, "Couldn't load access roles."), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openCreate = () => {
    setEditingId(null);
    setIsSystemEdit(false);
    setRoleName("");
    setDescription("");
    const base = emptyActions(areas);
    setActions(base);
    setNavKeys([]);
    setOpen(true);
  };

  const openEdit = (role: HrAccessRoleRecord) => {
    setEditingId(role.id);
    setIsSystemEdit(role.is_system);
    setRoleName(role.role_name);
    setDescription(role.description ?? "");
    const base = emptyActions(areas);
    for (const [id, val] of Object.entries(role.area_actions || {})) {
      base[id] = {
        view: Boolean(val?.view),
        edit: Boolean(val?.edit),
        delete: Boolean(val?.delete),
      };
    }
    setActions(base);
    setNavKeys(role.nav_keys?.length ? role.nav_keys : navFromAreas(areas, base));
    setOpen(true);
  };

  const setAreaAction = (areaId: string, key: keyof HrAccessAreaActions, value: boolean) => {
    if (isSystemEdit) return;
    setActions((prev) => {
      const cur = prev[areaId] ?? { view: false, edit: false, delete: false };
      const next = { ...cur, [key]: value };
      if ((key === "edit" || key === "delete") && value) next.view = true;
      if (key === "view" && !value) {
        next.edit = false;
        next.delete = false;
      }
      const merged = { ...prev, [areaId]: next };
      setNavKeys(navFromAreas(areas, merged));
      return merged;
    });
  };

  const toggleNav = (key: string) => {
    if (isSystemEdit) return;
    setNavKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  async function save() {
    if (!roleName.trim()) {
      toast("Enter a role name", "error");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateAccessRole(editingId, {
          role_name: roleName.trim(),
          description: description.trim() || null,
          area_actions: isSystemEdit ? undefined : actions,
          nav_keys: isSystemEdit ? undefined : navKeys,
        });
        toast("Role updated", "success");
      } else {
        await createAccessRole({
          role_name: roleName.trim(),
          description: description.trim() || null,
          area_actions: actions,
          nav_keys: navKeys,
        });
        toast("Role created", "success");
      }
      setOpen(false);
      await reload();
      onChanged?.();
    } catch (err) {
      toast(formatApiError(err, "Couldn't save the role."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(role: HrAccessRoleRecord) {
    if (role.is_system) return;
    setBusyId(role.id);
    try {
      await deleteAccessRole(role.id);
      toast("Role deleted", "success");
      await reload();
      onChanged?.();
    } catch (err) {
      toast(formatApiError(err, "Couldn't delete the role."), "error");
    } finally {
      setBusyId(null);
    }
  }

  const summary = useMemo(() => {
    return roles.map((r) => {
      const enabled = Object.entries(r.area_actions || {})
        .filter(([, a]) => a?.view || a?.edit || a?.delete)
        .map(([id]) => areas.find((x) => x.id === id)?.label || id);
      return { id: r.id, labels: enabled };
    });
  }, [roles, areas]);

  if (loading) return <HrLoadingBlock label="Loading access roles…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Access roles</h2>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Name a role, choose modules, and set View / Edit / Delete. Sidebar menus follow the
            modules you enable (you can fine-tune them). Assign roles on the Give access tab.
          </p>
        </div>
        <Button
          size="sm"
          className="cursor-pointer transition-colors duration-200"
          onClick={openCreate}
        >
          <Plus className="size-3.5" />
          New role
        </Button>
      </div>

      {!roles.length ? (
        <HrEmptyState
          title="No access roles yet"
          description="Create Finance, Recruitment, or Admin-style roles with module permissions."
        />
      ) : (
        <div className="overflow-auto rounded-xl border border-border/70">
          <table className="w-full min-w-[56rem] text-left text-xs">
            <thead className="bg-muted/80">
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Role</th>
                <th className="px-3 py-2.5 font-medium">Modules</th>
                <th className="px-3 py-2.5 font-medium">Menus</th>
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => {
                const labels = summary.find((s) => s.id === role.id)?.labels ?? [];
                return (
                  <tr key={role.id} className="border-b border-border/50 last:border-b-0">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-foreground">{role.role_name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {role.is_system ? "System · full access" : role.role_code}
                        {role.description ? ` · ${role.description}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {labels.length ? labels.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">
                      {role.nav_keys?.length ?? 0} menus
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 cursor-pointer"
                          title="Edit role"
                          onClick={() => openEdit(role)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        {!role.is_system ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 cursor-pointer text-destructive hover:bg-destructive/10"
                            disabled={busyId === role.id}
                            title="Delete role"
                            onClick={() => void remove(role)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SetupDrawer
        open={open}
        wide
        title={editingId ? (isSystemEdit ? "Admin role" : "Edit access role") : "New access role"}
        description={
          isSystemEdit
            ? "Admin always has full module access. Create a custom role for limited Finance / Recruitment access."
            : "Pick modules and View / Edit / Delete. Sidebar menus update from the modules you enable."
        }
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            {!isSystemEdit ? (
              <Button
                size="sm"
                className="cursor-pointer"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : editingId ? "Save role" : "Create role"}
              </Button>
            ) : null}
          </>
        }
      >
        <div className="space-y-4">
          <SetupField label="Role name" required>
            <SetupInput
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="Finance"
              disabled={isSystemEdit}
            />
          </SetupField>
          <SetupField label="Description">
            <SetupInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Payroll module only"
              disabled={isSystemEdit}
            />
          </SetupField>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Modules · View / Edit / Delete
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Module</th>
                    <th className="px-3 py-2 text-center font-medium">View</th>
                    <th className="px-3 py-2 text-center font-medium">Edit</th>
                    <th className="px-3 py-2 text-center font-medium">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {areas.map((area) => {
                    const a = actions[area.id] ?? { view: false, edit: false, delete: false };
                    return (
                      <tr key={area.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground">{area.label}</p>
                          <p className="text-[11px] text-muted-foreground">{area.description}</p>
                        </td>
                        {(["view", "edit", "delete"] as const).map((key) => (
                          <td key={key} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              className="size-3.5 cursor-pointer accent-primary disabled:cursor-not-allowed"
                              checked={Boolean(a[key])}
                              disabled={isSystemEdit || (key === "delete" && !area.supports_delete)}
                              onChange={(e) => setAreaAction(area.id, key, e.target.checked)}
                              aria-label={`${area.label} ${key}`}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Sidebar menus
            </p>
            <div className="space-y-3 rounded-lg border border-border p-3">
              {NAV_GROUPS.map((group) => (
                <div key={group.label || "main"}>
                  {group.label ? (
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item) => {
                      const on = navKeys.includes(item.navKey);
                      return (
                        <button
                          key={item.navKey}
                          type="button"
                          disabled={isSystemEdit}
                          onClick={() => toggleNav(item.navKey)}
                          className={cn(
                            "cursor-pointer rounded-md border px-2 py-1 text-[11px] transition-colors duration-200",
                            on
                              ? "border-primary/40 bg-primary/10 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                            isSystemEdit && "cursor-not-allowed opacity-70",
                          )}
                        >
                          {item.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SetupDrawer>
    </div>
  );
}
