import type { AccountingPeriod } from "@/services/fiscal-service";

/** Derive journal restrictions from backend period status — do not hardcode rules in UI. */
export function getPeriodJournalRestrictions(period?: AccountingPeriod | null) {
  if (!period) {
    return {
      canCreate: true,
      canEdit: true,
      canPost: true,
      message: null as string | null,
    };
  }

  if (period.journal_posting_allowed === false) {
    if (period.status === "hard_closed") {
      return {
        canCreate: false,
        canEdit: false,
        canPost: false,
        message: "This accounting period is locked (hard closed). Journal create, edit, and post are unavailable.",
      };
    }
    if (period.status === "soft_closed") {
      return {
        canCreate: false,
        canEdit: false,
        canPost: false,
        message:
          "This accounting period is closed. Only adjustment journals are allowed by the backend.",
      };
    }
    if (period.gl_closed) {
      return {
        canCreate: false,
        canEdit: false,
        canPost: false,
        message: "General ledger is locked for this period. Journal operations are restricted.",
      };
    }
  }

  return {
    canCreate: period.journal_posting_allowed !== false,
    canEdit: period.journal_posting_allowed !== false,
    canPost: period.journal_posting_allowed !== false,
    message: null,
  };
}

export function isPeriodCurrent(period: AccountingPeriod, today = new Date()) {
  const d = today.toISOString().slice(0, 10);
  return period.start_date <= d && period.end_date >= d;
}

export function quarterLabel(quarter?: number | null) {
  if (!quarter) return "—";
  return `Q${quarter}`;
}
