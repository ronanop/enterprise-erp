"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ChevronDown,
  Copy,
  Crown,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
} from "lucide-react";

import { FinanceField, FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { UserAvatar } from "@/components/layout/user-avatar";
import {
  ALL_MODULES_KEY,
  ModuleAssignSelect,
} from "@/components/organization/module-assign-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAuthUser } from "@/hooks/use-auth-user";
import {
  allErpModuleKeys,
  hasAllModulesAdmin,
  isErpAdmin,
  moduleTitle,
} from "@/lib/module-access";
import { hasModuleMemberAssignment, memberOnlyModuleKeys } from "@/lib/module-membership";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  grantModuleAccess,
  issueTemporaryPassword,
  listFoundationUsers,
  revokeModuleAccess,
  syncHrmsUsers,
  updateUserModules,
  type FoundationUser,
  type ModuleAccessRole,
  type TemporaryPassword,
} from "@/services/foundation-users-service";

type TableVariant = "erp" | "admin" | "member";

/** One table row: ERP admins have no moduleKey; admin/member rows are per module. */
type AccessTableRow = {
  user: FoundationUser;
  moduleKey: string | null;
};

const SERVICE_JOB_ROLES = [
  { value: "service_engineer", label: "Service Engineer" },
  { value: "field_engineer", label: "Field Engineer" },
];

function sortByName(users: FoundationUser[]): FoundationUser[] {
  return [...users].sort((a, b) =>
    a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
  );
}

function sortAccessRows(rows: AccessTableRow[]): AccessTableRow[] {
  return [...rows].sort((a, b) => {
    const byName = a.user.display_name.localeCompare(b.user.display_name, undefined, {
      sensitivity: "base",
    });
    if (byName !== 0) return byName;
    const aMod = a.moduleKey === "*" ? "All modules" : a.moduleKey ? moduleTitle(a.moduleKey) : "";
    const bMod = b.moduleKey === "*" ? "All modules" : b.moduleKey ? moduleTitle(b.moduleKey) : "";
    return aMod.localeCompare(bMod, undefined, { sensitivity: "base" });
  });
}

function matchesUserQuery(user: FoundationUser, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const modules = [...(user.assigned_module_keys ?? []), ...(user.admin_module_keys ?? [])];
  return (
    user.display_name.toLowerCase().includes(q) ||
    user.email.toLowerCase().includes(q) ||
    (user.employee_code ?? "").toLowerCase().includes(q) ||
    modules.some((k) => moduleTitle(k).toLowerCase().includes(q))
  );
}

function matchesAccessQuery(row: AccessTableRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (matchesUserQuery(row.user, q)) return true;
  if (!row.moduleKey) return false;
  if (row.moduleKey === "*") return "all modules".includes(q);
  return moduleTitle(row.moduleKey).toLowerCase().includes(q);
}

function isModuleAdminRow(row: FoundationUser): boolean {
  return !isErpAdmin(row.user_type) && (row.admin_module_keys ?? []).length > 0;
}

/** Parent Assets is assigned via IT / Non-IT submodules — hide from access tables. */
const HIDDEN_ACCESS_MODULE_KEYS = new Set(["assets"]);

function expandAdminAccessRows(users: FoundationUser[]): AccessTableRow[] {
  const seen = new Set<string>();
  const out: AccessTableRow[] = [];
  for (const user of users) {
    const keys = user.admin_module_keys ?? [];
    if (hasAllModulesAdmin(keys)) {
      const id = `${user.id}:*`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ user, moduleKey: "*" });
      continue;
    }
    for (const key of keys) {
      if (HIDDEN_ACCESS_MODULE_KEYS.has(key)) continue;
      const id = `${user.id}:${key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ user, moduleKey: key });
    }
  }
  return sortAccessRows(out);
}

function expandMemberAccessRows(users: FoundationUser[]): AccessTableRow[] {
  const seen = new Set<string>();
  const out: AccessTableRow[] = [];
  for (const user of users) {
    for (const key of memberOnlyModuleKeys(
      user.assigned_module_keys ?? [],
      user.admin_module_keys ?? [],
    )) {
      if (HIDDEN_ACCESS_MODULE_KEYS.has(key)) continue;
      const id = `${user.id}:${key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ user, moduleKey: key });
    }
  }
  return sortAccessRows(out);
}

function currentRole(row: FoundationUser | undefined, moduleKey: string): ModuleAccessRole | null {
  if (!row || !moduleKey) return null;
  if (moduleKey === ALL_MODULES_KEY) {
    return hasAllModulesAdmin(row.admin_module_keys ?? []) ? "admin" : null;
  }
  if ((row.admin_module_keys ?? []).includes(moduleKey)) return "admin";
  if ((row.assigned_module_keys ?? []).includes(moduleKey)) return "member";
  return null;
}

function UsersTableCard({
  title,
  icon,
  rows,
  loading,
  emptyLabel,
  variant,
  canEdit,
  busy,
  onResetPassword,
  onAssign,
  onRemove,
  defaultOpen = false,
}: {
  title: string;
  icon: ReactNode;
  rows: AccessTableRow[];
  loading: boolean;
  emptyLabel: string;
  variant: TableVariant;
  canEdit: boolean;
  busy: { userId: string; key: string } | null;
  onResetPassword: (row: FoundationUser) => void;
  onAssign: (row: FoundationUser) => void;
  onRemove: (row: AccessTableRow, variant: TableVariant) => void;
  defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const panelId = useId();
  const filtered = useMemo(() => rows.filter((row) => matchesAccessQuery(row, query)), [rows, query]);
  // An active search always shows results.
  const open = expanded || Boolean(query.trim());
  const showModule = variant === "admin" || variant === "member";
  const colSpan = (showModule ? 4 : 3) + (canEdit ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md text-left transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setExpanded(!open)}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {variant === "admin" ? (
              <p className="truncate text-xs text-muted-foreground">
                Full read and write across all companies for each assigned module
              </p>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, employee id, email, module…"
          className="h-9 w-full min-w-[200px] max-w-xs"
          aria-label={`Search ${title}`}
        />
      </div>

      {open ? (
        <div id={panelId} className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/60 text-xs font-semibold tracking-wide text-foreground uppercase">
                <th className="px-4 py-2.5 text-center">User</th>
                <th className="px-4 py-2.5 text-center">Employee ID</th>
                <th className="px-4 py-2.5 text-center">Email</th>
                {showModule ? <th className="px-4 py-2.5 text-center">Module</th> : null}
                {canEdit ? <th className="px-4 py-2.5 text-center">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-center text-muted-foreground">
                    Loading users…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-center text-muted-foreground">
                    {query.trim() ? "No users match your search." : emptyLabel}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const { user, moduleKey } = row;
                  const busyId = moduleKey ? `${user.id}:${moduleKey}` : user.id;
                  const busyKey = busy?.userId === busyId || busy?.userId === user.id ? busy.key : null;
                  const moduleLabel =
                    moduleKey === "*" ? "All modules" : moduleKey ? moduleTitle(moduleKey) : "—";
                  return (
                    <tr
                      key={`${user.id}:${moduleKey ?? "erp"}`}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="px-4 py-2.5 text-left">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            displayName={user.display_name}
                            size="sm"
                            className="!size-8 !text-[10px]"
                          />
                          <span className="font-medium text-foreground">{user.display_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-left font-mono text-xs text-muted-foreground">
                        {user.employee_code ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-left text-muted-foreground">{user.email}</td>
                      {showModule ? (
                        <td className="px-4 py-2.5 text-left font-medium text-foreground">
                          {moduleLabel}
                        </td>
                      ) : null}
                      {canEdit ? (
                        <td className="px-4 py-2.5 text-left">
                          <div className="inline-flex gap-1.5">
                            {variant !== "erp" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 cursor-pointer gap-1.5"
                                disabled={!user.hrms_valid}
                                title={user.hrms_valid ? undefined : "Not an onboarded HRMS employee"}
                                onClick={() => onAssign(user)}
                              >
                                <UserPlus className="size-3.5" />
                                Assign
                              </Button>
                            ) : null}
                            {variant === "admin" || variant === "member" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 cursor-pointer gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={busyKey === "remove"}
                                title={`Remove ${moduleLabel} access`}
                                aria-label={`Remove ${moduleLabel} access for ${user.display_name}`}
                                onClick={() => onRemove(row, variant)}
                              >
                                <Trash2 className="size-3.5" />
                                {busyKey === "remove" ? "Removing…" : "Remove"}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 cursor-pointer gap-1.5"
                              disabled={busyKey === "password"}
                              title="Issue a temporary password"
                              aria-label={`Issue a temporary password for ${user.display_name}`}
                              onClick={() => onResetPassword(user)}
                            >
                              <KeyRound className="size-3.5" />
                              {busyKey === "password" ? "Issuing…" : "Reset"}
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function AssignAccessCard({
  users,
  selectedUserId,
  onSelectUser,
  onAssigned,
  onError,
  cardRef,
}: {
  users: FoundationUser[];
  selectedUserId: string;
  onSelectUser: (id: string) => void;
  onAssigned: (user: FoundationUser, message: string) => void;
  onError: (message: string) => void;
  cardRef: RefObject<HTMLDivElement | null>;
}) {
  const [moduleKeys, setModuleKeys] = useState<string[]>([]);
  const [role, setRole] = useState<ModuleAccessRole>("member");
  const [jobRole, setJobRole] = useState(SERVICE_JOB_ROLES[0].value);
  const [saving, setSaving] = useState(false);
  const allModules = moduleKeys.includes(ALL_MODULES_KEY);
  const effectiveRole: ModuleAccessRole = allModules ? "admin" : role;
  const concreteKeys = useMemo(
    () => moduleKeys.filter((k) => k && k !== ALL_MODULES_KEY),
    [moduleKeys],
  );

  const employeeOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: `${u.display_name} · ${u.employee_code ?? "—"} (${u.email})`,
      })),
    [users],
  );
  const selected = users.find((u) => u.id === selectedUserId);
  const keysNeedingGrant = useMemo(() => {
    if (!selected || allModules) return concreteKeys;
    return concreteKeys.filter((key) => currentRole(selected, key) !== effectiveRole);
  }, [allModules, concreteKeys, effectiveRole, selected]);
  const unchanged =
    !allModules &&
    concreteKeys.length > 0 &&
    keysNeedingGrant.length === 0;

  function modulesLabel(keys: string[]): string {
    if (keys.length === 0) return "modules";
    const titles = keys.map((k) => moduleTitle(k));
    if (titles.length === 1) return titles[0];
    if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
    return `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;
  }

  async function submit() {
    if (!selected || moduleKeys.length === 0) return;
    if (!allModules && keysNeedingGrant.length === 0) return;
    setSaving(true);
    try {
      let updated: FoundationUser;
      if (allModules) {
        updated = await updateUserModules(selected.id, allErpModuleKeys());
        onAssigned(updated, `${selected.display_name} is now Admin of all modules.`);
      } else {
        updated = await grantModuleAccess(
          selected.id,
          keysNeedingGrant,
          effectiveRole,
          keysNeedingGrant.includes("service") && effectiveRole === "member"
            ? jobRole
            : undefined,
        );
        onAssigned(
          updated,
          `${selected.display_name} is now ${effectiveRole === "admin" ? "Admin" : "User"} of ${modulesLabel(keysNeedingGrant)}.`,
        );
      }
      setModuleKeys([]);
    } catch (err) {
      onError(formatApiError(err, "Could not update module access"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={cardRef}
      className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
      aria-labelledby="assign-access-heading"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UserPlus className="size-4" />
        </div>
        <div>
          <p id="assign-access-heading" className="text-sm font-semibold text-foreground">
            Assign module access
          </p>
          <p className="text-xs text-muted-foreground">
            HRMS onboarded employees ({users.length}). Sync from HRMS after onboard / offboard.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-end">
        <FinanceField label="Employee" htmlFor="assign-user" className="min-w-0">
          <SearchableSelect
            value={selectedUserId}
            onChange={onSelectUser}
            options={employeeOptions}
            placeholder={
              users.length === 0
                ? "No HRMS employees synced yet"
                : `Select employee (${users.length})…`
            }
            searchPlaceholder="Search name, employee id, email…"
            className="h-9"
            allowCustomValue={false}
          />
        </FinanceField>

        <FinanceField label="Modules" htmlFor="assign-module" className="min-w-0">
          <ModuleAssignSelect
            id="assign-module"
            value={moduleKeys}
            onChange={(keys) => {
              setModuleKeys(keys);
              if (keys.includes(ALL_MODULES_KEY)) setRole("admin");
            }}
          />
        </FinanceField>

        <FinanceField label="Role" htmlFor="assign-role" className="min-w-0">
          <FinanceSelect
            id="assign-role"
            className="h-9 bg-background"
            value={effectiveRole}
            disabled={allModules}
            onChange={(e) => setRole(e.target.value as ModuleAccessRole)}
          >
            {!allModules ? <option value="member">User</option> : null}
            <option value="admin">Admin</option>
          </FinanceSelect>
        </FinanceField>

        <Button
          type="button"
          className="h-9 cursor-pointer gap-1.5"
          disabled={
            !selected ||
            moduleKeys.length === 0 ||
            saving ||
            (!allModules && unchanged)
          }
          onClick={() => void submit()}
        >
          <UserPlus className="size-3.5" />
          {saving
            ? "Saving…"
            : !allModules &&
              concreteKeys.length > 0 &&
              keysNeedingGrant.length < concreteKeys.length
              ? "Update access"
              : "Assign"}
        </Button>
      </div>

      {concreteKeys.includes("service") && effectiveRole === "member" ? (
        <FinanceField label="Service team role" htmlFor="assign-service-role" className="mt-3 max-w-xs">
          <FinanceSelect
            id="assign-service-role"
            className="h-9 bg-background"
            value={jobRole}
            onChange={(e) => setJobRole(e.target.value)}
          >
            {SERVICE_JOB_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </FinanceSelect>
        </FinanceField>
      ) : null}

      {selected && moduleKeys.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {allModules ? (
            <>
              Grants <span className="font-medium text-foreground">Admin</span> on all modules
              in one step (single welcome / access email).
            </>
          ) : unchanged ? (
            <>Already has this role on {modulesLabel(concreteKeys)}.</>
          ) : (
            <>
              Will assign{" "}
              <span className="font-medium text-foreground">
                {effectiveRole === "admin" ? "Admin" : "User"}
              </span>{" "}
              on {modulesLabel(keysNeedingGrant)} and send one email with those module names.
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

export function OrganizationUsersPage({
  title = "Organization users",
  backHref,
  backLabel,
}: {
  title?: string;
  backHref?: string;
  backLabel?: string;
} = {}) {
  const { user: sessionUser } = useAuthUser();
  const erpAdmin = isErpAdmin(sessionUser?.userType);
  const [rows, setRows] = useState<FoundationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<TemporaryPassword | null>(null);
  const [busy, setBusy] = useState<{ userId: string; key: string } | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const assignRef = useRef<HTMLDivElement>(null);
  const autoSynced = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listFoundationUsers());
    } catch (err) {
      setRows([]);
      setError(formatApiError(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, []);

  const runSync = useCallback(
    async (manual: boolean) => {
      setSyncing(true);
      if (manual) setError(null);
      try {
        const result = await syncHrmsUsers();
        // Always refresh the assign list so onboard / offboard changes appear immediately.
        await load();
        if (manual || result.created || result.linked || result.updated || result.deactivated) {
          setNotice(
            `HRMS sync: ${result.employee_count} onboarded employees · ${result.created} new logins · ` +
            `${result.linked} linked · ${result.updated} updated · ${result.deactivated} deactivated.`,
          );
        }
      } catch (err) {
        if (manual) setError(formatApiError(err, "HRMS sync failed"));
      } finally {
        setSyncing(false);
      }
    },
    [load],
  );

  // Drop a selected employee from Assign if HRMS sync removed them from the assignable set.
  useEffect(() => {
    if (!assignUserId) return;
    const stillThere = rows.some(
      (r) =>
        r.id === assignUserId &&
        r.hrms_valid &&
        !isErpAdmin(r.user_type) &&
        r.status !== "inactive",
    );
    if (!stillThere) setAssignUserId("");
  }, [rows, assignUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!erpAdmin || autoSynced.current) return;
    autoSynced.current = true;
    void runSync(false);
  }, [erpAdmin, runSync]);

  function mergeUser(updated: FoundationUser) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === updated.id
          ? {
            ...r,
            assigned_module_keys: updated.assigned_module_keys,
            admin_module_keys: updated.admin_module_keys,
            status: updated.status,
          }
          : r,
      ),
    );
  }

  async function resetPassword(row: FoundationUser) {
    setBusy({ userId: row.id, key: "password" });
    setError(null);
    try {
      setTempPassword(await issueTemporaryPassword(row.id));
    } catch (err) {
      setError(formatApiError(err, "Could not issue a temporary password"));
    } finally {
      setBusy(null);
    }
  }

  async function removeAccess(row: AccessTableRow, variant: TableVariant) {
    if (variant !== "admin" && variant !== "member") return;
    const { user, moduleKey } = row;
    if (!moduleKey) return;
    const moduleLabel = moduleKey === "*" ? "all modules" : moduleTitle(moduleKey);
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Remove ${user.display_name}'s access to ${moduleLabel}?`)
    ) {
      return;
    }
    setBusy({ userId: `${user.id}:${moduleKey}`, key: "remove" });
    setError(null);
    setNotice(null);
    try {
      let updated: FoundationUser;
      if (variant === "admin") {
        updated =
          moduleKey === "*"
            ? await updateUserModules(user.id, [])
            : await updateUserModules(
              user.id,
              (user.admin_module_keys ?? []).filter((key) => key !== moduleKey),
            );
      } else {
        updated = await revokeModuleAccess(user.id, moduleKey);
      }
      mergeUser(updated);
      setNotice(`Removed ${user.display_name}'s access to ${moduleLabel}.`);
    } catch (err) {
      setError(formatApiError(err, "Could not remove access"));
    } finally {
      setBusy(null);
    }
  }

  function startAssign(row: FoundationUser) {
    setAssignUserId(row.id);
    assignRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const erpAdmins = useMemo(
    () =>
      sortAccessRows(
        sortByName(rows.filter((r) => isErpAdmin(r.user_type))).map((user) => ({
          user,
          moduleKey: null,
        })),
      ),
    [rows],
  );
  const moduleAdmins = useMemo(
    () => expandAdminAccessRows(rows.filter(isModuleAdminRow)),
    [rows],
  );
  const moduleUsers = useMemo(
    () =>
      expandMemberAccessRows(
        rows.filter((r) =>
          hasModuleMemberAssignment(r.user_type, r.assigned_module_keys ?? [], r.admin_module_keys ?? []),
        ),
      ),
    [rows],
  );
  const assignable = useMemo(
    () => sortByName(rows.filter((r) => r.hrms_valid && !isErpAdmin(r.user_type) && r.status !== "inactive")),
    [rows],
  );

  const tableProps = {
    loading,
    canEdit: erpAdmin,
    busy,
    onResetPassword: (row: FoundationUser) => void resetPassword(row),
    onAssign: startAssign,
    onRemove: (row: AccessTableRow, variant: TableVariant) => void removeAccess(row, variant),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        backHref={backHref}
        backLabel={backLabel}
        actions={
          erpAdmin ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 cursor-pointer gap-1.5"
              disabled={syncing}
              onClick={() => void runSync(true)}
            >
              <RefreshCw className={cn("size-3.5", syncing && "animate-spin motion-reduce:animate-none")} />
              {syncing ? "Syncing HRMS…" : "Sync from HRMS"}
            </Button>
          ) : null
        }
      />

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      {tempPassword ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            Temporary password for <span className="font-semibold">{tempPassword.display_name}</span> (
            {tempPassword.email}):{" "}
            <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[13px]">
              {tempPassword.temporary_password}
            </code>{" "}
            — share it securely. They must change it after signing in.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 cursor-pointer gap-1.5 bg-white/70"
              onClick={() => void navigator.clipboard?.writeText(tempPassword.temporary_password)}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 cursor-pointer"
              onClick={() => setTempPassword(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      {erpAdmin ? (
        <AssignAccessCard
          cardRef={assignRef}
          users={assignable}
          selectedUserId={assignUserId}
          onSelectUser={setAssignUserId}
          onAssigned={(updated, message) => {
            mergeUser(updated);
            setError(null);
            setNotice(message);
          }}
          onError={(message) => {
            setNotice(null);
            setError(message);
          }}
        />
      ) : null}

      <UsersTableCard
        {...tableProps}
        title="ERP admins"
        icon={<Crown className="size-4" />}
        rows={erpAdmins}
        emptyLabel="No ERP admins found."
        variant="erp"
      />
      <UsersTableCard
        {...tableProps}
        title="Module admin users"
        icon={<ShieldCheck className="size-4" />}
        rows={moduleAdmins}
        emptyLabel="No module admins assigned yet."
        variant="admin"
        defaultOpen
      />
      <UsersTableCard
        {...tableProps}
        title="Module users"
        icon={<UserRound className="size-4" />}
        rows={moduleUsers}
        emptyLabel="No module users assigned yet."
        variant="member"
      />
    </div>
  );
}
