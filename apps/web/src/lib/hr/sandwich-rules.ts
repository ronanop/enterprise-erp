/**
 * Mirrors backend `modules.hr.domain.sandwich_rules` for payroll Generate preview.
 * Weekly offs / holidays between flanking unauthorized absences (or approved leave)
 * become LOP (or leave) per company policy.
 */

const PAID_WORKING = new Set([
  "present",
  "late",
  "on_duty",
  "work_from_home",
  "half_day",
  "miss_punch",
  "early_exit",
]);

export type SandwichTrigger = "unauthorized_absence" | "approved_leave" | "both";
export type SandwichOffBecomes = "lop" | "leave";

export type SandwichPolicy = {
  enabled: boolean;
  triggers: SandwichTrigger;
  offBecomes: SandwichOffBecomes;
};

export const DEFAULT_SANDWICH_POLICY: SandwichPolicy = {
  enabled: true,
  triggers: "both",
  offBecomes: "lop",
};

function parseIso(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(ymd: string, n: number): string {
  const d = parseIso(ymd);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function isUnauthorizedFlank(
  status: string | undefined,
  hasApprovedLeave: boolean,
): boolean {
  if (hasApprovedLeave) return false;
  const st = String(status || "")
    .trim()
    .toLowerCase();
  if (PAID_WORKING.has(st)) return false;
  if (st === "holiday" || st === "week_off" || st === "weekend") return false;
  return st === "absent" || !st;
}

function previousWorkingDay(
  day: string,
  isNonWorking: (d: string) => boolean,
  limit = 14,
): string | null {
  let cur = addDays(day, -1);
  for (let i = 0; i < limit; i += 1) {
    if (!isNonWorking(cur)) return cur;
    cur = addDays(cur, -1);
  }
  return null;
}

function nextWorkingDay(
  day: string,
  isNonWorking: (d: string) => boolean,
  limit = 14,
): string | null {
  let cur = addDays(day, 1);
  for (let i = 0; i < limit; i += 1) {
    if (!isNonWorking(cur)) return cur;
    cur = addDays(cur, 1);
  }
  return null;
}

function* contiguousOffBlocks(
  start: string,
  end: string,
  isNonWorking: (d: string) => boolean,
): Generator<{ block: string[]; prevW: string | null; nextW: string | null }> {
  let cur = start;
  while (cur <= end) {
    if (!isNonWorking(cur)) {
      cur = addDays(cur, 1);
      continue;
    }
    const block: string[] = [];
    while (cur <= end && isNonWorking(cur)) {
      block.push(cur);
      cur = addDays(cur, 1);
    }
    yield {
      block,
      prevW: previousWorkingDay(block[0]!, isNonWorking),
      nextW: nextWorkingDay(block[block.length - 1]!, isNonWorking),
    };
  }
}

function flanksMatch(
  prevUnauth: boolean,
  nextUnauth: boolean,
  prevLeave: boolean,
  nextLeave: boolean,
  trigger: SandwichTrigger,
): boolean {
  const absenceHit = prevUnauth && nextUnauth;
  const leaveHit = prevLeave && nextLeave;
  if (trigger === "approved_leave") return leaveHit;
  if (trigger === "both") return absenceHit || leaveHit;
  return absenceHit;
}

/** Off / holiday dates that sandwich under the given trigger. */
export function sandwichOffDates(args: {
  start: string;
  end: string;
  isNonWorking: (d: string) => boolean;
  attendanceStatusByDate: Map<string, string> | Record<string, string>;
  approvedLeaveDates: Set<string>;
  asOf?: string | null;
  trigger?: SandwichTrigger;
}): Set<string> {
  const statusOf = (d: string): string | undefined => {
    if (args.attendanceStatusByDate instanceof Map) {
      return args.attendanceStatusByDate.get(d);
    }
    return args.attendanceStatusByDate[d];
  };
  const trigger = args.trigger ?? "both";
  const out = new Set<string>();
  for (const { block, prevW, nextW } of contiguousOffBlocks(
    args.start,
    args.end,
    args.isNonWorking,
  )) {
    if (!prevW || !nextW) continue;
    if (args.asOf && nextW > args.asOf) continue;
    const prevLeave = args.approvedLeaveDates.has(prevW);
    const nextLeave = args.approvedLeaveDates.has(nextW);
    const prevUnauth = isUnauthorizedFlank(statusOf(prevW), prevLeave);
    const nextUnauth = isUnauthorizedFlank(statusOf(nextW), nextLeave);
    if (flanksMatch(prevUnauth, nextUnauth, prevLeave, nextLeave, trigger)) {
      for (const d of block) out.add(d);
    }
  }
  return out;
}

export function padDateRange(start: string, end: string, padDays = 10): { start: string; end: string } {
  return { start: addDays(start, -padDays), end: addDays(end, padDays) };
}

export { eachDay as sandwichEachDay };
