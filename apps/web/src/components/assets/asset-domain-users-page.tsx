"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserPlus, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ASSETS_ACCENT_BTN,
  ASSETS_SURFACE_CARD,
  AssetsPremiumPage,
} from "@/components/assets/shared/premium-surface";
import { ApiClientError } from "@/services/api-client";
import {
  createDomainMembership,
  deactivateDomainMembership,
  fetchMyDomainAccess,
  listAssignableDomainUsers,
  listDomainMemberships,
  updateDomainMembershipRole,
  type AssetDomain,
  type DomainMembershipRecord,
  type DomainMembershipRole,
  type DomainMembershipUserOption,
} from "@/services/asset-domain-membership-service";

function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function parseDomain(raw: string | null): AssetDomain {
  const v = (raw || "").toUpperCase();
  return v === "NON_IT" ? "NON_IT" : "IT";
}

function domainLabel(domain: AssetDomain): string {
  return domain === "IT" ? "IT Assets" : "Non-IT Assets";
}

export function AssetDomainUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scopedDomain = parseDomain(searchParams.get("domain"));

  const [isModuleAdmin, setIsModuleAdmin] = useState(false);
  const [adminDomains, setAdminDomains] = useState<string[]>([]);
  const [accessChecked, setAccessChecked] = useState(false);

  const [rows, setRows] = useState<DomainMembershipRecord[]>([]);
  const [options, setOptions] = useState<DomainMembershipUserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<DomainMembershipRole>("member");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignableError, setAssignableError] = useState<string | null>(null);

  const canManageScoped = useMemo(() => {
    if (isModuleAdmin) return true;
    return adminDomains.map((d) => d.toUpperCase()).includes(scopedDomain);
  }, [isModuleAdmin, adminDomains, scopedDomain]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchMyDomainAccess();
        if (!cancelled) {
          setIsModuleAdmin(me.is_module_admin);
          setAdminDomains(me.admin_domains ?? []);
          if (!me.is_module_admin) setSelectedRole("member");
        }
      } catch {
        if (!cancelled) {
          setIsModuleAdmin(false);
          setAdminDomains([]);
          setSelectedRole("member");
        }
      } finally {
        if (!cancelled) setAccessChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (accessChecked && !canManageScoped) {
      router.replace(scopedDomain === "NON_IT" ? "/assets/non-it" : "/assets");
    }
  }, [accessChecked, canManageScoped, router, scopedDomain]);

  const loadMemberships = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const members = await listDomainMemberships(scopedDomain);
      setRows(members);
    } catch (err) {
      setRows([]);
      setError(formatApiError(err, "Failed to load domain memberships"));
    } finally {
      setLoading(false);
    }
  }, [scopedDomain]);

  const loadAssignable = useCallback(async () => {
    setAssignableError(null);
    try {
      const assignable = await listAssignableDomainUsers();
      setOptions(assignable);
      setSelectedUserId("");
    } catch (err) {
      setOptions([]);
      setAssignableError(formatApiError(err, "Failed to load assignable users"));
    }
  }, []);

  useEffect(() => {
    if (!accessChecked || !canManageScoped) return;
    void loadMemberships();
    void loadAssignable();
  }, [accessChecked, canManageScoped, loadMemberships, loadAssignable]);

  const assignedIds = useMemo(
    () => new Set(rows.map((r) => `${r.user_id}:${r.domain}`)),
    [rows],
  );

  const assignableForDomain = useMemo(
    () => options.filter((o) => !assignedIds.has(`${o.user_id}:${scopedDomain}`)),
    [options, assignedIds, scopedDomain],
  );

  /** Admin role only for global asset.module:admin — domain admins see Member only. */
  const roleChoices: DomainMembershipRole[] = isModuleAdmin
    ? ["member", "admin"]
    : ["member"];

  async function onAssign() {
    if (!selectedUserId) return;
    setSaving(true);
    setError(null);
    try {
      await createDomainMembership({
        user_id: selectedUserId,
        domain: scopedDomain,
        role: isModuleAdmin ? selectedRole : "member",
      });
      await Promise.all([loadMemberships(), loadAssignable()]);
    } catch (err) {
      setError(formatApiError(err, "Failed to assign user"));
    } finally {
      setSaving(false);
    }
  }

  async function onChangeRole(id: string, role: DomainMembershipRole) {
    setSaving(true);
    setError(null);
    try {
      await updateDomainMembershipRole(id, role);
      await loadMemberships();
    } catch (err) {
      setError(formatApiError(err, "Failed to change role"));
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id: string) {
    setSaving(true);
    setError(null);
    try {
      await deactivateDomainMembership(id);
      await Promise.all([loadMemberships(), loadAssignable()]);
    } catch (err) {
      setError(formatApiError(err, "Failed to remove membership"));
    } finally {
      setSaving(false);
    }
  }

  if (!accessChecked) {
    return <p className="text-sm text-muted-foreground">Checking access…</p>;
  }
  if (!canManageScoped) {
    return null;
  }

  return (
    <AssetsPremiumPage>
      <PageHeader
        title={`${scopedDomain === "IT" ? "IT" : "Non-IT"} domain users`}
        description={
          isModuleAdmin
            ? "Assign ERP users as admin or member for this domain."
            : "Assign ERP users as members for this domain. Only module admins can grant domain admin."
        }
      />

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {assignableError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {assignableError}
        </div>
      ) : null}

      <div
        className={`flex flex-wrap items-end gap-3 rounded-xl p-4 ${ASSETS_SURFACE_CARD}`}
      >
        <div className="min-w-[180px] flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="domain-user">
            User
          </label>
          <select
            id="domain-user"
            className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-sm"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">
              {options.length === 0 ? "No users available…" : "Select user…"}
            </option>
            {assignableForDomain.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.display_name} ({u.email})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Domain</p>
          <p
            className="flex h-9 items-center rounded-md border border-border/70 bg-muted/40 px-3 text-sm font-medium text-foreground"
            aria-readonly="true"
          >
            {domainLabel(scopedDomain)}
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="role-pick">
            Role
          </label>
          {roleChoices.length === 1 ? (
            <p
              className="flex h-9 items-center rounded-md border border-border/70 bg-muted/40 px-3 text-sm font-medium text-foreground"
              aria-readonly="true"
            >
              Member
            </p>
          ) : (
            <select
              id="role-pick"
              className="h-9 cursor-pointer rounded-md border border-input bg-background px-2 text-sm"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as DomainMembershipRole)}
            >
              {roleChoices.map((r) => (
                <option key={r} value={r}>
                  {r === "admin" ? "Admin" : "Member"}
                </option>
              ))}
            </select>
          )}
        </div>
        <Button
          type="button"
          className={`h-10 ${ASSETS_ACCENT_BTN}`}
          disabled={!selectedUserId || saving}
          onClick={() => void onAssign()}
        >
          <UserPlus className="size-3.5" />
          Assign
        </Button>
      </div>

      <div className={`rounded-xl ${ASSETS_SURFACE_CARD}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[rgba(3,105,161,0.1)] text-[#0369A1]">
              <Users className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Memberships</p>
              <p className="text-[11px] text-muted-foreground">
                {loading ? "Loading…" : `${rows.length} assignment${rows.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/60 text-xs font-semibold tracking-wide text-foreground uppercase">
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Domain</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    No domain memberships yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
                          aria-hidden
                        >
                          {initials(row.display_name ?? row.email ?? "?")}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.display_name ?? "—"}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{row.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary">{row.domain === "IT" ? "IT" : "Non-IT"}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {isModuleAdmin ? (
                        <select
                          className="h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-xs"
                          value={row.role}
                          disabled={saving}
                          onChange={(e) =>
                            void onChangeRole(row.id, e.target.value as DomainMembershipRole)
                          }
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className="text-xs capitalize text-muted-foreground">{row.role}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer text-destructive hover:text-destructive"
                        disabled={saving || (row.role === "admin" && !isModuleAdmin)}
                        onClick={() => void onRemove(row.id)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AssetsPremiumPage>
  );
}
