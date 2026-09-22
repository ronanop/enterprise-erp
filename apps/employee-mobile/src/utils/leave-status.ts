export type LeaveStatusDisplay =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Cancelled";

export function leaveStatusDisplay(status: string): LeaveStatusDisplay {
  const s = status.toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  if (s === "cancelled") return "Cancelled";
  return "Pending";
}

export function leaveStatusColor(status: string): string {
  const d = leaveStatusDisplay(status);
  if (d === "Approved") return "#007d55";
  if (d === "Rejected") return "#ba1a1a";
  if (d === "Cancelled") return "#737686";
  return "#b45309";
}
