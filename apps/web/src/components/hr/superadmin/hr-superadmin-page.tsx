"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Copy, KeyRound, ScrollText, Shield, UserPlus } from "lucide-react";

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
  assignHrAdmin,
  listHrActivityLogs,
  listHrAdmins,
  listHrEntities,
  resetHrAdminPassword,
  revokeHrAdmin,
  setHrAdminEntities,
  type HrActivityLogRecord,
  type HrAdminEntityOption,
  type HrAdminRecord,
} from "@/services/hr-superadmin-service";
import type { EmployeeRecord } from "@/types/employee-management";
import { ApiClientError } from "@/services/api-client";

type IssuedLogin = {
  name: string;
  email: string;
  password: string;
};

type TabId = "assign" | "passwords" | "logs";

const TABS: HrTabItem[] = [
  { id: "assign", label: "Assign HR", icon: UserPlus },
  { id: "passwords", label: "Passwords", icon: KeyRound },
  { id: "logs", label: "Activity logs", icon: ScrollText },
];

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
  const [issued, setIssued] = useState<IssuedLogin | null>(null);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.displayName.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.officialEmail.toLowerCase().includes(q) ||
        e.designationName.toLowerCase().includes(q),
    );
  }, [employees, query]);

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

  function showIssued(name: string, email: string, password: string | null | undefined) {
    if (!password) return;
    setIssued({ name, email, password });
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied`);
    } catch {
      toast(`Could not copy ${label}`, "error");
    }
  }

  async function onToggleHr(employeeId: string, next: boolean) {
    setBusyId(employeeId);
    try {
      if (next) {
        const emp = employees.find((row) => row.id === employeeId);
        const row = await assignHrAdmin(employeeId, emp?.companyId ? [emp.companyId] : []);
        if (row.temporary_password) {
          showIssued(row.display_name, row.email, row.temporary_password);
          toast(`${row.display_name} is now HR Admin. Copy the generated password below.`);
          setTab("passwords");
        } else {
          toast(`${row.display_name} is now HR Admin`);
        }
      } else {
        await revokeHrAdmin(employeeId);
        toast("HR Admin access revoked. That user has been signed out.");
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
      toast("Keep at least one entity, or turn off HR Admin", "error");
      return;
    }
    setBusyId(`entity:${employeeId}:${companyId}`);
    try {
      const row = await setHrAdminEntities(employeeId, [...current]);
      setAdmins((prev) => prev.map((item) => (item.employee_id === employeeId ? row : item)));
      toast(
        next
          ? "Entity assigned"
          : "Entity removed. That user was signed out of the revoked entity.",
      );
      await reloadLogs();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Entity update failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function onGeneratePassword(employeeId: string) {
    setBusyId(employeeId);
    try {
      const row = await resetHrAdminPassword(employeeId);
      showIssued(row.display_name, row.email, row.temporary_password);
      toast(`New password generated for ${row.display_name}`);
      await reloadLogs();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Password generation failed", "error");
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
          description="Only the HRMS Superadmin can assign HR Admins. This page is hidden from HR Admin users."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Superadmin Panel"
        description="Assign HR Admins, choose which entities they can manage (one or many), generate login passwords, and review activity logs."
      />

      {issued ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4">
          <p className="text-sm font-semibold text-foreground">HR login password (shown once)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Share this with {issued.name}. They should change it after first sign-in.
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Email</dt>
              <dd className="mt-1 flex items-center gap-1.5">
                <span className="min-w-0 truncate text-sm font-medium">{issued.email}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2"
                  onClick={() => void copyText(issued.email, "Email")}
                >
                  <Copy className="size-3.5" />
                </Button>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Password</dt>
              <dd className="mt-1 flex items-center gap-1.5">
                <span className="min-w-0 truncate font-mono text-sm font-medium">{issued.password}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2"
                  onClick={() => void copyText(issued.password, "Password")}
                >
                  <Copy className="size-3.5" />
                </Button>
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

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
                title="Employees"
                caption="Turn on HR Admin to grant access. Then toggle entities (one or many). Turn off HR Admin to revoke access and sign them out."
              >
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, code, email…"
                  className="h-9 w-full lg:w-64"
                />
              </PanelHeader>
              {loading ? (
                <HrLoadingBlock label="Loading employees…" />
              ) : filtered.length === 0 ? (
                <HrEmptyState title="No employees match" description="Try a different search." />
              ) : (
                <ul>
                  {filtered.map((emp) => {
                    const admin = adminByEmployee.get(emp.id);
                    const isAdmin = Boolean(admin);
                    const assigned = new Set(admin?.company_ids ?? []);
                    return (
                      <li key={emp.id} className="border-b border-border/70 py-3 last:border-b-0">
                        <PersonRow
                          name={emp.displayName}
                          meta={`${emp.employeeCode} · ${emp.officialEmail} · ${emp.designationName || "—"}`}
                        >
                          <ToggleSwitch
                            checked={isAdmin}
                            disabled={busyId === emp.id}
                            label={isAdmin ? "HR Admin" : "Assign HR"}
                            onChange={(next) => void onToggleHr(emp.id, next)}
                          />
                        </PersonRow>
                        {isAdmin ? (
                          <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Entities{assigned.size ? ` (${assigned.size})` : ""}
                            </p>
                            {entities.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                No companies found. Add them in HR Setup → Legal Entities.
                              </p>
                            ) : (
                              <ul>
                                {entities.map((entity) => {
                                  const on = assigned.has(entity.id);
                                  const entityBusy = busyId === `entity:${emp.id}:${entity.id}`;
                                  return (
                                    <li
                                      key={entity.id}
                                      className="flex items-center justify-between gap-3 py-1.5"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-medium text-foreground">
                                          {entity.company_name}
                                        </p>
                                        <p className="truncate text-[10px] text-muted-foreground">
                                          {entity.company_code}
                                          {entity.legal_name && entity.legal_name !== entity.company_name
                                            ? ` · ${entity.legal_name}`
                                            : ""}
                                        </p>
                                      </div>
                                      <ToggleSwitch
                                        compact
                                        checked={on}
                                        disabled={busyId === emp.id || entityBusy}
                                        label={on ? "Assigned" : "Assign"}
                                        onChange={(next) => void onToggleEntity(emp.id, entity.id, next)}
                                      />
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : null}

          {tab === "passwords" ? (
            <>
              <PanelHeader
                icon={KeyRound}
                title={`HR Admin passwords (${admins.length})`}
                caption="Turn on Generate to create a random login password. It is shown once above."
              />
              {admins.length === 0 ? (
                <HrEmptyState
                  title="No HR Admins yet"
                  description="Assign someone as HR Admin first, then generate their password here."
                />
              ) : (
                <ul>
                  {admins.map((row) => {
                    const entityNames = row.company_ids
                      .map((id) => entityNameById.get(id))
                      .filter((name): name is string => Boolean(name));
                    return (
                      <li key={row.employee_id} className="border-b border-border/70 py-3 last:border-b-0">
                        <PersonRow
                          name={row.display_name}
                          meta={`${row.employee_code} · ${row.email} · ${
                            entityNames.length ? entityNames.join(", ") : row.designation || "—"
                          }`}
                        >
                          <ToggleSwitch
                            checked={issued?.email === row.email}
                            disabled={busyId === row.employee_id}
                            label="Generate password"
                            onChange={(next) => {
                              if (next) void onGeneratePassword(row.employee_id);
                            }}
                          />
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
                            <p className="leading-4">{row.actor_name || "—"}</p>
                            {row.actor_email ? (
                              <p className="mt-0.5 text-[10px] leading-3 text-muted-foreground">{row.actor_email}</p>
                            ) : null}
                          </td>
                          <td
                            className="max-w-xs truncate px-3 py-2.5 align-middle text-muted-foreground"
                            title={row.summary}
                          >
                            {row.summary || "—"}
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
