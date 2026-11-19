/** Locale-safe date/time helpers for client components. */

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/** Local calendar date YYYY-MM-DD (matches APP_TIMEZONE business day for IST users). */
export function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** @deprecated use todayLocalDate — kept for callers during transition */
export function todayUtcDate(): string {
  return todayLocalDate();
}

/**
 * Decimal hours (e.g. 5.0 or 5.25) → clock-style "5:00" / "5:15".
 * Example: punched 10:00, now 15:00 → 5.00 → "5:00"
 */
export function formatHours(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return "—";
  const totalMinutes = Math.round(n * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Same as formatHours, with a "hours" suffix: "5:00 hours". */
export function formatHoursLabel(
  value: string | number | null | undefined,
): string {
  const base = formatHours(value);
  return base === "—" ? "—" : `${base} hours`;
}

/** Duration between two ISO timestamps → decimal hours (2 d.p.). */
export function hoursBetween(
  startIso: string,
  endMs: number = Date.now(),
): number {
  const start = new Date(startIso).getTime();
  if (!Number.isFinite(start)) return 0;
  const seconds = Math.max(0, (endMs - start) / 1000);
  return Math.round((seconds / 3600) * 100) / 100;
}

/** @deprecated use hoursBetween */
export function elapsedHoursSince(
  checkInIso: string,
  nowMs: number = Date.now(),
): number {
  return hoursBetween(checkInIso, nowMs);
}

/** Seconds since ISO timestamp → HH:MM:SS clock. */
export function formatHmsSince(
  startIso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!startIso) return "00:00:00";
  const start = new Date(startIso).getTime();
  if (!Number.isFinite(start)) return "00:00:00";
  const total = Math.max(0, Math.floor((nowMs - start) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function greetingForNow(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}
