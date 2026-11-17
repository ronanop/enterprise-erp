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

/** In-app route for an ESS notification (approved / rejected / request pages). */
export function resolveEssNotificationHref(
  n: Pick<EssNotification, "kind" | "href" | "title" | "body">,
): string {
  const raw = (n.href || "").trim();
  const kind = `${n.kind || ""} ${n.title || ""} ${n.body || ""}`.toLowerCase();

  // HRMS inbox paths → ESS manager approvals.
  if (raw.startsWith("/hr/ess") || raw === "/hr/ess-inbox") return "/approvals";

  // Prefer explicit ESS detail routes already on the payload.
  if (raw.startsWith("/leave/")) return raw;
  if (raw.startsWith("/payslips/")) return raw;
  if (raw.startsWith("/attendance/")) return raw;
  if (raw === "/approvals" || raw.startsWith("/approvals")) return "/approvals";
  if (raw.startsWith("/") && !raw.startsWith("/hr/")) {
    // Map generic section roots to the right detail when we can.
    if (raw === "/leave" || raw.startsWith("/leave?")) {
      // keep generic leave list unless title implies team approve
      if (kind.includes("[manager]") || kind.includes("pending approval")) {
        return "/approvals";
      }
      return "/leave";
    }
    return raw;
  }

  if (kind.includes("[manager]") || kind.includes("needs approval") || kind.includes("pending approval")) {
    return "/approvals";
  }

  const leaveId =
    idFromHref(raw, ["/leave/"]) ||
    (raw.match(/leave[_-]?request[_-]?id[=:]([0-9a-f-]{36})/i)?.[1] ?? null);
  if (leaveId) return `/leave/${leaveId}`;

  if (
    kind.includes("leave") ||
    kind.includes("compoff") ||
    kind.includes("comp off")
  ) {
    if (kind.includes("approv") || kind.includes("reject") || kind.includes("cancel")) {
      return "/leave/history";
    }
    return "/leave";
  }

  if (kind.includes("wfh") || kind.includes("work from home")) {
    return "/attendance/wfh";
  }
  if (kind.includes("on_duty") || kind.includes("on duty") || kind.includes("on-duty")) {
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
  if (kind.includes("salary") || kind.includes("payslip") || kind.includes("payroll")) {
    return "/payslips";
  }
  if (kind.includes("policy") || kind.includes("compliance")) return "/compliance";
  if (kind.includes("announce") || kind.includes("holiday") || kind.includes("event")) {
    return "/announcements";
  }
  if (kind.includes("document")) return "/documents";
  return "/home";
}
