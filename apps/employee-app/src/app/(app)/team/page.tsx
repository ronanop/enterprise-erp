"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SubHeader } from "@/components/app-header";
import { ManagerRouteGuard } from "@/components/manager-route-guard";
import { IconMail, IconPhone, IconUsers } from "@/components/icons";
import { AlertBox, Avatar, EmptyState } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssTeamMember } from "@/types/api";

function statusLabel(status: string | null | undefined): string {
  if (!status) return "Active";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TeamPage() {
  const [rows, setRows] = useState<EssTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    essService
      .teamMembers()
      .then((res) => {
        if (!cancelled) {
          setRows(res.data ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load team members",
          );
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ManagerRouteGuard>
      <div className="space-y-4 pb-4">
        <SubHeader title="My Team" backHref="/home" />

        <p className="px-0.5 text-sm leading-relaxed text-[#64748B]">
          People who report to you in HRMS.
        </p>

        {error ? <AlertBox>{error}</AlertBox> : null}

        {loading ? (
          <EmptyState title="Loading team…" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No direct reports"
            description="When HR assigns employees under you, they will appear here."
          />
        ) : (
          <ul className="space-y-2.5">
            {rows.map((member) => (
              <li
                key={member.employee_id}
                className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={member.display_name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-bold text-[#0b1c30]">
                          {member.display_name}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-medium text-[#64748B]">
                          {member.designation || "—"}
                          {member.department_name
                            ? ` · ${member.department_name}`
                            : ""}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#15803d]">
                        {statusLabel(member.status)}
                      </span>
                    </div>
                    <p className="mt-2 inline-flex rounded-full bg-[#eff4ff] px-2 py-0.5 text-[11px] font-semibold text-[#2563eb]">
                      {member.employee_code}
                    </p>
                    <div className="mt-2.5 space-y-1.5 text-xs text-[#475569]">
                      <p className="flex items-center gap-1.5 truncate">
                        <IconMail size={14} className="shrink-0 text-[#94a3b8]" />
                        <span className="truncate">{member.email || "—"}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <IconPhone size={14} className="shrink-0 text-[#94a3b8]" />
                        {member.mobile || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/approvals"
          className="flex items-center justify-center gap-2 rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 text-sm font-bold text-[#004ac6] transition active:scale-[0.99]"
        >
          <IconUsers size={18} />
          Open team approvals
        </Link>
      </div>
    </ManagerRouteGuard>
  );
}
