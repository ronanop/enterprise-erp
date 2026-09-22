import type { NotificationItem } from "@/types/hr-executive-dashboard";

export function hrNotificationHref(n: Pick<NotificationItem, "kind" | "href">): string {
  if (n.href) return n.href;
  switch (n.kind) {
    case "leave":
      return "/hr/ess-inbox";
    case "birthday":
      return "/hr";
    case "payroll_due":
      return "/hr/payroll";
    case "interview":
    case "offer":
      return "/hr/recruitment";
    case "document":
    case "probation":
      return "/hr/workforce";
    case "policy":
      return "/hr/ess-policies";
    default:
      return "/hr/ess-inbox";
  }
}
