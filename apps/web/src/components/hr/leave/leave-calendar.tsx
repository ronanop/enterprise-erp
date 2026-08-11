"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { SetupDrawer } from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import type { LeaveDirectory } from "@/services/leave-management-service";
import type { LeaveRequestRecord } from "@/types/leave-management";
import { leaveStatusDisplay } from "@/types/leave-management";
import { cn } from "@/lib/utils";

export function LeaveCalendarView({
  directory,
  onSelectRequest,
}: {
  directory: LeaveDirectory;
  onSelectRequest: (r: LeaveRequestRecord) => void;
}) {
  const [month, setMonth] = useState(() => new Date());
  const [dayDetail, setDayDetail] = useState<{ date: string; rows: LeaveRequestRecord[] } | null>(null);

  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDow = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function dateKey(day: number) {
    return `${year}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const byDate = useMemo(() => {
    const map = new Map<string, LeaveRequestRecord[]>();
    for (const r of directory.requests) {
      const cur = new Date(r.fromDate);
      const end = new Date(r.toDate);
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10);
        const list = map.get(key) ?? [];
        list.push(r);
        map.set(key, list);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [directory.requests]);

  const holidaySet = useMemo(
    () => new Set(directory.holidays.map((h) => h.date)),
    [directory.holidays],
  );

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="cursor-pointer"
          onClick={() => setMonth(new Date(year, mon - 1, 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h3 className="text-sm font-semibold">
          {month.toLocaleString("default", { month: "long", year: "numeric" })}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="cursor-pointer"
          onClick={() => setMonth(new Date(year, mon + 1, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="mb-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-emerald-500" /> Approved
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-amber-500" /> Pending
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-sky-500" /> Holiday
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-slate-300" /> Weekend
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const key = dateKey(day);
          const rows = byDate.get(key) ?? [];
          const isHol = holidaySet.has(key);
          const dow = new Date(key).getDay();
          const isWe = dow === 0 || dow === 6;
          const approved = rows.some(
            (r) => r.status === "approved" || r.extension.approvalStage === "approved",
          );
          const pending = rows.some((r) =>
            ["submitted", "manager_review", "hr_review", "draft"].includes(
              r.extension.approvalStage || r.status,
            ),
          );
          return (
            <button
              key={key}
              type="button"
              className={cn(
                "cursor-pointer flex min-h-[3.25rem] flex-col items-center justify-center rounded-lg border p-1 text-xs transition-colors hover:bg-muted/50",
                isHol && "border-sky-200 bg-sky-50",
                isWe && !isHol && "bg-muted/40",
                approved && "border-emerald-200 bg-emerald-50",
                pending && !approved && "border-amber-200 bg-amber-50",
              )}
              onClick={() => setDayDetail({ date: key, rows })}
            >
              <span className="font-medium">{day}</span>
              <span className="text-[9px] text-muted-foreground">
                {isHol ? "HOL" : rows.length ? `${rows.length}` : isWe ? "WO" : "—"}
              </span>
            </button>
          );
        })}
      </div>

      <SetupDrawer
        open={Boolean(dayDetail)}
        title={`Leave · ${dayDetail?.date ?? ""}`}
        description={`${dayDetail?.rows.length ?? 0} request(s)`}
        onClose={() => setDayDetail(null)}
      >
        {!dayDetail?.rows.length ? (
          <p className="text-xs text-muted-foreground">No leave on this date.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {dayDetail.rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="w-full cursor-pointer rounded-lg border border-border/60 px-3 py-2 text-left hover:bg-muted/40"
                  onClick={() => {
                    onSelectRequest(r);
                    setDayDetail(null);
                  }}
                >
                  <p className="font-medium">{r.employeeName}</p>
                  <p className="text-muted-foreground">
                    {r.leaveTypeName} · {r.fromDate}–{r.toDate} · {r.totalDays}d
                  </p>
                  <p className="text-muted-foreground">
                    {leaveStatusDisplay(r.extension.approvalStage || r.status)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SetupDrawer>
    </div>
  );
}
