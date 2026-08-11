"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AppHeader,
  FilterChips,
  SearchField,
} from "@/components/app-header";
import { IconCalendar } from "@/components/icons";
import { AiFab, AlertBox, EmptyState } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssLeaveRequest, EssLeaveType, EssMe } from "@/types/api";
import * as ui from "@/theme/classes";

const FILTERS = ["All", "Approved", "Pending", "Rejected"];

export default function LeaveHistoryPage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [types, setTypes] = useState<EssLeaveType[]>([]);
  const [rows, setRows] = useState<EssLeaveRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    Promise.all([
      essService.leaveRequests(),
      essService.leaveTypes(),
      essService.me(),
    ])
      .then(([req, typ, meRes]) => {
        setRows(req.data ?? []);
        setTypes(typ.data ?? []);
        setMe(meRes.data);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load leave history",
        ),
      );
  }, []);

  const typeName = (id: string) =>
    types.find((t) => t.id === id)?.leave_type_name ?? "Leave";

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const name = typeName(r.leave_type_id).toLowerCase();
      const status = r.status.toLowerCase();
      const q = query.trim().toLowerCase();
      if (q && !`${name} ${status} ${r.start_date}`.includes(q)) return false;
      if (filter === "Approved") return status === "approved";
      if (filter === "Pending")
        return ["submitted", "draft", "pending"].includes(status);
      if (filter === "Rejected") return status === "rejected";
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, filter, types]);

  const groups = useMemo(() => groupByMonth(filtered), [filtered]);

  return (
    <div className="space-y-5">
      <AppHeader title="Leave History" name={me?.display_name} />

      {error ? <AlertBox>{error}</AlertBox> : null}

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search requests..."
      />
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      {groups.length === 0 ? (
        <EmptyState
          title="No leave history"
          description="Your requests will appear here."
          icon={<IconCalendar size={20} />}
        />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.label}>
              <p className="mb-2 px-0.5 text-xs font-bold uppercase tracking-wide text-[#434655]">
                {g.label}
              </p>
              <ul className="space-y-2">
                {g.rows.map((row) => {
                  const status = row.status.toLowerCase();
                  const badge =
                    status === "approved"
                      ? "bg-emerald-500 text-white"
                      : status === "rejected"
                        ? "bg-[#ba1a1a] text-white"
                        : "bg-amber-500 text-white";
                  const iconBg =
                    typeName(row.leave_type_id).toLowerCase().includes("sick")
                      ? "bg-[#ffdad6] text-[#ba1a1a]"
                      : "bg-[#eaddff] text-[#712ae2]";
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/leave/${row.id}`}
                        className={`${ui.card} block p-4 transition active:scale-[0.99]`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
                          >
                            <IconCalendar size={18} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-[#0b1c30]">
                                  {typeName(row.leave_type_id)}
                                </p>
                                <p className="text-xs text-[#434655]">
                                  {row.document_number}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${badge}`}
                              >
                                {status === "submitted" ? "Pending" : row.status}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-[#c3c6d7]/25 pt-3 text-sm">
                              <span className="text-[#434655]">
                                {formatRange(row.start_date, row.end_date)}
                              </span>
                              <span className="font-semibold text-[#004ac6]">
                                {row.days_count} Day
                                {Number(row.days_count) === 1 ? "" : "s"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <AiFab href="/leave" />
    </div>
  );
}

function formatRange(start: string, end: string) {
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (start === end) return s.toLocaleDateString(undefined, opts);
  return `${s.toLocaleDateString(undefined, opts)} - ${e.toLocaleDateString(undefined, opts)}`;
}

function groupByMonth(rows: EssLeaveRequest[]) {
  const map = new Map<string, EssLeaveRequest[]>();
  for (const row of rows) {
    const d = new Date(`${row.start_date}T12:00:00`);
    const label = d
      .toLocaleString(undefined, { month: "long", year: "numeric" })
      .toUpperCase();
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(row);
  }
  return [...map.entries()].map(([label, groupRows]) => ({
    label,
    rows: groupRows,
  }));
}
