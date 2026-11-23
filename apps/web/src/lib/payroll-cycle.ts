/** Pay cycle helpers — e.g. 21st of previous month through 20th of pay month. */

export type PayrollCycle = {
  /** YYYY-MM — pay month; cycle ends just before cutover day in this month */
  anchorMonth: string;
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

export const SALARY_DAY_BASIS = 30;

/** Employee PF is a fixed monthly statutory amount — never scaled by LOP / payable days. */
export function isPfDeductionLabel(label: string): boolean {
  const n = label.trim().toLowerCase();
  return n === "pf" || n === "employee pf" || n === "employer pf" || n.includes("provident");
}

/** Count Monday–Friday days in an inclusive date range (display only — not salary N). */
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
 * Attendance window for a pay month (anchor).
 *
 * Cutover &gt; 1 (e.g. 21): ends on (cutover−1) of the pay month, starts on cutover
 * of the previous month. Example: Nov 2026 + day 21 → 21 Oct 2026 – 20 Nov 2026.
 *
 * Cutover 1: full calendar month of the pay month (1–last day).
 */
export function buildPayrollCycle(anchorMonth: string, cutoverDay = 21): PayrollCycle {
  const day = Math.min(28, Math.max(1, Math.floor(cutoverDay)));
  const [y, m] = anchorMonth.split("-").map(Number);
  const monthIndex = (m || 1) - 1;

  let startDate: Date;
  let endDate: Date;
  if (day === 1) {
    startDate = new Date(y, monthIndex, 1);
    endDate = new Date(y, monthIndex + 1, 0);
  } else {
    endDate = new Date(y, monthIndex, day - 1);
    startDate = new Date(y, monthIndex - 1, day);
  }

  const start = toIso(startDate);
  const end = toIso(endDate);
  return {
    anchorMonth,
    cutoverDay: day,
    start,
    end,
    label: `${formatShort(start)} – ${formatShort(end)}`,
    workingDays: SALARY_DAY_BASIS,
  };
}

export function listPayrollCycleOptions(
  count = 8,
  cutoverDay = 21,
  from = new Date(),
): { value: string; label: string; cycle: PayrollCycle }[] {
  const out: { value: string; label: string; cycle: PayrollCycle }[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    const cycle = buildPayrollCycle(ym, cutoverDay);
    out.push({
      value: ym,
      label: `${cycle.label} · pay month ${ym} · cutover ${cycle.cutoverDay}${ordinal(cycle.cutoverDay)}`,
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

export const PAYROLL_CUTOVER_STORAGE_KEY = "erp_pay_cycle_cutover_v2";

export function readPayrollCutoverDay(): number {
  if (typeof window === "undefined") return 21;
  try {
    const raw = localStorage.getItem(PAYROLL_CUTOVER_STORAGE_KEY);
    const n = raw ? Number(raw) : 21;
    return Number.isFinite(n) ? Math.min(28, Math.max(1, Math.floor(n))) : 21;
  } catch {
    return 21;
  }
}

export function writePayrollCutoverDay(day: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PAYROLL_CUTOVER_STORAGE_KEY, String(Math.min(28, Math.max(1, Math.floor(day)))));
}
