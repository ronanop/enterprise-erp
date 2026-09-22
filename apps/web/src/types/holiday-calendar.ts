/** Holiday calendar entry shape stored in holidays_json. */

export const HOLIDAY_TYPES = [
  { value: "national", label: "National" },
  { value: "company", label: "Company" },
  { value: "regional", label: "Regional" },
  { value: "optional", label: "Optional" },
] as const;

export const HOLIDAY_REPEAT = [
  { value: "never", label: "Never" },
  { value: "every_year", label: "Every Year" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
] as const;

export const HOLIDAY_FREQUENCY = [
  { value: "yearly", label: "Yearly" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
] as const;

export const HOLIDAY_HALF_SESSIONS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
] as const;

export const HOLIDAY_APPLICABLE = [
  { value: "all", label: "All Employees" },
  { value: "departments", label: "Departments" },
  { value: "branches", label: "Branches" },
] as const;

export type HolidayType = (typeof HOLIDAY_TYPES)[number]["value"];
export type HolidayRepeat = (typeof HOLIDAY_REPEAT)[number]["value"];
export type HolidayFrequency = (typeof HOLIDAY_FREQUENCY)[number]["value"];
export type HolidayHalfSession = (typeof HOLIDAY_HALF_SESSIONS)[number]["value"];
export type HolidayApplicableScope = (typeof HOLIDAY_APPLICABLE)[number]["value"];

export type HolidayEntry = {
  id: string;
  /** Display title (primary). */
  title: string;
  /** Legacy alias used by ESS / leave parsers. */
  name: string;
  date: string;
  holiday_type: HolidayType;
  /** ESS compat: optional vs mandatory. */
  kind: "mandatory" | "optional";
  repeat: HolidayRepeat;
  frequency: HolidayFrequency | null;
  half_day: boolean;
  half_day_session: HolidayHalfSession | null;
  applicable_to: HolidayApplicableScope[];
  remarks: string;
};

export function emptyHolidayEntry(defaults?: Partial<HolidayEntry>): HolidayEntry {
  return {
    id: crypto.randomUUID(),
    title: "",
    name: "",
    date: "",
    holiday_type: "national",
    kind: "mandatory",
    repeat: "never",
    frequency: null,
    half_day: false,
    half_day_session: null,
    applicable_to: ["all"],
    remarks: "",
    ...defaults,
  };
}

export function normalizeHolidayEntry(raw: unknown): HolidayEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  const date = String(h.date ?? h.holiday_date ?? "").slice(0, 10);
  const title = String(h.title ?? h.name ?? "").trim();
  if (!date && !title) return null;

  const holidayTypeRaw = String(h.holiday_type ?? h.type ?? "").toLowerCase();
  const holiday_type: HolidayType = HOLIDAY_TYPES.some((t) => t.value === holidayTypeRaw)
    ? (holidayTypeRaw as HolidayType)
    : String(h.kind ?? "").toLowerCase() === "optional"
      ? "optional"
      : "national";

  const repeatRaw = String(h.repeat ?? "never").toLowerCase();
  const repeat: HolidayRepeat = HOLIDAY_REPEAT.some((r) => r.value === repeatRaw)
    ? (repeatRaw as HolidayRepeat)
    : "never";

  const freqRaw = h.frequency == null ? null : String(h.frequency).toLowerCase();
  const frequency: HolidayFrequency | null =
    freqRaw && HOLIDAY_FREQUENCY.some((f) => f.value === freqRaw)
      ? (freqRaw as HolidayFrequency)
      : repeat === "never"
        ? null
        : repeat === "every_year"
          ? "yearly"
          : repeat === "monthly"
            ? "monthly"
            : "weekly";

  const half_day = Boolean(h.half_day);
  const sessionRaw = String(h.half_day_session ?? h.half_day_period ?? "").toLowerCase();
  const half_day_session: HolidayHalfSession | null =
    half_day && (sessionRaw === "morning" || sessionRaw === "afternoon")
      ? sessionRaw
      : half_day
        ? "morning"
        : null;

  let applicable_to: HolidayApplicableScope[] = ["all"];
  if (Array.isArray(h.applicable_to)) {
    applicable_to = h.applicable_to
      .map((v) => String(v).toLowerCase())
      .filter((v): v is HolidayApplicableScope =>
        HOLIDAY_APPLICABLE.some((a) => a.value === v),
      );
    if (!applicable_to.length) applicable_to = ["all"];
  }

  const name = title || String(h.name ?? "Holiday");
  return {
    id: String(h.id ?? crypto.randomUUID()),
    title: name,
    name,
    date,
    holiday_type,
    kind: holiday_type === "optional" ? "optional" : "mandatory",
    repeat,
    frequency: repeat === "never" ? null : frequency,
    half_day,
    half_day_session,
    applicable_to,
    remarks: String(h.remarks ?? h.notes ?? ""),
  };
}

export function parseHolidaysJson(raw: unknown): HolidayEntry[] {
  if (!raw) return [];
  let items: unknown[] = [];
  if (Array.isArray(raw)) items = raw;
  else if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.holidays)) items = obj.holidays;
    else if (Array.isArray(obj.dates)) items = obj.dates;
  }
  return items.map(normalizeHolidayEntry).filter((h): h is HolidayEntry => Boolean(h));
}

/** Payload saved to API holidays_json. */
export function serializeHolidays(entries: HolidayEntry[]): HolidayEntry[] {
  return entries.map((h) => {
    const title = h.title.trim() || h.name.trim() || "Holiday";
    const repeat = h.repeat || "never";
    return {
      id: h.id || crypto.randomUUID(),
      title,
      name: title,
      date: h.date.slice(0, 10),
      holiday_type: h.holiday_type,
      kind: h.holiday_type === "optional" ? "optional" : "mandatory",
      repeat,
      frequency: repeat === "never" ? null : h.frequency || "yearly",
      half_day: Boolean(h.half_day),
      half_day_session: h.half_day ? h.half_day_session || "morning" : null,
      applicable_to: h.applicable_to?.length ? h.applicable_to : ["all"],
      remarks: h.remarks?.trim() || "",
    };
  });
}

export function validateHolidayEntry(h: HolidayEntry): string | null {
  if (!h.title.trim()) return "Holiday Title is required.";
  if (!h.date) return "Holiday Date is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.date)) return "Holiday Date must be a valid date.";
  if (!h.holiday_type) return "Holiday Type is required.";
  if (h.half_day && !h.half_day_session) return "Select Morning or Afternoon for half day.";
  return null;
}
