export type StatusTab = "all" | "pending" | "approved" | "rejected";

export function isPendingStatus(status: string): boolean {
  const s = status.toLowerCase();
  return (
    s === "submitted" ||
    s === "pending" ||
    s === "draft" ||
    s === "manager_approved"
  );
}

export function isApprovedStatus(status: string): boolean {
  return status.toLowerCase() === "approved";
}

export function isRejectedStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "rejected" || s === "cancelled";
}

export function matchesStatusTab(status: string, tab: StatusTab): boolean {
  if (tab === "all") return true;
  if (tab === "pending") return isPendingStatus(status);
  if (tab === "approved") return isApprovedStatus(status);
  return isRejectedStatus(status);
}

export function statusBadge(status: string): {
  label: string;
  className: string;
  tone: "pending" | "approved" | "rejected" | "other";
} {
  if (isPendingStatus(status)) {
    return {
      label: "Pending",
      className: "bg-[#FFF1E0] text-[#C2410C]",
      tone: "pending",
    };
  }
  if (isApprovedStatus(status)) {
    return {
      label: "Approved",
      className: "bg-[#DCFCE7] text-[#166534]",
      tone: "approved",
    };
  }
  if (status.toLowerCase() === "cancelled") {
    return {
      label: "Cancelled",
      className: "bg-[#F1F5F9] text-[#64748B]",
      tone: "rejected",
    };
  }
  if (isRejectedStatus(status)) {
    return {
      label: "Rejected",
      className: "bg-[#FFE4E1] text-[#BA1A1A]",
      tone: "rejected",
    };
  }
  return {
    label: status,
    className: "bg-[#EFF4FF] text-[#004AC6]",
    tone: "other",
  };
}

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatMonthShort(ymd: string): string {
  return parseYmd(ymd)
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
}

export function formatDayNum(ymd: string): string {
  return String(parseYmd(ymd).getDate()).padStart(2, "0");
}

export function formatDisplayDate(ymd: string): string {
  if (!ymd) return "";
  return parseYmd(ymd).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateRange(start: string, end?: string | null): string {
  if (!end || end === start) return formatDisplayDate(start);
  return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
}

export const TOUR_PURPOSE_PREFIX = "On Tour · ";

export function isOnTourPurpose(purpose: string | null | undefined): boolean {
  return (purpose || "").trim().toLowerCase().startsWith("on tour");
}

export function stripTourPrefix(purpose: string | null | undefined): string {
  const p = (purpose || "").trim();
  if (p.toLowerCase().startsWith("on tour · ")) return p.slice("On Tour · ".length);
  if (p.toLowerCase().startsWith("on tour - ")) return p.slice("On Tour - ".length);
  if (p.toLowerCase().startsWith("on tour:")) return p.slice("On Tour:".length).trim();
  return p;
}
