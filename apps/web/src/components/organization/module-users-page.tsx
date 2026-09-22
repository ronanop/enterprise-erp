"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Users } from "lucide-react";

import { UserAvatar } from "@/components/layout/user-avatar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canManageModuleUsers, moduleTitle } from "@/lib/module-access";
import { formatApiError } from "@/services/api-client";
import {
  addModuleMember,
  listAssignableModuleUsers,
  listModuleMembers,
  removeModuleMember,
  updateModuleMemberServiceRole,
  type ModuleUserOption,
  type ModuleUserRecord,
  type ServiceJobRole,
} from "@/services/module-users-service";

type Props = {
  moduleKey: string;
};

const SERVICE_JOB_ROLE_OPTIONS: { value: ServiceJobRole; label: string }[] = [
  { value: "service_engineer", label: "Service Engineer" },
  { value: "field_engineer", label: "Field Engineer" },
];

const selectClassName =
  "h-9 min-w-[180px] cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

export function ModuleUsersPage({ moduleKey }: Props) {
  const router = useRouter();
  const { user, adminModuleKeys, loading: authLoading } = useAuthUser();
  const allowed = canManageModuleUsers(moduleKey, adminModuleKeys, user?.userType);
  const title = moduleTitle(moduleKey);
  const isService = moduleKey === "service";

  const [members, setMembers] = useState<ModuleUserRecord[]>([]);
  const [options, setOptions] = useState<ModuleUserOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedJobRole, setSelectedJobRole] = useState<ServiceJobRole>("service_engineer");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [memberRows, assignable] = await Promise.all([
        listModuleMembers(moduleKey),
        listAssignableModuleUsers(moduleKey),
      ]);
      setMembers(memberRows);
      setOptions(assignable);
      setSelectedId("");
      setSelectedJobRole("service_engineer");
    } catch (err) {
      setMembers([]);
      setOptions([]);
      setError(formatApiError(err, "Failed to load module users"));
    } finally {
      setLoading(false);
    }
  }, [moduleKey]);

  useEffect(() => {
    if (authLoading) return;
    if (!allowed) {
      router.replace(`/${moduleKey}`);
      return;
    }
    void load();
  }, [allowed, authLoading, load, moduleKey, router]);

  async function assignSelected() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await addModuleMember(
        moduleKey,
        selectedId,
        isService ? selectedJobRole : undefined,
      );
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not assign user"));
    } finally {
      setSaving(false);
    }
  }

  async function changeServiceRole(userId: string, nextRole: ServiceJobRole) {
    setUpdatingUserId(userId);
    setError(null);
    try {
      const updated = await updateModuleMemberServiceRole(moduleKey, userId, nextRole);
      setMembers((prev) =>
        prev.map((row) => (row.user_id === userId ? { ...row, ...updated } : row)),
      );
    } catch (err) {
      setError(formatApiError(err, "Could not update role"));
      await load();
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function removeUser(userId: string) {
    setSaving(true);
    setError(null);
    try {
      await removeModuleMember(moduleKey, userId);
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not remove user"));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !allowed) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={isService ? "Service team" : "Users"}
        description={
          isService
            ? "As Service Head, assign Entra users and set their role to Service Engineer or Field Engineer. Module admins (Service Head) are set by the ERP admin under Organization → Users."
            : `Assign Entra users to ${title}. Assigned users see this module in their ERP menu. Users who already have ${title} are hidden from the dropdown.`
        }
      />

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isService ? "Service team members" : "Module users"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {loading ? "Loading…" : `${members.length} assigned`}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`${moduleKey}-assign-user`}>
              Select Entra user
            </label>
            <select
              id={`${moduleKey}-assign-user`}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={loading || saving || options.length === 0}
              className={`${selectClassName} min-w-[220px]`}
            >
              <option value="">
                {options.length === 0 ? "No unassigned Entra users" : "Select Entra user…"}
              </option>
              {options.map((row) => (
                <option key={row.user_id} value={row.user_id}>
                  {row.display_name} ({row.email})
                </option>
              ))}
            </select>
            {isService ? (
              <>
                <label className="sr-only" htmlFor={`${moduleKey}-assign-role`}>
                  Select role
                </label>
                <select
                  id={`${moduleKey}-assign-role`}
                  value={selectedJobRole}
                  onChange={(e) => setSelectedJobRole(e.target.value as ServiceJobRole)}
                  disabled={loading || saving}
                  className={selectClassName}
                >
                  {SERVICE_JOB_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="h-9 cursor-pointer"
              disabled={!selectedId || saving}
              onClick={() => void assignSelected()}
            >
              <UserPlus className="size-3.5" />
              {saving ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/60 text-xs font-semibold tracking-wide text-foreground uppercase">
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Loading users…
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No users assigned to this module yet.
                  </td>
                </tr>
              ) : (
                members.map((row) => {
                  const jobRole: ServiceJobRole =
                    row.service_job_role === "field_engineer"
                      ? "field_engineer"
                      : "service_engineer";
                  return (
                    <tr
                      key={row.user_id}
                      className="border-b border-border/50 last:border-0 hover:bg-accent/30"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            displayName={row.display_name}
                            size="sm"
                            className="!size-8 !text-[10px]"
                          />
                          <span className="font-medium text-foreground">{row.display_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.email}</td>
                      <td className="px-4 py-2.5">
                        {row.role === "admin" ? (
                          <Badge variant="secondary" className="font-normal">
                            Module admin
                          </Badge>
                        ) : isService ? (
                          <select
                            aria-label={`Role for ${row.display_name}`}
                            value={jobRole}
                            disabled={saving || updatingUserId === row.user_id}
                            onChange={(e) =>
                              void changeServiceRole(
                                row.user_id,
                                e.target.value as ServiceJobRole,
                              )
                            }
                            className="h-8 min-w-[160px] cursor-pointer rounded-md border border-input bg-background px-2 text-sm outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {SERVICE_JOB_ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant="outline" className="font-normal">
                            User
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-muted-foreground">{row.status}</td>
                      <td className="px-4 py-2.5 text-right">
                        {row.role === "admin" ? (
                          <span className="text-xs text-muted-foreground">Assigned by ERP admin</span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 cursor-pointer"
                            disabled={saving || updatingUserId === row.user_id}
                            onClick={() => void removeUser(row.user_id)}
                          >
                            Remove
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
