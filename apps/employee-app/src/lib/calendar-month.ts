/** Monday-first month grid for touch calendars. */

export type MonthCell = {
  day: number;
  iso: string | null;
  inMonth: boolean;
  isToday: boolean;
};

export function buildMonthGridMonday(cursor: Date): {
  label: string;
  cells: MonthCell[];
} {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const label = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = todayIsoFromDate(new Date());

  const cells: MonthCell[] = [];

  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, -startPad + i + 1);
    cells.push({
      day: d.getDate(),
      iso: isoFromDate(d),
      inMonth: false,
      isToday: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({
      day: d,
      iso,
      inMonth: true,
      isToday: iso === todayIso,
    });
  }
  while (cells.length % 7 !== 0) {
    const next = cells.length - startPad - daysInMonth + 1;
    const d = new Date(year, month + 1, next);
    cells.push({
      day: d.getDate(),
      iso: isoFromDate(d),
      inMonth: false,
      isToday: false,
    });
  }
  return { label, cells };
}

export function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayIsoFromDate(d: Date): string {
  return isoFromDate(d);
}
