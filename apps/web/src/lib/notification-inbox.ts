export const NOTIFICATION_POLL_MS = 15_000;

export type InboxNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  unread: boolean;
  created_at: string;
  href: string | null;
  read_at: string | null;
};

function isSafeHref(href: string): boolean {
  const value = href.trim();
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("://") &&
    !value.includes("\\")
  );
}

export function mapInboxHref(href: string | null | undefined, kind: string): string {
  if (href) {
    const trimmed = href.trim();
    if (isSafeHref(trimmed)) return trimmed;
  }
  switch (kind) {
    case "leave":
      return "/hr/ess-inbox";
    case "birthday":
    case "anniversary":
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
