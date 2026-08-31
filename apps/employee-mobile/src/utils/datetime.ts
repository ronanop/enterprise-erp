/** Locale-safe date/time helpers for mobile. */

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

export function todayLocalDate(): string {
  return toIsoDate(new Date());
}

export function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function compareIsoDates(a: string, b: string): number {
  return a.slice(0, 10).localeCompare(b.slice(0, 10));
}

export function isIsoInRange(
  iso: string,
  start: string,
  end?: string | null,
): boolean {
  if (!start) return false;
  const day = iso.slice(0, 10);
  const rangeStart = start.slice(0, 10);
  const rangeEnd = (end && end.length >= 10 ? end : start).slice(0, 10);
  return day >= rangeStart && day <= rangeEnd;
}

export function formatDisplayDateDDMMYYYY(
  iso: string | null | undefined,
): string {
  if (!iso) return "—";
  const d = parseIsoDate(iso.slice(0, 10));
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatLeaveRangeLine(
  startIso: string,
  endIso: string,
  daysCount?: string | number,
): string {
  const start = formatDisplayDateDDMMYYYY(startIso);
  const end = formatDisplayDateDDMMYYYY(endIso);
  const range =
    startIso.slice(0, 10) === endIso.slice(0, 10) ? start : `${start} → ${end}`;
  if (daysCount === undefined || daysCount === "") return range;
  return `${range} · ${daysCount} day(s)`;
}

export function formatHours(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return "—";
  const totalMinutes = Math.round(n * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function formatHoursLabel(
  value: string | number | null | undefined,
): string {
  const base = formatHours(value);
  return base === "—" ? "—" : `${base} hours`;
}

export function hoursBetween(
  startIso: string,
  endMs: number = Date.now(),
): number {
  const start = new Date(startIso).getTime();
  if (!Number.isFinite(start)) return 0;
  const seconds = Math.max(0, (endMs - start) / 1000);
  return Math.round((seconds / 3600) * 100) / 100;
}

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

export function formatMoney(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}
