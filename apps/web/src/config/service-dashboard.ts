/** Dashboard status buckets — shared with ticket list deep-links. */
export const SERVICE_STATUS_GROUPS = [
  {
    key: "registered",
    label: "Registered",
    statuses: ["ticket_registered", "awaiting_assignment", "new", "submitted"],
  },
  {
    key: "assigned",
    label: "Assigned",
    statuses: ["assigned"],
  },
  {
    key: "in_progress",
    label: "In progress",
    statuses: ["engineer_working", "in_progress", "pending_customer", "pending_oem"],
  },
  {
    key: "resolved",
    label: "Resolved",
    statuses: ["resolved"],
  },
  {
    key: "closed",
    label: "Closed",
    statuses: ["closed"],
  },
] as const;

export type ServiceStatusGroupKey = (typeof SERVICE_STATUS_GROUPS)[number]["key"];

export type ServiceDashboardLinkOpts = {
  mine?: boolean;
};

function withMineQuery(href: string, opts?: ServiceDashboardLinkOpts): string {
  if (!opts?.mine) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}mine=1`;
}

export function serviceStatusGroupHref(label: string, opts?: ServiceDashboardLinkOpts): string {
  const group = SERVICE_STATUS_GROUPS.find((g) => g.label === label);
  if (!group) return withMineQuery("/service/service-request-tickets", opts);
  if (group.key === "resolved") return withMineQuery("/service/resolved-tickets", opts);
  if (group.statuses.length === 1) {
    return withMineQuery(
      `/service/service-request-tickets?status=${encodeURIComponent(group.statuses[0])}`,
      opts,
    );
  }
  return withMineQuery(`/service/service-request-tickets?group=${encodeURIComponent(group.key)}`, opts);
}

export function serviceStatusGroupFromKey(key: string): (typeof SERVICE_STATUS_GROUPS)[number] | undefined {
  return SERVICE_STATUS_GROUPS.find((g) => g.key === key);
}

export type SlaDashboardFilter = "within" | "breached" | "at_risk" | "on_track";

export function serviceSlaFilterHref(filter: SlaDashboardFilter | "within" | "breached", opts?: ServiceDashboardLinkOpts): string {
  return withMineQuery(`/service/service-slas?filter=${encodeURIComponent(filter)}`, opts);
}

export function serviceSlaComplianceHref(outcome: "within" | "breach", opts?: ServiceDashboardLinkOpts): string {
  return withMineQuery(`/service/resolved-tickets?sla_outcome=${encodeURIComponent(outcome)}`, opts);
}

export function serviceSlaLabelHref(label: string, opts?: ServiceDashboardLinkOpts): string {
  const map: Record<string, string> = {
    "Currently breached": serviceSlaFilterHref("breached", opts),
    "Closed within SLA": serviceSlaComplianceHref("within", opts),
    "Closed after breach": serviceSlaComplianceHref("breach", opts),
    "Within SLA": serviceSlaFilterHref("within", opts),
    Breached: serviceSlaFilterHref("breached", opts),
    "At risk": serviceSlaFilterHref("at_risk", opts),
    "On track": serviceSlaFilterHref("on_track", opts),
  };
  return map[label] ?? withMineQuery("/service/resolved-tickets", opts);
}

export function serviceSupportModeHref(mode: string, opts?: ServiceDashboardLinkOpts): string {
  return withMineQuery(`/service/service-request-tickets?mode=${encodeURIComponent(mode)}`, opts);
}

export const SERVICE_SUPPORT_MODES = [
  { key: "remote_support", label: "Remote Support" },
  { key: "onsite_support", label: "Onsite Support" },
  { key: "oem_support", label: "OEM Support" },
] as const;

export function serviceSupportModeLabel(mode: string): string {
  return SERVICE_SUPPORT_MODES.find((m) => m.key === mode)?.label ?? mode.replace(/_/g, " ");
}

export function serviceResolvedDayHref(isoDate: string): string {
  return `/service/resolved-tickets?day=${encodeURIComponent(isoDate)}`;
}

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fixed locale so SSR and client chart labels match. */
export function formatChartDayLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
}
