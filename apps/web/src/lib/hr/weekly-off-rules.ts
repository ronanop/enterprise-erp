/** Mirrors backend `calendar_rules.is_weekly_off_day` for roster + preview UI. */

export type WeeklyOffRuleCode =
  | "sunday"
  | "saturday"
  | "alternate_saturday"
  | "second_saturday"
  | "rotating"
  | "custom";

export function isSecondSaturday(day: Date): boolean {
  return day.getDay() === 6 && day.getDate() >= 8 && day.getDate() <= 14;
}

export function isAlternateSaturday(day: Date, alternateStart: string | null | undefined): boolean {
  if (day.getDay() !== 6) return false;
  if (alternateStart) {
    const start = new Date(`${alternateStart}T12:00:00`);
    const deltaWeeks = Math.floor((day.getTime() - start.getTime()) / (7 * 86_400_000));
    return deltaWeeks >= 0 && deltaWeeks % 2 === 0;
  }
  const isoWeek = getIsoWeek(day);
  return isoWeek % 2 === 0;
}

function getIsoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** JS Sunday=0 … Saturday=6; backend custom uses 0=Mon … 6=Sun — only used when custom rule set. */
export function isWeeklyOffDay(
  dateIso: string,
  rules: WeeklyOffRuleCode[] | null | undefined,
  options?: {
    customWeekdays?: number[] | null;
    alternateSaturdayStart?: string | null;
  },
): boolean {
  const day = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(day.getTime())) return false;

  if (!rules?.length) {
    return day.getDay() === 0 || day.getDay() === 6;
  }

  const ruleSet = new Set(rules.map((r) => r.toLowerCase() as WeeklyOffRuleCode));
  const dow = day.getDay();

  if (ruleSet.has("sunday") && dow === 0) return true;
  if (ruleSet.has("saturday") && dow === 6) return true;
  if (ruleSet.has("second_saturday") && isSecondSaturday(day)) return true;
  if (ruleSet.has("alternate_saturday") && isAlternateSaturday(day, options?.alternateSaturdayStart)) {
    return true;
  }
  if (ruleSet.has("rotating") && dow === 0) return true;
  if (ruleSet.has("custom") && options?.customWeekdays?.length) {
    const jsToMon0 = dow === 0 ? 6 : dow - 1;
    return options.customWeekdays.includes(jsToMon0);
  }
  return false;
}

export const WEEKLY_OFF_RULE_OPTIONS: { id: WeeklyOffRuleCode; label: string }[] = [
  { id: "sunday", label: "Sunday" },
  { id: "saturday", label: "Saturday (every week)" },
  { id: "alternate_saturday", label: "Alternate Saturday" },
  { id: "second_saturday", label: "Second Saturday" },
  { id: "rotating", label: "Rotating weekly off" },
  { id: "custom", label: "Custom weekdays" },
];
