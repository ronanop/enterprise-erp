/**
 * Leave cycle rules (calendar 1–last day). Payroll 20–20 is separate.
 * Monthly credit for month M posts after M ends; until then it cannot be used.
 * Past leave dates are allowed after credit posts so prior holidays can be covered.
 */

export function completedCalendarMonthYyyymm(reference = new Date()): string {
  const y = reference.getFullYear();
  const m = reference.getMonth(); // 0-based; previous month
  const prev = m === 0 ? new Date(y - 1, 11, 1) : new Date(y, m - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

export function yyyymmFromIso(iso: string): string {
  return iso.slice(0, 7);
}

export function firstDayOfNextMonthYyyymm(yyyymm: string): string {
  const y = Number(yyyymm.slice(0, 4));
  const m = Number(yyyymm.slice(5, 7));
  if (m === 12) return `${y + 1}-01-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export function calendarMonthsInRange(fromIso: string, toIso: string): string[] {
  const months: string[] = [];
  const seen = new Set<string>();
  const start = new Date(`${fromIso}T00:00:00`);
  const end = new Date(`${toIso}T00:00:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!seen.has(key)) {
      seen.add(key);
      months.push(key);
    }
  }
  return months;
}

export function hasFutureCalendarMonthLeave(
  fromIso: string,
  toIso: string,
  today = new Date(),
): boolean {
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  return calendarMonthsInRange(fromIso, toIso).some((ym) => {
    const y = Number(ym.slice(0, 4));
    const m = Number(ym.slice(5, 7));
    return y > ty || (y === ty && m > tm);
  });
}

export function monthsWaitingOnUnpostedCredit(
  leaveMonths: string[],
  lastAccrualYyyymm: string | null | undefined,
  today = new Date(),
): string[] {
  const completed = completedCalendarMonthYyyymm(today);
  const last = lastAccrualYyyymm || "";
  return leaveMonths.filter((month) => last < month && completed < month);
}

export type LeaveCycleValidation = {
  ok: boolean;
  error?: string;
  info?: string;
};

export function validateLeaveCycleOnApply(input: {
  fromDate: string;
  toDate: string;
  netDays: number;
  available: number | null;
  lastAccrualYyyymm?: string | null;
  monthlyCreditDays?: number | null;
  today?: Date;
}): LeaveCycleValidation {
  const today = input.today ?? new Date();
  if (!input.fromDate || !input.toDate) {
    return { ok: false, error: "From and to dates are required." };
  }

  if (hasFutureCalendarMonthLeave(input.fromDate, input.toDate, today)) {
    return {
      ok: false,
      error:
        "Cannot apply leave for a future calendar month before it starts. Leave cycle is calendar 1–last day (not payroll 20–20). Monthly credit posts after month end; then you may cover past dates in that month.",
    };
  }

  const info =
    "Leave dates use the calendar month (1–last day). Days 21–30/31 are still that month’s leave — not the next payroll 20–20 cycle. Monthly credit is added after month end.";

  if (input.available == null) {
    return { ok: true, info };
  }

  if (input.netDays <= 0 || input.available >= input.netDays) {
    return { ok: true, info };
  }

  const leaveMonths = calendarMonthsInRange(input.fromDate, input.toDate);
  const last = input.lastAccrualYyyymm || "";
  const completed = completedCalendarMonthYyyymm(today);
  const waiting = leaveMonths.filter((m) => last < m && completed < m);
  const monthly = input.monthlyCreditDays ?? 0;

  if (waiting.length && monthly > 0) {
    const month = waiting[0]!;
    const creditOn = firstDayOfNextMonthYyyymm(month);
    return {
      ok: false,
      error: `Insufficient balance (${input.available} available, ${input.netDays} required). Monthly credit for ${month} is added on or after ${creditOn} (after that calendar month ends). You cannot use that credit early. After it posts, you may apply leave for these dates (including past dates).`,
      info,
    };
  }

  return {
    ok: false,
    error: `Insufficient balance. Available ${input.available} day(s), requested ${input.netDays}.`,
    info,
  };
}
