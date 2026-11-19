/** User-facing GRN status for badges and tables (internal values stay pending/partial/closed). */
export function formatGrnStatusBadgeLabel(status: string): string {
  const value = (status || "").toLowerCase();
  if (value === "pending") return "open";
  if (value === "closed" || value === "delivered") return "delivered";
  if (value === "partial") return "partial";
  return status ? status.toLowerCase() : "";
}

export function grnStatusMatchesSearch(status: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const label = formatGrnStatusBadgeLabel(status);
  return status.toLowerCase().includes(q) || label.includes(q);
}
