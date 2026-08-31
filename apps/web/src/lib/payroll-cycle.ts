/** Pay cycle helpers — e.g. 20th of month through 19th of next month. */

export type PayrollCycle = {
  anchorMonth: string; // YYYY-MM — cycle starts on cutover day of this month
  cutoverDay: number;
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
  label: string;
  workingDays: number;
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatShort(iso: string): string {
  const d = parseIso(iso);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Count Monday–Friday days in an inclusive date range. */
export function countWeekdaysInRange(start: string, end: string): number {
  let cur = parseIso(start);
  const last = parseIso(end);
  let n = 0;
  while (cur <= last) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) n += 1;
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return n;
}

/**
 * Cycle from cutover day of anchor month through day before cutover of next month.
 * Example: anchor 2026-08, cutover 20 → 20 Aug 2026 – 19 Sep 2026.
 */
export function buildPayrollCycle(anchorMonth: string, cutoverDay = 20): PayrollCycle {
  const day = Math.min(28, Math.max(1, Math.floor(cutoverDay)));
  const [y, m] = anchorMonth.split("-").map(Number);
  const startDate = new Date(y, (m || 1) - 1, day);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setDate(day - 1);

  const start = toIso(startDate);
  const end = toIso(endDate);
  return {
    anchorMonth,
    cutoverDay: day,
    start,
    end,
    label: `${formatShort(start)} – ${formatShort(end)}`,
    workingDays: countWeekdaysInRange(start, end),
  };
}

export function listPayrollCycleOptions(
  count = 8,
  cutoverDay = 20,
  from = new Date(),
): { value: string; label: string; cycle: PayrollCycle }[] {
  const out: { value: string; label: string; cycle: PayrollCycle }[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    const cycle = buildPayrollCycle(ym, cutoverDay);
    out.push({
      value: ym,
      label: `${cycle.label} · ${cycle.cutoverDay}${ordinal(cycle.cutoverDay)} to next ${cycle.cutoverDay}${ordinal(cycle.cutoverDay)}`,
      cycle,
    });
  }
  return out;
}

function ordinal(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  const r = day % 10;
  if (r === 1) return "st";
  if (r === 2) return "nd";
  if (r === 3) return "rd";
  return "th";
}

export const PAYROLL_CUTOVER_STORAGE_KEY = "erp_pay_cycle_cutover_v1";

export function readPayrollCutoverDay(): number {
  if (typeof window === "undefined") return 20;
  try {
    const raw = localStorage.getItem(PAYROLL_CUTOVER_STORAGE_KEY);
    const n = raw ? Number(raw) : 20;
    return Number.isFinite(n) ? Math.min(28, Math.max(1, Math.floor(n))) : 20;
  } catch {
    return 20;
  }
}

export function writePayrollCutoverDay(day: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PAYROLL_CUTOVER_STORAGE_KEY, String(Math.min(28, Math.max(1, Math.floor(day)))));
}
