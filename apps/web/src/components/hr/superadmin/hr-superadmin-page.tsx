"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Copy, KeyRound, Mail, ScrollText, Shield, UserPlus, Webhook } from "lucide-react";

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
import { getShareableApiBase } from "@/utils/env";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import {
  ALL_HR_NAV_KEYS,
  hrNavAccessGroups,
} from "@/config/hr-nav";
import { AccessRolesPanel } from "@/components/hr/superadmin/access-roles-panel";
import {
  assignHrAdmin,
  createIntegrationApiKey,
  FALLBACK_INTEGRATION_CATALOG,
  getIntegrationApiKeyCatalog,
  listAccessRoles,
  listHrActivityLogs,
  listHrAdmins,
  listHrEntities,
  listIntegrationApiKeys,
  resetHrAdminPassword,
  revokeHrAdmin,
  revokeIntegrationApiKey,
  setHrAdminAccessRole,
  setHrAdminEntities,
  setHrAdminNav,
  type HrAccessRoleRecord,
  type HrActivityLogRecord,
  type HrAdminEntityOption,
  type HrAdminRecord,
  type HrIntegrationApiKeyRecord,
  type HrIntegrationCatalog,
} from "@/services/hr-superadmin-service";
import type { EmployeeRecord } from "@/types/employee-management";
import { ApiClientError, formatApiError } from "@/services/api-client";
import { formatHrActivityLog } from "@/lib/hr-activity-log-format";

type TabId = "assign" | "roles" | "passwords" | "api-keys" | "logs";

const TABS: HrTabItem[] = [
  { id: "assign", label: "People", icon: UserPlus },
  { id: "roles", label: "Roles", icon: Shield },
  { id: "passwords", label: "Passwords", icon: KeyRound },
  { id: "api-keys", label: "API keys", icon: Webhook },
  { id: "logs", label: "Activity logs", icon: ScrollText },
];

const NAV_ACCESS_GROUPS = hrNavAccessGroups();

const API_KEY_TTL_OPTIONS: { value: string; label: string; days: number | null }[] = [
  { value: "never", label: "Never expires", days: null },
  { value: "1", label: "1 day", days: 1 },
  { value: "7", label: "7 days", days: 7 },
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
  { value: "365", label: "1 year", days: 365 },
  { value: "custom", label: "Custom date…", days: null },
];

function effectiveNavKeys(admin: HrAdminRecord): Set<string> {
  if (admin.nav_unrestricted) return new Set(ALL_HR_NAV_KEYS);
  return new Set(admin.nav_keys);
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function buildIntegrationSnippets(apiKey: string, path: string): { curl: string; powershell: string; url: string } {
  const base = getShareableApiBase().replace(/\/+$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}?page=1&page_size=100`;
  const curl = `curl -s -H "X-HRMS-Api-Key: ${apiKey}" "${url}"`;
  const powershell = `Invoke-RestMethod -Uri "${url}" -Headers @{ "X-HRMS-Api-Key" = "${apiKey}" }`;
  return { curl, powershell, url };
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
  const [accessRoles, setAccessRoles] = useState<HrAccessRoleRecord[]>([]);
  const [defaultAccessRoleId, setDefaultAccessRoleId] = useState<string>("");
  const [entities, setEntities] = useState<HrAdminEntityOption[]>([]);
  const [logs, setLogs] = useState<HrActivityLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<HrIntegrationApiKeyRecord[]>([]);
  const [apiCatalog, setApiCatalog] = useState<HrIntegrationCatalog>(FALLBACK_INTEGRATION_CATALOG);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeyNotes, setApiKeyNotes] = useState("");
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>(["employees"]);
  const [selectedFields, setSelectedFields] = useState<string[]>([
    "employee_code",
    "name",
    "department",
    "manager",
    "leave_balances",
  ]);
  const [selectedApiCompanies, setSelectedApiCompanies] = useState<string[]>([]);
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdPlainKey, setCreatedPlainKey] = useState<string | null>(null);
  const [createdKeyExpiresAt, setCreatedKeyExpiresAt] = useState<string | null>(null);
  const [createdKeyPath, setCreatedKeyPath] = useState("/hr/integration/employees");
  const [apiKeyTtl, setApiKeyTtl] = useState("30");
  const [apiKeyCustomExpiry, setApiKeyCustomExpiry] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [dir, adminRows, entityRows, roleRows] = await Promise.all([
        loadEmployeeDirectory(),
        listHrAdmins(),
        listHrEntities(),
        listAccessRoles(),
      ]);
      setEmployees(dir.records.filter((r) => !r.isDeleted));
      setAdmins(adminRows);
      setEntities(entityRows);
      setAccessRoles(roleRows);
      const adminRole = roleRows.find((r) => r.is_system) ?? roleRows[0];
      setDefaultAccessRoleId(adminRole?.id ?? "");
    } catch (err) {
      const message = formatApiError(err, "Couldn't load Superadmin data. Refresh the page.");
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadApiKeys = useCallback(async () => {
    setApiKeysLoading(true);
    try {
      const [catalog, keys] = await Promise.all([
        getIntegrationApiKeyCatalog(),
        listIntegrationApiKeys(),
      ]);
      setApiCatalog(catalog);
      setApiKeys(keys);
      if (catalog.endpoints.length && selectedEndpoints.length === 0) {
        setSelectedEndpoints([catalog.endpoints[0]!.id]);
      }
    } catch (err) {
      const message = formatApiError(err, "Couldn't load API keys. Refresh the page.");
      toast(message, "error");
    } finally {
      setApiKeysLoading(false);
    }
  }, [selectedEndpoints.length]);

  const reloadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      setLogs(await listHrActivityLogs(200));
    } catch (err) {
      const message = formatApiError(err, "Couldn't load activity logs. Refresh the page.");
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

  useEffect(() => {
    if (!isAuthenticated() || permLoading || !isHrmsSuperAdmin) return;
    if (tab === "api-keys") void reloadApiKeys();
  }, [tab, permLoading, isHrmsSuperAdmin, reloadApiKeys]);

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

  const formattedLogs = useMemo(
    () => logs.map((row) => ({ row, view: formatHrActivityLog(row) })),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const q = logQuery.trim().toLowerCase();
    if (!q) return formattedLogs;
    return formattedLogs.filter(({ view }) => view.searchText.includes(q));
  }, [formattedLogs, logQuery]);

  /** Assign a predefined role, or revoke when roleId is empty. */
  async function onSelectRole(employeeId: string, roleId: string) {
    setBusyId(employeeId);
    try {
      if (!roleId) {
        await revokeHrAdmin(employeeId);
        toast("Access removed. That user has been signed out.");
      } else {
        const emp = employees.find((row) => row.id === employeeId);
        const already = adminByEmployee.has(employeeId);
        if (already) {
          const row = await setHrAdminAccessRole(employeeId, roleId);
          toast(
            row.access_role_name
              ? `Role set to ${row.access_role_name}. User was signed out to refresh permissions.`
              : "Access role updated.",
          );
        } else {
          const row = await assignHrAdmin(
            employeeId,
            emp?.companyId ? [emp.companyId] : [],
            roleId,
          );
          if (row.email_sent) {
            toast(
              `${row.display_name} assigned ${row.access_role_name || "role"}. Login password emailed to ${row.email}.`,
            );
          } else {
            toast(
              `${row.display_name} assigned ${row.access_role_name || "role"}.`,
            );
          }
        }
      }
      await Promise.all([reload(), reloadLogs()]);
    } catch (err) {
      toast(formatApiError(err, "Couldn't update role. Try again."), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleEntity(employeeId: string, companyId: string, next: boolean) {
    const current = new Set(adminByEmployee.get(employeeId)?.company_ids ?? []);
    if (next) current.add(companyId);
    else current.delete(companyId);
    if (current.size === 0) {
      toast("Keep at least one entity, or set role to No access", "error");
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
      toast(formatApiError(err, "Couldn't update entity access. Try again."), "error");
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
      toast(formatApiError(err, "Couldn't update menu access. Try again."), "error");
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
      toast(formatApiError(err, "Couldn't update menu access. Try again."), "error");
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
      toast(formatApiError(err, "Couldn't email the login password. Try again."), "error");
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelected(list: string[], id: string, next: boolean): string[] {
    const set = new Set(list);
    if (next) set.add(id);
    else set.delete(id);
    return [...set];
  }

  async function onCreateApiKey() {
    if (!apiKeyName.trim()) {
      toast("Enter a name for the API key", "error");
      return;
    }
    if (!selectedEndpoints.length) {
      toast("Select at least one endpoint", "error");
      return;
    }
    if (!selectedFields.length) {
      toast("Select at least one data field", "error");
      return;
    }

    let ttlDays: number | null = null;
    let expiresAt: string | null = null;
    if (apiKeyTtl === "custom") {
      if (!apiKeyCustomExpiry.trim()) {
        toast("Pick a custom expiry date", "error");
        return;
      }
      const custom = new Date(apiKeyCustomExpiry);
      if (Number.isNaN(custom.getTime()) || custom.getTime() <= Date.now()) {
        toast("Expiry must be in the future", "error");
        return;
      }
      expiresAt = custom.toISOString();
    } else if (apiKeyTtl !== "never") {
      const days = Number(apiKeyTtl);
      if (!Number.isFinite(days) || days < 1) {
        toast("Invalid TTL", "error");
        return;
      }
      ttlDays = days;
    }

    const primaryEp =
      apiCatalog.endpoints.find((ep) => selectedEndpoints.includes(ep.id)) ??
      apiCatalog.endpoints[0];
    const path =
      primaryEp?.path?.replace(/^\/api\/v1/, "") ||
      `/hr/integration/${selectedEndpoints[0] || "employees"}`;

    setCreatingKey(true);
    try {
      const created = await createIntegrationApiKey({
        name: apiKeyName.trim(),
        endpoints: selectedEndpoints,
        fields: selectedFields,
        companyIds: selectedApiCompanies,
        notes: apiKeyNotes.trim() || undefined,
        expiresAt,
        ttlDays,
      });
      setCreatedPlainKey(created.api_key ?? null);
      setCreatedKeyExpiresAt(created.expires_at ?? expiresAt);
      setCreatedKeyPath(path.startsWith("/") ? path : `/${path}`);
      setApiKeyName("");
      setApiKeyNotes("");
      toast("API key created — copy the snippet now");
      await reloadApiKeys();
    } catch (err) {
      toast(formatApiError(err, "Couldn't create the API key. Try again."), "error");
    } finally {
      setCreatingKey(false);
    }
  }

  async function onRevokeApiKey(keyId: string) {
    setBusyId(`api-key:${keyId}`);
    try {
      await revokeIntegrationApiKey(keyId);
      toast("API key revoked");
      if (createdPlainKey) {
        setCreatedPlainKey(null);
        setCreatedKeyExpiresAt(null);
      }
      await reloadApiKeys();
    } catch (err) {
      toast(formatApiError(err, "Couldn't revoke the API key. Try again."), "error");
    } finally {
      setBusyId(null);
    }
  }

  const createdSnippets = useMemo(() => {
    if (!createdPlainKey) return null;
    return buildIntegrationSnippets(createdPlainKey, createdKeyPath);
  }, [createdPlainKey, createdKeyPath]);

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
        description="Define roles under Roles, then assign a role to people here. Entities and sidebar can still be fine-tuned per person."
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
          {tab === "roles" ? <AccessRolesPanel onChanged={() => void reload()} /> : null}

          {tab === "assign" ? (
            <>
              <PanelHeader
                icon={Shield}
                title={`People with access (${admins.length})`}
                caption="Role comes from the Roles tab (permissions + menus). Change role or set No access to revoke. Entities and sidebar can be fine-tuned here."
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
                  title="No people with access yet"
                  description="In the Employees list below, pick a role for someone."
                />
              ) : (
                <div className="mb-6 overflow-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[72rem] text-left text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                      <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2.5 font-medium">Employee</th>
                        <th className="px-3 py-2.5 font-medium">Role</th>
                        <th className="px-3 py-2.5 font-medium">Entities</th>
                        <th className="px-3 py-2.5 font-medium">Sidebar menus</th>
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
                            <td className="px-3 py-3">
                              <select
                                className="h-8 w-full min-w-[9rem] cursor-pointer rounded-md border border-border bg-background px-2 text-xs transition-colors duration-200"
                                value={admin.access_role_id || defaultAccessRoleId || ""}
                                disabled={
                                  busyId === admin.employee_id ||
                                  busyId === `role:${admin.employee_id}`
                                }
                                onChange={(e) =>
                                  void onSelectRole(admin.employee_id, e.target.value)
                                }
                                aria-label={`Access role for ${admin.display_name}`}
                              >
                                <option value="">No access</option>
                                {accessRoles.map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {role.role_name}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {admin.designation || emp?.designationName || "—"}
                              </p>
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
                caption="Select a role defined under the Roles tab. That grants access with that role’s permissions and sidebar. Choose No access to leave them without HRMS access."
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
                        <select
                          className="h-8 min-w-[10rem] cursor-pointer rounded-md border border-border bg-background px-2 text-xs transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                          value=""
                          disabled={busyId === emp.id || accessRoles.length === 0}
                          onChange={(e) => {
                            const roleId = e.target.value;
                            e.target.value = "";
                            if (roleId) void onSelectRole(emp.id, roleId);
                          }}
                          aria-label={`Assign role to ${emp.displayName}`}
                        >
                          <option value="" disabled>
                            {accessRoles.length ? "Select role…" : "Create a role first"}
                          </option>
                          {accessRoles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.role_name}
                            </option>
                          ))}
                        </select>
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
                  description="Assign a role to an employee on the People tab first, then send their login password here."
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

          {tab === "api-keys" ? (
            <>
              <PanelHeader
                icon={Webhook}
                title="Integration API keys"
                caption="Create a key, pick the endpoint and employee fields to expose (name, department, manager, …). Callers send header X-HRMS-Api-Key."
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 cursor-pointer"
                  onClick={() => void reloadApiKeys()}
                >
                  Refresh
                </Button>
              </PanelHeader>

              {createdPlainKey && createdSnippets ? (
                <div className="mb-4 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">
                      Copy this key and call snippet now — the secret will not be shown again.
                    </p>
                    {createdKeyExpiresAt ? (
                      <p className="text-[11px] text-muted-foreground">
                        Expires {formatWhen(createdKeyExpiresAt)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">No expiry</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input readOnly value={createdPlainKey} className="h-9 flex-1 font-mono text-xs" />
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 cursor-pointer gap-1.5"
                      onClick={() => {
                        void navigator.clipboard.writeText(createdPlainKey);
                        toast("API key copied");
                      }}
                    >
                      <Copy className="size-3.5" />
                      Copy key
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-foreground">Endpoint URL</p>
                      <button
                        type="button"
                        className="cursor-pointer text-[11px] font-medium text-primary transition-opacity duration-200 hover:opacity-80"
                        onClick={() => {
                          void navigator.clipboard.writeText(createdSnippets.url);
                          toast("URL copied");
                        }}
                      >
                        Copy URL
                      </button>
                    </div>
                    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-background px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground">
                      {createdSnippets.url}
                    </pre>
                    <p className="text-[11px] text-muted-foreground">
                      Header:{" "}
                      <span className="font-mono text-foreground">X-HRMS-Api-Key: {createdPlainKey}</span>
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-foreground">curl</p>
                      <button
                        type="button"
                        className="cursor-pointer text-[11px] font-medium text-primary transition-opacity duration-200 hover:opacity-80"
                        onClick={() => {
                          void navigator.clipboard.writeText(createdSnippets.curl);
                          toast("curl snippet copied");
                        }}
                      >
                        Copy curl
                      </button>
                    </div>
                    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-background px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground">
                      {createdSnippets.curl}
                    </pre>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-foreground">PowerShell</p>
                      <button
                        type="button"
                        className="cursor-pointer text-[11px] font-medium text-primary transition-opacity duration-200 hover:opacity-80"
                        onClick={() => {
                          void navigator.clipboard.writeText(createdSnippets.powershell);
                          toast("PowerShell snippet copied");
                        }}
                      >
                        Copy PowerShell
                      </button>
                    </div>
                    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-background px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground">
                      {createdSnippets.powershell}
                    </pre>
                  </div>
                </div>
              ) : null}

              <div className="mb-5 space-y-3 rounded-xl border border-border/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Create key
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-foreground">Name</span>
                    <Input
                      value={apiKeyName}
                      onChange={(e) => setApiKeyName(e.target.value)}
                      placeholder="e.g. Payroll sync"
                      className="h-9"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-foreground">Notes (optional)</span>
                    <Input
                      value={apiKeyNotes}
                      onChange={(e) => setApiKeyNotes(e.target.value)}
                      placeholder="Who uses this key"
                      className="h-9"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-foreground">TTL / expiry</span>
                    <select
                      value={apiKeyTtl}
                      onChange={(e) => setApiKeyTtl(e.target.value)}
                      className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {API_KEY_TTL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {apiKeyTtl === "custom" ? (
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-foreground">Expires at</span>
                      <Input
                        type="datetime-local"
                        value={apiKeyCustomExpiry}
                        onChange={(e) => setApiKeyCustomExpiry(e.target.value)}
                        className="h-9"
                      />
                    </label>
                  ) : (
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-foreground">Notes reminder</span>
                      <p className="flex h-9 items-center text-[11px] text-muted-foreground">
                        {apiKeyTtl === "never"
                          ? "Key stays valid until you revoke it."
                          : `Key auto-expires after ${apiKeyTtl} day${apiKeyTtl === "1" ? "" : "s"}.`}
                      </p>
                    </label>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-foreground">Endpoint</p>
                  <div className="flex flex-wrap gap-2">
                    {apiCatalog.endpoints.map((ep) => {
                      const checked = selectedEndpoints.includes(ep.id);
                      return (
                        <label
                          key={ep.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors duration-200",
                            checked
                              ? "border-primary/40 bg-primary/5 font-medium"
                              : "border-border/70 hover:bg-muted/40",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="size-3.5 cursor-pointer accent-primary"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedEndpoints((prev) =>
                                toggleSelected(prev, ep.id, e.target.checked),
                              )
                            }
                          />
                          <span>
                            {ep.label}
                            {ep.path ? (
                              <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                                {ep.method} {ep.path}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">
                      Data fields to send
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="cursor-pointer text-[11px] font-medium text-primary transition-opacity duration-200 hover:opacity-80"
                        onClick={() =>
                          setSelectedFields(apiCatalog.fields.map((f) => f.id))
                        }
                      >
                        Select all
                      </button>
                      <span className="text-[11px] text-muted-foreground">·</span>
                      <button
                        type="button"
                        className="cursor-pointer text-[11px] font-medium text-muted-foreground transition-opacity duration-200 hover:opacity-80"
                        onClick={() => setSelectedFields([])}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                    {apiCatalog.fields.map((field) => {
                      const checked = selectedFields.includes(field.id);
                      return (
                        <label
                          key={field.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-colors duration-200",
                            checked
                              ? "border-primary/40 bg-primary/5 font-medium"
                              : "border-border/70 hover:bg-muted/40",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="size-3.5 cursor-pointer accent-primary"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedFields((prev) =>
                                toggleSelected(prev, field.id, e.target.checked),
                              )
                            }
                          />
                          {field.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {entities.length ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-foreground">
                      Limit to entities (optional — empty = all)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {entities.map((ent) => {
                        const checked = selectedApiCompanies.includes(ent.id);
                        return (
                          <label
                            key={ent.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors duration-200",
                              checked
                                ? "border-primary/40 bg-primary/5 font-medium"
                                : "border-border/70 hover:bg-muted/40",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="size-3.5 cursor-pointer accent-primary"
                              checked={checked}
                              onChange={(e) =>
                                setSelectedApiCompanies((prev) =>
                                  toggleSelected(prev, ent.id, e.target.checked),
                                )
                              }
                            />
                            {ent.company_name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <Button
                  type="button"
                  size="sm"
                  className="h-9 cursor-pointer gap-1.5"
                  disabled={creatingKey}
                  onClick={() => void onCreateApiKey()}
                >
                  <Webhook className="size-3.5" />
                  {creatingKey ? "Creating…" : "Create API key"}
                </Button>
              </div>

              {apiKeysLoading ? (
                <HrLoadingBlock label="Loading API keys…" />
              ) : apiKeys.length === 0 ? (
                <HrEmptyState
                  title="No API keys yet"
                  description="Create a key above, choose the employees endpoint and fields such as name, department, leaves, and manager."
                />
              ) : (
                <div className="overflow-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[40rem] text-left text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                      <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2.5 font-medium">Name</th>
                        <th className="px-3 py-2.5 font-medium">Prefix</th>
                        <th className="px-3 py-2.5 font-medium">Endpoint</th>
                        <th className="px-3 py-2.5 font-medium">Fields</th>
                        <th className="px-3 py-2.5 font-medium">Expires</th>
                        <th className="px-3 py-2.5 font-medium">Created</th>
                        <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.map((row) => {
                        const expired =
                          !!row.expires_at && new Date(row.expires_at).getTime() <= Date.now();
                        return (
                        <tr key={row.id} className="border-b border-border/50 last:border-b-0">
                          <td className="px-3 py-2.5 align-middle">
                            <p className="font-medium">{row.name}</p>
                            {row.notes ? (
                              <p className="text-[10px] text-muted-foreground">{row.notes}</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 align-middle font-mono text-[11px]">
                            {row.key_prefix}…
                          </td>
                          <td className="px-3 py-2.5 align-middle">
                            {row.endpoints.join(", ") || "—"}
                          </td>
                          <td
                            className="max-w-[14rem] truncate px-3 py-2.5 align-middle text-muted-foreground"
                            title={row.fields.join(", ")}
                          >
                            {row.fields.join(", ") || "—"}
                          </td>
                          <td
                            className={cn(
                              "whitespace-nowrap px-3 py-2.5 align-middle",
                              expired ? "font-medium text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {row.expires_at
                              ? expired
                                ? `Expired ${formatWhen(row.expires_at)}`
                                : formatWhen(row.expires_at)
                              : "Never"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 align-middle text-muted-foreground">
                            {row.created_at ? formatWhen(row.created_at) : "—"}
                          </td>
                          <td className="px-3 py-2.5 align-middle text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 cursor-pointer text-destructive hover:text-destructive"
                              disabled={busyId === `api-key:${row.id}`}
                              onClick={() => void onRevokeApiKey(row.id)}
                            >
                              Revoke
                            </Button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}

          {tab === "logs" ? (
            <>
              <PanelHeader icon={ScrollText} title="Activity logs">
                <Input
                  value={logQuery}
                  onChange={(e) => setLogQuery(e.target.value)}
                  placeholder="Search by person, action, device…"
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
                  <table className="w-full min-w-[44rem] text-left text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                      <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2.5 font-medium">When</th>
                        <th className="px-3 py-2.5 font-medium">What happened</th>
                        <th className="px-3 py-2.5 font-medium">Who</th>
                        <th className="px-3 py-2.5 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map(({ row, view }) => (
                        <tr key={row.id} className="border-b border-border/50 last:border-b-0">
                          <td className="whitespace-nowrap px-3 py-2.5 align-top text-muted-foreground">
                            {formatWhen(row.occurred_at)}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                                  view.typeClassName,
                                )}
                              >
                                {view.typeLabel}
                              </span>
                              <p className="font-medium text-foreground" title={view.technicalAction}>
                                {view.title}
                              </p>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <p className="leading-4 text-foreground">{view.actorLabel}</p>
                            {view.actorHint ? (
                              <p className="mt-0.5 text-[10px] leading-3 text-muted-foreground">
                                {view.actorHint}
                              </p>
                            ) : null}
                          </td>
                          <td className="max-w-md px-3 py-2.5 align-top text-muted-foreground">
                            {view.details.length ? (
                              <ul className="space-y-0.5">
                                {view.details.map((line) => (
                                  <li key={line} className="leading-4">
                                    {line}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span>—</span>
                            )}
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
