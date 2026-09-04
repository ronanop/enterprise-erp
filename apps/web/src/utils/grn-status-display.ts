/** User-facing GRN status for badges and tables (internal values stay pending/partial/closed). */
export function formatGrnStatusBadgeLabel(status: string): string {
  const value = (status || "").toLowerCase();
  if (value === "pending") return "open";
  if (value === "closed" || value === "delivered") return "close";
  if (value === "partial") return "partial";
  return status ? status.toLowerCase() : "";
}

/** Colored badge variants: open=sky, partial=amber, close=emerald. */
export type GrnBadgeVariant = "info" | "warning" | "success" | "outline";

export function grnBadgeVariant(status: string): GrnBadgeVariant {
  const value = (status || "").toLowerCase();
  if (value === "closed" || value === "delivered" || value === "close") return "success";
  if (value === "partial") return "warning";
  if (value === "pending" || value === "open") return "info";
  return "outline";
}

export function grnStatusMatchesSearch(status: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const label = formatGrnStatusBadgeLabel(status);
  return (
    status.toLowerCase().includes(q) ||
    label.includes(q) ||
    (q === "delivered" && valueIsClosed(status)) ||
    (q.includes("close") && valueIsClosed(status))
  );
}

function valueIsClosed(status: string): boolean {
  const value = (status || "").toLowerCase();
  return value === "closed" || value === "delivered";
}
