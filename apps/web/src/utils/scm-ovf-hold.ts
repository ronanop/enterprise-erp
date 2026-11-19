/** SCM OVF hold duration helpers (scm_on_hold_at from API). */

export function formatScmHoldDurationMs(ms: number): string {
  const totalMs = Math.max(0, ms);
  const totalMinutes = Math.floor(totalMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    const dayPart = `${days} day${days === 1 ? "" : "s"}`;
    if (hours > 0) return `${dayPart}, ${hours} hr`;
    return dayPart;
  }
  if (hours > 0) {
    return `${hours} hr${minutes > 0 ? `, ${minutes} min` : ""}`;
  }
  if (minutes > 0) return `${minutes} min`;
  return "Less than 1 min";
}

export function scmHoldDayCountFromIso(holdAt: string | null | undefined): number | null {
  if (!holdAt) return null;
  const start = new Date(holdAt);
  if (Number.isNaN(start.getTime())) return null;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = todayDay.getTime() - startDay.getTime();
  return Math.max(0, Math.round(diffMs / 86400000));
}

function calendarDayCountBetween(sinceIso: string, untilIso: string): number | null {
  const start = new Date(sinceIso);
  const end = new Date(untilIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diffMs = endDay.getTime() - startDay.getTime();
  return Math.max(0, Math.round(diffMs / 86400000));
}

export function scmHoldDayCountBetween(
  since: string | null | undefined,
  until: string | null | undefined,
): number | null {
  if (!since || !until) return null;
  return calendarDayCountBetween(since, until);
}

export function scmHoldDayCountBetweenDisplay(
  since: string | null | undefined,
  until: string | null | undefined,
): string {
  const days = scmHoldDayCountBetween(since, until);
  if (days === null) return "—";
  if (days === 0) return "0 days";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function scmHoldDayCountDisplay(holdAt: string | null | undefined): string {
  const days = scmHoldDayCountFromIso(holdAt);
  if (days === null) return "—";
  if (days === 0) return "0 days";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function scmHoldDurationFromIso(holdAt: string | null | undefined): string {
  if (!holdAt) return "—";
  const start = new Date(holdAt);
  if (Number.isNaN(start.getTime())) return "—";
  return formatScmHoldDurationMs(Date.now() - start.getTime());
}

export function scmHoldSinceDisplay(holdAt: string | null | undefined): string {
  if (!holdAt) return "—";
  const start = new Date(holdAt);
  if (Number.isNaN(start.getTime())) return "—";
  return start.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function scmHoldSummaryLine(holdAt: string | null | undefined): string | null {
  if (!holdAt) return null;
  const daysLabel = scmHoldDayCountDisplay(holdAt);
  const since = scmHoldSinceDisplay(holdAt);
  if (daysLabel === "—" || since === "—") return null;
  return `On hold for ${daysLabel} (since ${since})`;
}

/** Create PO confirmation / banner when OVF is on SCM hold. */
export function scmHoldCreatePoNotice(holdAt: string | null | undefined): string {
  const daysLabel = scmHoldDayCountDisplay(holdAt);
  const since = scmHoldSinceDisplay(holdAt);
  if (daysLabel !== "—" && since !== "—") {
    return `This OVF has been on hold for ${daysLabel} (since ${since}). Creating a purchase order will unhold it.`;
  }
  if (daysLabel !== "—") {
    return `This OVF has been on hold for ${daysLabel}. Creating a purchase order will unhold it.`;
  }
  return "This OVF is on hold. Creating a purchase order will unhold it.";
}
