"use client";

import type { AttendanceRecord } from "@/types/attendance-management";
import { reportSummary } from "@/services/attendance-management-service";

export function AttendanceStatusChart({ records }: { records: AttendanceRecord[] }) {
  const counts = {
    present: records.filter((r) => r.status === "present" || r.status === "late").length,
    absent: records.filter((r) => r.status === "absent").length,
    wfh: records.filter((r) => r.status === "work_from_home").length,
    leave: records.filter((r) => r.status === "leave").length,
    other: records.filter(
      (r) => !["present", "late", "absent", "work_from_home", "leave"].includes(r.status),
    ).length,
  };
  const max = Math.max(1, ...Object.values(counts));
  const items = [
    { label: "Present", value: counts.present, color: "bg-emerald-500" },
    { label: "Absent", value: counts.absent, color: "bg-red-400" },
    { label: "WFH", value: counts.wfh, color: "bg-sky-500" },
    { label: "Leave", value: counts.leave, color: "bg-amber-500" },
    { label: "Other", value: counts.other, color: "bg-slate-400" },
  ];
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Status mix
      </h3>
      <div className="mt-4 flex items-end gap-3 h-32">
        {items.map((item) => (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`w-full rounded-t-md ${item.color} transition-all duration-300`}
              style={{ height: `${(item.value / max) * 100}%`, minHeight: item.value ? 4 : 0 }}
            />
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
            <span className="text-xs font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AttendanceReportsPanel({ records }: { records: AttendanceRecord[] }) {
  const byDept = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const d = r.extension.departmentName || "Unassigned";
    const list = byDept.get(d) ?? [];
    list.push(r);
    byDept.set(d, list);
  }

  const reports = [
    reportSummary(records, "Filtered range"),
    reportSummary(
      records.filter((r) => r.status === "late" || r.extension.isLate),
      "Late arrival",
    ),
    reportSummary(
      records.filter((r) => r.status === "missed_punch" || r.extension.missedPunch),
      "Missing punch",
    ),
  ];

  if (!records.length) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
        No attendance in the current filter range. Adjust filters or mark attendance to generate reports.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {reports.map((rep) => (
          <div key={rep.label} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">{rep.label}</p>
            <p className="mt-1 text-2xl font-semibold">{rep.total}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              P {rep.present} · A {rep.absent} · Late {rep.late} · OT {rep.ot.toFixed(1)}h
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Department report</h3>
        <table className="mt-3 w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground">
              <th className="py-2">Department</th>
              <th className="py-2">Records</th>
              <th className="py-2">Present</th>
              <th className="py-2">Absent</th>
              <th className="py-2">OT hours</th>
            </tr>
          </thead>
          <tbody>
            {[...byDept.entries()]
              .sort((a, b) => b[1].length - a[1].length)
              .map(([dept, rows]) => {
              const s = reportSummary(rows, dept);
              return (
                <tr key={dept} className="border-b border-border/40">
                  <td className="py-2 font-medium">{dept}</td>
                  <td className="py-2">{s.total}</td>
                  <td className="py-2">{s.present}</td>
                  <td className="py-2">{s.absent}</td>
                  <td className="py-2">{s.ot.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
