"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { KeyRound, Mail, ScrollText, Shield, UserPlus } from "lucide-react";

import {
  HrAuthBanner,
  HrEmptyState,
  HrLoadingBlock,
  HrUnderlineTabs,
  type HrTabItem,
} from "@/components/hr/hr-primitives";
import { SetupToastHost, toast } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import {
  ALL_HR_NAV_KEYS,
  hrNavAccessGroups,
} from "@/config/hr-nav";
import {
  assignHrAdmin,
  listHrActivityLogs,
  listHrAdmins,
  listHrEntities,
  resetHrAdminPassword,
  revokeHrAdmin,
  setHrAdminEntities,
  setHrAdminNav,
  type HrActivityLogRecord,
  type HrAdminEntityOption,
  type HrAdminRecord,
} from "@/services/hr-superadmin-service";
import type { EmployeeRecord } from "@/types/employee-management";
import { ApiClientError } from "@/services/api-client";

type TabId = "assign" | "passwords" | "logs";

const TABS: HrTabItem[] = [
  { id: "assign", label: "Give access", icon: UserPlus },
  { id: "passwords", label: "Passwords", icon: KeyRound },
  { id: "logs", label: "Activity logs", icon: ScrollText },
];

const NAV_ACCESS_GROUPS = hrNavAccessGroups();

function effectiveNavKeys(admin: HrAdminRecord): Set<string> {
  if (admin.nav_unrestricted) return new Set(ALL_HR_NAV_KEYS);
  return new Set(admin.nav_keys);
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function ToggleSwitch({
  checked,
  disabled,
  label,
  compact,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  compact?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-2.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={cn(
          "relative isolate h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/25",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked && "translate-x-4",
          )}
        />
      </span>
      <span
        className={cn(
          "text-left text-xs font-medium leading-none",
          compact ? "min-w-0" : "w-[8.75rem]",
          checked ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}

function PersonRow({
  name,
  meta,
  children,
}: {
  name: string;
  meta: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 sm:gap-x-6">
      <div className="min-w-0 overflow-hidden pr-1">
        <p className="text-sm font-semibold leading-5 text-foreground">{name}</p>
        <p className="mt-0.5 break-words text-xs leading-4 text-muted-foreground [overflow-wrap:anywhere]">
          {meta}
        </p>
      </div>
      <div className="flex justify-end">{children}</div>
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  caption,
  children,
}: {
  icon: typeof Shield;
  title: string;
  caption?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
        {caption ? <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{caption}</p> : null}
      </div>
      {children ? <div className="flex w-full shrink-0 items-center gap-2 lg:w-auto lg:pt-0.5">{children}</div> : null}
    </div>
  );
}

export function HrSuperadminPage() {
  const { isHrmsSuperAdmin, loading: permLoading } = useUserPermissions();
  const [tab, setTab] = useState<TabId>("assign");
  const [query, setQuery] = useState("");
  const [logQuery, setLogQuery] = useState("");
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [admins, setAdmins] = useState<HrAdminRecord[]>([]);
  const [entities, setEntities] = useState<HrAdminEntityOption[]>([]);
  const [logs, setLogs] = useState<HrActivityLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [dir, adminRows, entityRows] = await Promise.all([
        loadEmployeeDirectory(),
        listHrAdmins(),
        listHrEntities(),
      ]);
      setEmployees(dir.records.filter((r) => !r.isDeleted));
      setAdmins(adminRows);
      setEntities(entityRows);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to load Superadmin data";
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      setLogs(await listHrActivityLogs(200));
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to load activity logs";
      toast(message, "error");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated() || permLoading || !isHrmsSuperAdmin) return;
    void reload();
    void reloadLogs();
  }, [permLoading, isHrmsSuperAdmin, reload, reloadLogs]);

  const adminByEmployee = useMemo(() => {
    const map = new Map<string, HrAdminRecord>();
    for (const row of admins) map.set(row.employee_id, row);
    return map;
  }, [admins]);

  const entityNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of entities) map.set(row.id, row.company_name);
    return map;
  }, [entities]);

  const assignedEmployeeIds = useMemo(
    () => new Set(admins.map((row) => row.employee_id)),
    [admins],
  );

  const assignedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return admins
      .map((admin) => {
        const emp = employees.find((e) => e.id === admin.employee_id);
        return { admin, emp };
      })
      .filter(({ admin, emp }) => {
        if (!q) return true;
        const hay = [
          admin.display_name,
          admin.employee_code,
          admin.email,
          admin.designation,
          emp?.displayName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [admins, employees, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (assignedEmployeeIds.has(e.id)) return false;
      if (!q) return true;
      return (
        e.displayName.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.officialEmail.toLowerCase().includes(q) ||
        e.designationName.toLowerCase().includes(q)
      );
    });
  }, [employees, query, assignedEmployeeIds]);

  const filteredLogs = useMemo(() => {
    const q = logQuery.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (row) =>
        row.action.toLowerCase().includes(q) ||
        (row.entity_name ?? "").toLowerCase().includes(q) ||
        (row.actor_name ?? "").toLowerCase().includes(q) ||
        (row.actor_email ?? "").toLowerCase().includes(q) ||
        row.summary.toLowerCase().includes(q) ||
        row.kind.toLowerCase().includes(q),
    );
  }, [logs, logQuery]);

  async function onToggleHr(employeeId: string, next: boolean) {
    setBusyId(employeeId);
    try {
      if (next) {
        const emp = employees.find((row) => row.id === employeeId);
        const row = await assignHrAdmin(employeeId, emp?.companyId ? [emp.companyId] : []);
        if (row.login_created || row.email_sent) {
          toast(
            row.email_sent
              ? `${row.display_name} now has HR access. Login password emailed to ${row.email}.`
              : `${row.display_name} now has HR module access.`,
          );
        } else {
          toast(`${row.display_name} now has HR module access`);
        }
      } else {
        await revokeHrAdmin(employeeId);
        toast("HR module access revoked. That user has been signed out.");
      }
      await Promise.all([reload(), reloadLogs()]);
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : next ? "Assign failed" : "Revoke failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleEntity(employeeId: string, companyId: string, next: boolean) {
    const current = new Set(adminByEmployee.get(employeeId)?.company_ids ?? []);
    if (next) current.add(companyId);
    else current.delete(companyId);
    if (current.size === 0) {
      toast("Keep at least one entity, or turn off Give access", "error");
      return;
    }
    setBusyId(`entity:${employeeId}:${companyId}`);
    try {
      const row = await setHrAdminEntities(employeeId, [...current]);
      setAdmins((prev) => prev.map((item) => (item.employee_id === employeeId ? row : item)));
      toast(
        next
          ? "Entity assigned. User must sign in again for the new scope."
          : "Entity removed. User was signed out so data scope refreshes.",
      );
      await reloadLogs();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Entity update failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleNav(employeeId: string, navKey: string, next: boolean) {
    const admin = adminByEmployee.get(employeeId);
    if (!admin) return;
    const current = effectiveNavKeys(admin);
    if (next) current.add(navKey);
    else current.delete(navKey);
    setBusyId(`nav:${employeeId}:${navKey}`);
    try {
      const row = await setHrAdminNav(employeeId, [...current]);
      setAdmins((prev) => prev.map((item) => (item.employee_id === employeeId ? row : item)));
      toast(next ? "Menu shown" : "Menu hidden for that HR Admin");
      await reloadLogs();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Menu update failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleNavGroup(employeeId: string, keys: string[], next: boolean) {
    const admin = adminByEmployee.get(employeeId);
    if (!admin) return;
    const current = effectiveNavKeys(admin);
    for (const key of keys) {
      if (next) current.add(key);
      else current.delete(key);
    }
    setBusyId(`nav:${employeeId}:${keys.join(",")}`);
    try {
      const row = await setHrAdminNav(employeeId, [...current]);
      setAdmins((prev) => prev.map((item) => (item.employee_id === employeeId ? row : item)));
      toast(next ? "Menus shown" : "Menus hidden for that HR Admin");
      await reloadLogs();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Menu update failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function onSendPasswordEmail(employeeId: string) {
    setBusyId(employeeId);
    try {
      const row = await resetHrAdminPassword(employeeId);
      toast(
        row.email_sent
          ? `Login password emailed to ${row.email}`
          : `Password reset for ${row.display_name}`,
      );
      await reloadLogs();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not email login password", "error");
    } finally {
      setBusyId(null);
    }
  }

  if (!isAuthenticated()) return <HrAuthBanner />;
  if (permLoading) return <HrLoadingBlock label="Checking access…" />;
  if (!isHrmsSuperAdmin) {
    return (
      <div className="p-6">
        <HrEmptyState
          title="Superadmin Panel"
          description="Only HR module admins (assigned from Organization Users) can manage HR module users here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Superadmin Panel"
        description="Give HR access, choose entities for data segregation, pick sidebar menus, email login passwords, and review activity logs."
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-2">
          <HrUnderlineTabs
            embedded
            size="sm"
            className="w-full"
            tabs={TABS.map((t) =>
              t.id === "assign" ? { ...t, badge: admins.length || undefined } : t,
            )}
            value={tab}
            onChange={(id) => setTab(id as TabId)}
          />
        </div>

        <div className="p-5">
          {tab === "assign" ? (
            <>
              <PanelHeader
                icon={Shield}
                title={`People with access (${admins.length})`}
                caption="Toggle entities (data segregation) and sidebar menus. Superadmin Panel is never granted here. Turn off Give access to revoke."
              >
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search assigned or employees…"
                  className="h-9 w-full lg:w-64"
                />
              </PanelHeader>
              {loading ? (
                <HrLoadingBlock label="Loading employees…" />
              ) : assignedRows.length === 0 ? (
                <HrEmptyState
                  title="No HR module users yet"
                  description="Turn on Give access for an employee in the list below."
                />
              ) : (
                <div className="mb-6 overflow-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[72rem] text-left text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                      <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2.5 font-medium">Employee</th>
                        <th className="px-3 py-2.5 font-medium">Designation</th>
                        <th className="px-3 py-2.5 font-medium">Entities</th>
                        <th className="px-3 py-2.5 font-medium">Sidebar menus</th>
                        <th className="px-3 py-2.5 text-right font-medium">Give access</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedRows.map(({ admin, emp }) => {
                        const assigned = new Set(admin.company_ids ?? []);
                        const entityNames = admin.company_ids
                          .map((id) => entityNameById.get(id))
                          .filter((name): name is string => Boolean(name));
                        const navKeys = effectiveNavKeys(admin);
                        const allMenusOn = ALL_HR_NAV_KEYS.every((key) => navKeys.has(key));
                        return (
                          <tr key={admin.employee_id} className="border-b border-border/50 align-top last:border-b-0">
                            <td className="px-3 py-3">
                              <p className="font-semibold text-foreground">
                                {admin.display_name || emp?.displayName}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {admin.employee_code} · {admin.email}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {admin.designation || emp?.designationName || "-"}
                            </td>
                            <td className="px-3 py-3">
                              <p className="text-foreground">
                                {entityNames.length ? entityNames.join(", ") : "-"}
                              </p>
                              {entities.length > 0 ? (
                                <ul className="mt-2 space-y-1">
                                  {entities.map((entity) => {
                                    const on = assigned.has(entity.id);
                                    const entityBusy = busyId === `entity:${admin.employee_id}:${entity.id}`;
                                    return (
                                      <li
                                        key={entity.id}
                                        className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2 py-1"
                                      >
                                        <span className="truncate text-[11px]">{entity.company_name}</span>
                                        <ToggleSwitch
                                          compact
                                          checked={on}
                                          disabled={busyId === admin.employee_id || entityBusy}
                                          label={on ? "On" : "Off"}
                                          onChange={(next) =>
                                            void onToggleEntity(admin.employee_id, entity.id, next)
                                          }
                                        />
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : null}
                            </td>
                            <td className="px-3 py-3">
                              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2 py-1">
                                <span className="text-[11px] font-medium text-foreground">All menus</span>
                                <ToggleSwitch
                                  compact
                                  checked={allMenusOn}
                                  disabled={Boolean(busyId)}
                                  label={allMenusOn ? "Shown" : "Hidden"}
                                  onChange={(next) =>
                                    void onToggleNavGroup(admin.employee_id, ALL_HR_NAV_KEYS, next)
                                  }
                                />
                              </div>
                              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                                {NAV_ACCESS_GROUPS.map((group, groupIdx) => {
                                  const groupKeys = group.items.map((item) => item.navKey);
                                  const groupOn = groupKeys.every((key) => navKeys.has(key));
                                  return (
                                    <div key={`${group.label || "menus"}-${groupIdx}`}>
                                      {group.label ? (
                                        <div className="mb-1 flex items-center justify-between gap-2">
                                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                            {group.label}
                                          </p>
                                          <ToggleSwitch
                                            compact
                                            checked={groupOn}
                                            disabled={Boolean(busyId)}
                                            label={groupOn ? "All" : "None"}
                                            onChange={(next) =>
                                              void onToggleNavGroup(admin.employee_id, groupKeys, next)
                                            }
                                          />
                                        </div>
                                      ) : null}
                                      <ul className="space-y-1">
                                        {group.items.map((item) => {
                                          const on = navKeys.has(item.navKey);
                                          const itemBusy =
                                            busyId === `nav:${admin.employee_id}:${item.navKey}`;
                                          return (
                                            <li
                                              key={item.navKey}
                                              className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2 py-1"
                                            >
                                              <span className="min-w-0 truncate text-[11px]">{item.title}</span>
                                              <ToggleSwitch
                                                compact
                                                checked={on}
                                                disabled={busyId === admin.employee_id || itemBusy}
                                                label={on ? "Shown" : "Hidden"}
                                                onChange={(next) =>
                                                  void onToggleNav(admin.employee_id, item.navKey, next)
                                                }
                                              />
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex justify-end">
                                <ToggleSwitch
                                  checked
                                  disabled={busyId === admin.employee_id}
                                  label="Give access"
                                  onChange={(next) => void onToggleHr(admin.employee_id, next)}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <PanelHeader
                icon={UserPlus}
                title="Employees"
                caption="Turn on Give access to add HRMS to the user's ERP menu, then set entities and sidebar menus above."
              />
              {!loading && filtered.length === 0 ? (
                <HrEmptyState title="No employees match" description="Try a different search." />
              ) : loading ? null : (
                <ul>
                  {filtered.map((emp) => (
                    <li key={emp.id} className="border-b border-border/70 py-3 last:border-b-0">
                      <PersonRow
                        name={emp.displayName}
                        meta={`${emp.employeeCode} · ${emp.officialEmail} · ${emp.designationName || "-"}`}
                      >
                        <ToggleSwitch
                          checked={false}
                          disabled={busyId === emp.id}
                          label="Give access"
                          onChange={(next) => void onToggleHr(emp.id, next)}
                        />
                      </PersonRow>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}

          {tab === "passwords" ? (
            <>
              <PanelHeader
                icon={KeyRound}
                title={`HR module passwords (${admins.length})`}
                caption="Send a new random login password to the user’s email. It is not shown on this screen."
              />
              {admins.length === 0 ? (
                <HrEmptyState
                  title="No HR module users yet"
                  description="Turn on Give access for an employee first, then send their login password by email here."
                />
              ) : (
                <ul>
                  {admins.map((row) => {
                    const entityNames = row.company_ids
                      .map((id) => entityNameById.get(id))
                      .filter((name): name is string => Boolean(name));
                    const sending = busyId === row.employee_id;
                    return (
                      <li key={row.employee_id} className="border-b border-border/70 py-3 last:border-b-0">
                        <PersonRow
                          name={row.display_name}
                          meta={`${row.employee_code} · ${row.email} · ${
                            entityNames.length ? entityNames.join(", ") : row.designation || "-"
                          }`}
                        >
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 cursor-pointer gap-1.5"
                            disabled={sending || !row.email}
                            onClick={() => void onSendPasswordEmail(row.employee_id)}
                          >
                            <Mail className="size-3.5" />
                            {sending ? "Sending…" : "Send password email"}
                          </Button>
                        </PersonRow>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : null}

          {tab === "logs" ? (
            <>
              <PanelHeader icon={ScrollText} title="Activity logs">
                <Input
                  value={logQuery}
                  onChange={(e) => setLogQuery(e.target.value)}
                  placeholder="Filter logs…"
                  className="h-9 w-full lg:w-56"
                />
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => void reloadLogs()}>
                  Refresh
                </Button>
              </PanelHeader>
              {logsLoading ? (
                <HrLoadingBlock label="Loading activity logs…" />
              ) : filteredLogs.length === 0 ? (
                <HrEmptyState
                  title="No activity yet"
                  description="Assignments, password resets, and other changes will show here."
                />
              ) : (
                <div className="overflow-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[40rem] text-left text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                      <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2.5 font-medium">When</th>
                        <th className="px-3 py-2.5 font-medium">Type</th>
                        <th className="px-3 py-2.5 font-medium">Action</th>
                        <th className="px-3 py-2.5 font-medium">Actor</th>
                        <th className="px-3 py-2.5 font-medium">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((row) => (
                        <tr key={row.id} className="border-b border-border/50 last:border-b-0">
                          <td className="whitespace-nowrap px-3 py-2.5 align-middle text-muted-foreground">
                            {formatWhen(row.occurred_at)}
                          </td>
                          <td className="px-3 py-2.5 align-middle">
                            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                              {row.kind}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-middle font-medium">
                            {row.action}
                            {row.entity_name ? (
                              <span className="ml-1 font-normal text-muted-foreground">· {row.entity_name}</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 align-middle">
                            <p className="leading-4">{row.actor_name || "-"}</p>
                            {row.actor_email ? (
                              <p className="mt-0.5 text-[10px] leading-3 text-muted-foreground">{row.actor_email}</p>
                            ) : null}
                          </td>
                          <td
                            className="max-w-xs truncate px-3 py-2.5 align-middle text-muted-foreground"
                            title={row.summary}
                          >
                            {row.summary || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
