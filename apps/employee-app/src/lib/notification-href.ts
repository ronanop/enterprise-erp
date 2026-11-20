import type { EssNotification } from "@/types/api";

function idFromHref(href: string, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    if (href.startsWith(prefix)) {
      const rest = href.slice(prefix.length).split(/[/?#]/)[0];
      if (rest) return rest;
    }
  }
  return null;
}

function isManagerTeamRequest(
  n: Pick<EssNotification, "kind" | "href" | "title" | "body">,
): boolean {
  const raw = (n.href || "").trim();
  const blob = `${n.kind || ""} ${n.title || ""} ${n.body || ""}`.toLowerCase();
  if (raw === "/approvals" || raw.startsWith("/approvals")) return true;
  if (blob.includes("[manager]")) return true;
  if (blob.includes("team approvals") || blob.includes("open team approvals"))
    return true;
  if (blob.includes("submitted_manager") || blob.endsWith("_manager")) return true;
  return (
    blob.includes("leave request from") ||
    blob.includes("wfh from") ||
    blob.includes("on duty from") ||
    blob.includes("regularization from")
  );
}

/** In-app route for an ESS notification (approved / rejected / request pages). */
export function resolveEssNotificationHref(
  n: Pick<EssNotification, "kind" | "href" | "title" | "body">,
): string {
  const raw = (n.href || "").trim();
  const kind = `${n.kind || ""} ${n.title || ""} ${n.body || ""}`.toLowerCase();

  // Team member → manager: always open Team Approvals.
  if (isManagerTeamRequest(n)) return "/approvals";

  // HRMS inbox paths → ESS manager approvals.
  if (raw.startsWith("/hr/ess") || raw === "/hr/ess-inbox") return "/approvals";

  // Prefer explicit ESS detail routes already on the payload.
  if (raw.startsWith("/leave/")) return raw;
  if (raw.startsWith("/payslips/")) return raw;
  if (raw.startsWith("/attendance/")) return raw;
  if (raw.startsWith("/") && !raw.startsWith("/hr/")) {
    if (raw === "/leave" || raw.startsWith("/leave?")) return "/leave";
    return raw;
  }

  const leaveId =
    idFromHref(raw, ["/leave/"]) ||
    (raw.match(/leave[_-]?request[_-]?id[=:]([0-9a-f-]{36})/i)?.[1] ?? null);
  if (leaveId) return `/leave/${leaveId}`;

  if (kind.includes("meeting") || kind.includes("meeting room") || kind.includes("room booking")) {
    return "/rooms";
  }

  if (kind.includes("compoff") || kind.includes("comp off")) {
    return "/attendance/compoff";
  }

  if (kind.includes("leave")) {
    if (
      kind.includes("approv") ||
      kind.includes("reject") ||
      kind.includes("cancel")
    ) {
      return "/leave/history";
    }
    return "/leave";
  }

  if (kind.includes("wfh") || kind.includes("work from home")) {
    return "/attendance/wfh";
  }
  if (
    kind.includes("on tour") ||
    kind.includes("on_tour") ||
    kind.includes("business travel") ||
    kind.includes("travel request")
  ) {
    return "/attendance/on-tour";
  }
  if (
    kind.includes("on_duty") ||
    kind.includes("on duty") ||
    kind.includes("on-duty")
  ) {
    return "/attendance/on-duty";
  }
  if (
    kind.includes("attendance") ||
    kind.includes("miss punch") ||
    kind.includes("correction") ||
    kind.includes("regular")
  ) {
    return "/attendance/correction";
  }
  if (
    kind.includes("salary") ||
    kind.includes("payslip") ||
    kind.includes("payroll")
  ) {
    return "/payslips";
  }
  if (kind.includes("policy") || kind.includes("compliance")) return "/compliance";
  if (
    kind.includes("announce") ||
    kind.includes("holiday") ||
    kind.includes("event")
  ) {
    return "/announcements";
  }
  if (kind.includes("document")) return "/documents";
  return "/home";
}
