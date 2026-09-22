"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, Plus, RefreshCw, Search } from "lucide-react";

import { AssignmentCheckboxCell } from "@/components/organization/assignment-checkbox-cell";
import { UserAvatar } from "@/components/layout/user-avatar";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listCompanyAssignmentOptions,
  listDepartmentAssignmentOptions,
  listRoleOptions,
  ORG_EMAIL_DOMAIN,
  replaceUserCompanyScopes,
  replaceUserRoles,
  updateUserDepartment,
  type AssignmentOption,
  type FoundationUser,
} from "@/services/foundation-users-service";

type OrganizationMembersProps = {
  rows: FoundationUser[];
  loading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  canManageMembers?: boolean;
  syncing?: boolean;
  adding?: boolean;
  syncMessage?: string | null;
  syncError?: string | null;
  onSyncM365?: () => void;
  onAddMember?: (input: { email: string; display_name: string }) => Promise<void> | void;
  onMemberUpdated?: (user: FoundationUser) => void;
};

/**
 * Organization members roster with department / role / hierarchy assignment.
 */
export function OrganizationMembers({
  rows,
  loading,
  query,
  onQueryChange,
  canManageMembers = false,
  syncing = false,
  adding = false,
  syncMessage = null,
  syncError = null,
  onSyncM365,
  onAddMember,
  onMemberUpdated,
}: OrganizationMembersProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [emailLocal, setEmailLocal] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<AssignmentOption[]>([]);
  const [roles, setRoles] = useState<AssignmentOption[]>([]);
  const [companies, setCompanies] = useState<AssignmentOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [deptOpts, roleOpts, companyOpts] = await Promise.all([
        listDepartmentAssignmentOptions(),
        listRoleOptions(),
        listCompanyAssignmentOptions(),
      ]);
      if (cancelled) return;
      setDepartments(deptOpts);
      setRoles(roleOpts);
      setCompanies(companyOpts);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const countLabel = loading
    ? "Loading…"
    : `${rows.length} organization member${rows.length === 1 ? "" : "s"}`;

  async function submitAdd() {
    if (!onAddMember) return;
    setFormError(null);
    const name = displayName.trim();
    const local = emailLocal.trim().toLowerCase().replace(/@.*$/, "");
    if (!name) {
      setFormError("Display name is required.");
      return;
    }
    if (!local) {
      setFormError("Email is required.");
      return;
    }
    const email = `${local}@${ORG_EMAIL_DOMAIN}`;
    try {
      await onAddMember({ email, display_name: name });
      setDisplayName("");
      setEmailLocal("");
      setShowAdd(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add member.");
    }
  }

  return (
    <section
      aria-labelledby="organization-members-heading"
      className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
      data-testid="organization-members"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/25 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-foreground">
            <Building2 className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="organization-members-heading"
                className="text-sm font-semibold tracking-tight text-foreground"
              >
                Organization members
              </h2>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {countLabel}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Assign department, roles, and hierarchy for @{ORG_EMAIL_DOMAIN} users. Sync from Microsoft
              365 or add manually.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {onAddMember ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
              disabled={adding || loading || !canManageMembers}
              title={
                canManageMembers
                  ? "Add an organization member"
                  : "You need permission to add members"
              }
              onClick={() => {
                if (!canManageMembers) return;
                setFormError(null);
                setShowAdd((v) => !v);
              }}
            >
              <Plus className="size-3.5" aria-hidden />
              Add member
            </Button>
          ) : null}
          {onSyncM365 ? (
            <Button
              type="button"
              size="sm"
              className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
              disabled={syncing || loading || adding}
              onClick={onSyncM365}
              aria-label={`Sync @${ORG_EMAIL_DOMAIN} users from Microsoft 365`}
              data-testid="organization-members-sync-m365"
            >
              {syncing ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-3.5" aria-hidden />
              )}
              {syncing ? "Syncing…" : "Sync with M365"}
            </Button>
          ) : null}
          <div className="relative w-full min-w-[200px] max-w-xs flex-1 sm:w-auto sm:flex-none">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground/70"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search members…"
              className="h-9 border-border/80 bg-background pl-8 transition-colors duration-200"
              aria-label="Search organization members"
            />
          </div>
        </div>
      </div>

      {showAdd ? (
        <div className="space-y-3 border-b border-border/70 bg-background px-4 py-3">
          <p className="text-[12px] font-medium text-foreground">New organization member</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="h-9"
              aria-label="Member display name"
              disabled={adding}
            />
            <div className="flex items-center gap-1.5">
              <Input
                value={emailLocal}
                onChange={(e) => setEmailLocal(e.target.value.replace(/@.*/, ""))}
                placeholder="email"
                className="h-9"
                aria-label="Member email local part"
                disabled={adding}
              />
              <span className="shrink-0 text-[12px] text-muted-foreground">@{ORG_EMAIL_DOMAIN}</span>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
              disabled={adding}
              onClick={() => void submitAdd()}
            >
              {adding ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              {adding ? "Adding…" : "Save"}
            </Button>
          </div>
          {formError ? <p className="text-[12px] text-destructive">{formError}</p> : null}
        </div>
      ) : null}

      {syncError ? (
        <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[12px] text-destructive">
          {syncError}
        </div>
      ) : null}
      {syncMessage && !syncError ? (
        <div className="border-b border-border/70 bg-muted/20 px-4 py-2.5 text-[12px] text-muted-foreground">
          {syncMessage}
        </div>
      ) : null}

      <div className="erp-scroll overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              <th className="px-4 py-2.5">Member</th>
              <th className="px-4 py-2.5">Department</th>
              <th className="px-4 py-2.5">Roles</th>
              <th className="px-4 py-2.5">Hierarchy</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Loading organization members…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {query.trim()
                      ? "No organization members match your search."
                      : `No @${ORG_EMAIL_DOMAIN} users yet.`}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {query.trim()
                      ? "Try a different name or email."
                      : canManageMembers
                        ? "Add a member or sync from Microsoft 365."
                        : "Ask an administrator to add or sync members."}
                  </p>
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
                      <UserAvatar
                        displayName={row.display_name}
                        size="sm"
                        className="!size-8 !text-[10px]"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{row.display_name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{row.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <AssignmentCheckboxCell
                      label="Department"
                      options={departments}
                      selectedIds={row.department_id ? [row.department_id] : []}
                      canEdit={canManageMembers}
                      single
                      emptyLabel="Unassigned"
                      onSave={async (ids) => {
                        const updated = await updateUserDepartment(row.id, ids[0] ?? null);
                        onMemberUpdated?.(updated);
                      }}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <AssignmentCheckboxCell
                      label="Roles"
                      options={roles}
                      selectedIds={row.role_ids ?? []}
                      canEdit={canManageMembers}
                      emptyLabel="No roles"
                      onSave={async (ids) => {
                        const updated = await replaceUserRoles(row.id, ids);
                        onMemberUpdated?.(updated);
                      }}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <AssignmentCheckboxCell
                      label="Hierarchy"
                      options={companies}
                      selectedIds={row.company_ids ?? []}
                      canEdit={canManageMembers}
                      emptyLabel="No companies"
                      onSave={async (ids) => {
                        const updated = await replaceUserCompanyScopes(row.id, ids);
                        onMemberUpdated?.(updated);
                      }}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <FinanceStatusBadge status={row.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
