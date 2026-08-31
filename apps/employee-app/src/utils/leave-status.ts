export type LeaveStatusDisplay = "Pending" | "Approved" | "Rejected" | "Cancelled";

/** Simplified leave status for employee-facing lists and badges. */
export function leaveStatusDisplay(status: string): LeaveStatusDisplay {
  const s = status.toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  if (s === "cancelled") return "Cancelled";
  return "Pending";
}
