"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, Building2, CalendarDays, Leaf, MapPin, RefreshCw, UserRound } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { UserAvatar } from "@/components/layout/user-avatar";
import {
  DetailGrid,
  DetailItem,
  WorkspacePage,
  WorkspaceSection,
} from "@/components/shared/workspace-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatApiError } from "@/services/api-client";
import {
  getHrmsUserProfile,
  refreshHrmsUserProfile,
  type HrmsUserProfile,
} from "@/services/hrms-integration-service";

function dash(value: string | null | undefined) {
  const text = (value || "").trim();
  return text || "—";
}

function formatWhen(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export function HrmsUserProfilePage({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [profile, setProfile] = useState<HrmsUserProfile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getHrmsUserProfile(userId);
      setProfile(data);
      setNotice(
        data.leave_refreshed
          ? "Profile loaded · leave balances refreshed from HRMS"
          : "Profile loaded · leave balances could not be refreshed (showing saved)",
      );
    } catch (err) {
      setError(formatApiError(err, "Failed to load user profile"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      const data = await refreshHrmsUserProfile(userId);
      setProfile(data);
      setNotice("Full profile refreshed from HRMS and saved.");
    } catch (err) {
      setError(formatApiError(err, "Could not refresh profile"));
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && !profile) {
    return (
      <WorkspacePage>
        <PageHeader
          title="User profile"
          description="Loading…"
          backHref="/organization/users"
          backLabel="Users"
        />
      </WorkspacePage>
    );
  }

  if (!profile) {
    return (
      <WorkspacePage>
        <PageHeader
          title="User profile"
          description="Unavailable"
          backHref="/organization/users"
          backLabel="Users"
        />
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}
        <Button
          type="button"
          className="cursor-pointer transition-colors duration-200"
          onClick={() => void load()}
        >
          Retry
        </Button>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage>
      <PageHeader
        title={profile.display_name || profile.employee_code}
        description={`${profile.employee_code} · ${dash(profile.designation)} · ${dash(profile.department)}`}
        backHref="/organization/users"
        backLabel="Users"
        actions={
          <Button
            type="button"
            variant="outline"
            className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
            disabled={refreshing}
            onClick={() => void onRefresh()}
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh profile"}
          </Button>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </div>
      ) : null}

      <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar displayName={profile.display_name} size="md" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {profile.display_name}
              </h2>
              <Badge variant="secondary" className="uppercase tracking-wide">
                {profile.status}
              </Badge>
              {profile.is_manager ? (
                <Badge variant="outline" className="tracking-wide">
                  Manager
                </Badge>
              ) : null}
            </div>
            <p className="font-mono text-xs text-muted-foreground">{profile.employee_code}</p>
            <p className="text-sm text-muted-foreground">
              {dash(profile.email)} · {dash(profile.mobile)}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Profile saved {formatWhen(profile.profile_fetched_at)}</p>
            <p>Leave refreshed {formatWhen(profile.leave_fetched_at)}</p>
          </div>
        </div>
      </section>

      <WorkspaceSection title="Employment" icon={Briefcase}>
        <DetailGrid>
          <DetailItem label="Designation">{dash(profile.designation)}</DetailItem>
          <DetailItem label="Department">{dash(profile.department)}</DetailItem>
          <DetailItem label="Employment type">{dash(profile.employment_type)}</DetailItem>
          <DetailItem label="Company">{dash(profile.company)}</DetailItem>
          <DetailItem label="Branch">{dash(profile.branch)}</DetailItem>
          <DetailItem label="Work location">{dash(profile.work_location)}</DetailItem>
          <DetailItem label="Manager">
            {dash(profile.manager)}
            {profile.manager_code ? (
              <span className="ml-1 font-mono text-xs text-muted-foreground">
                ({profile.manager_code})
              </span>
            ) : null}
          </DetailItem>
          <DetailItem label="Date of joining">{dash(profile.date_of_joining)}</DetailItem>
          <DetailItem label="Date of leaving">{dash(profile.date_of_leaving)}</DetailItem>
        </DetailGrid>
      </WorkspaceSection>

      <WorkspaceSection title="Personal" icon={UserRound}>
        <DetailGrid>
          <DetailItem label="First name">{dash(profile.first_name)}</DetailItem>
          <DetailItem label="Last name">{dash(profile.last_name)}</DetailItem>
          <DetailItem label="Gender">{dash(profile.gender)}</DetailItem>
          <DetailItem label="Date of birth">{dash(profile.date_of_birth)}</DetailItem>
          <DetailItem label="Email">{dash(profile.email)}</DetailItem>
          <DetailItem label="Mobile">{dash(profile.mobile)}</DetailItem>
        </DetailGrid>
      </WorkspaceSection>

      <WorkspaceSection
        title="Leave balances"
        subtitle="Always refreshed from HRMS when this page opens"
        icon={Leaf}
        badge={
          <span className="tabular-nums text-xs text-muted-foreground">
            Available {profile.leave_balance_total} · Used {profile.leave_used_total}
          </span>
        }
      >
        {profile.leave_balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leave balance rows returned.</p>
        ) : (
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/60 text-xs font-semibold tracking-wide text-foreground uppercase">
                  <th className="px-3 py-2">Leave type</th>
                  <th className="px-3 py-2 text-right">Opening</th>
                  <th className="px-3 py-2 text-right">Accrued</th>
                  <th className="px-3 py-2 text-right">Used</th>
                  <th className="px-3 py-2 text-right">Closing</th>
                  <th className="px-3 py-2 text-right">Year</th>
                </tr>
              </thead>
              <tbody>
                {profile.leave_balances.map((row) => (
                  <tr
                    key={`${row.leave_type_code}-${row.year ?? "na"}`}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{row.leave_type_name || "—"}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {row.leave_type_code || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.opening_balance}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.accrued}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.used}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {row.closing_balance}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.year ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Location & org labels" icon={Building2}>
        <DetailGrid>
          <DetailItem label="Company">{dash(profile.company)}</DetailItem>
          <DetailItem label="Branch">{dash(profile.branch)}</DetailItem>
          <DetailItem label="Work location">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
              {dash(profile.work_location)}
            </span>
          </DetailItem>
          <DetailItem label="Synced timestamps">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden />
              Profile {formatWhen(profile.profile_fetched_at)} · Leave{" "}
              {formatWhen(profile.leave_fetched_at)}
            </span>
          </DetailItem>
        </DetailGrid>
      </WorkspaceSection>
    </WorkspacePage>
  );
}
