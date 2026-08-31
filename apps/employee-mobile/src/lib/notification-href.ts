import type { EssNotification } from "@/types/api";

/** Maps ESS notification kind/href to Expo Router paths. */
export function resolveEssNotificationHref(
  n: Pick<EssNotification, "kind" | "href">,
): string {
  const href = n.href?.trim();
  if (href) {
    if (href.startsWith("/approvals")) return "/approvals";
    if (href.startsWith("/leave")) return "/(tabs)/leave";
    if (href.startsWith("/payslip")) return "/(tabs)/payslips";
    if (href.startsWith("/attendance")) return "/(tabs)/attendance";
    if (href.startsWith("/home")) return "/(tabs)/home";
    if (href.startsWith("/notifications")) return "/notifications";
    if (href.startsWith("/performance")) return "/performance";
    if (href.startsWith("/training")) return "/training";
    if (href.startsWith("/separation")) return "/separation";
  }

  const kind = (n.kind || "").toLowerCase();
  if (kind.includes("approv") || kind === "manager") return "/approvals";
  if (kind.includes("leave") || kind === "compoff" || kind === "on_duty") {
    return "/(tabs)/leave";
  }
  if (kind.includes("salary") || kind.includes("payslip") || kind === "payroll") {
    return "/(tabs)/payslips";
  }
  if (
    kind.includes("attendance") ||
    kind.includes("clock") ||
    kind.includes("wfh") ||
    kind.includes("regular")
  ) {
    return "/(tabs)/attendance";
  }
  if (kind.includes("announce") || kind === "event") return "/announcements";
  if (kind.includes("document")) return "/documents";
  if (kind.includes("policy") || kind.includes("compliance")) return "/compliance";
  if (kind.includes("support") || kind.includes("ticket")) return "/support";
  if (kind.includes("room") || kind.includes("meeting")) return "/rooms";
  if (kind.includes("asset")) return "/assets";
  if (kind.includes("performance") || kind.includes("review")) return "/performance";
  if (kind.includes("training") || kind.includes("course")) return "/training";
  if (kind.includes("separat") || kind.includes("resign")) return "/separation";
  return "/(tabs)/home";
}
