import type { EssNotification } from "@/types/api";

/** In-app route for an ESS notification (PWA paths). */
export function resolveEssNotificationHref(
  n: Pick<EssNotification, "kind" | "href">,
): string {
  if (n.href?.startsWith("/")) return n.href;
  const kind = (n.kind || "").toLowerCase();
  if (kind.includes("leave") || kind === "compoff" || kind === "on_duty") {
    return "/leave";
  }
  if (kind.includes("approv") || kind === "manager") return "/approvals";
  if (kind.includes("salary") || kind.includes("payslip") || kind === "payroll") {
    return "/payslips";
  }
  if (
    kind.includes("attendance") ||
    kind.includes("clock") ||
    kind === "task" ||
    kind.includes("wfh") ||
    kind.includes("regular")
  ) {
    return "/attendance";
  }
  if (kind.includes("policy") || kind.includes("compliance")) return "/compliance";
  if (kind === "event" || kind.includes("announce")) return "/announcements";
  if (kind === "birthday" || kind.includes("team")) return "/team";
  if (kind.includes("document")) return "/documents";
  return "/home";
}
