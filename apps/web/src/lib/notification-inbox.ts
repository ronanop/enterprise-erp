import { WORKSPACE_SIDEBARS } from "@/config/workspace-sidebars";

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

/** Module key the topbar bell filters to (`all` = platform-wide inbox). */
export type NotificationModuleScope = "all" | string;

const HR_KINDS = new Set([
  "leave",
  "birthday",
  "anniversary",
  "payroll_due",
  "interview",
  "offer",
  "document",
  "probation",
  "policy",
]);

const CUSTOM_ROOTS: { scope: string; root: string }[] = [
  { scope: "crm", root: "/crm" },
  { scope: "projects", root: "/projects" },
  { scope: "procurement", root: "/procurement" },
  { scope: "assets", root: "/assets" },
  { scope: "marketing", root: "/marketing" },
  { scope: "service", root: "/service" },
  ...WORKSPACE_SIDEBARS.map((entry) => ({
    scope: entry.moduleKey,
    root: entry.root,
  })),
];

function underRoot(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

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
  const key = kind.toLowerCase();
  switch (key) {
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
      if (key.startsWith("hr.") || key.startsWith("hr_")) return "/hr/ess-inbox";
      if (key.startsWith("crm.") || key.startsWith("crm_")) return "/crm/my-jobs";
      if (key.startsWith("project.") || key.startsWith("project_")) return "/projects/my-jobs";
      if (key.includes("procurement") || key.includes("scm") || key.includes("delivery")) {
        return "/procurement";
      }
      if (key.includes("finance")) return "/finance";
      if (key.includes("asset")) return "/assets";
      return "/home";
  }
}

/** Resolve which module's notifications the shell bell should show. */
export function resolveNotificationModuleScope(pathname: string): NotificationModuleScope {
  for (const entry of CUSTOM_ROOTS) {
    if (underRoot(pathname, entry.root)) return entry.scope;
  }
  return "all";
}

function matchesModule(item: InboxNotification, scope: NotificationModuleScope): boolean {
  if (scope === "all") return true;

  const href = (item.href ?? "").toLowerCase();
  const kind = item.kind.toLowerCase();
  const text = `${kind} ${href} ${item.title} ${item.body}`.toLowerCase();
  const scopeKey = scope.toLowerCase();

  if (scopeKey === "hr" || scopeKey === "payroll" || scopeKey === "recruitment") {
    return (
      href.startsWith("/hr") ||
      kind.startsWith("hr.") ||
      kind.startsWith("hr_") ||
      kind.startsWith("rec.") ||
      HR_KINDS.has(kind) ||
      (scopeKey === "payroll" && kind.includes("payroll")) ||
      (scopeKey === "recruitment" && (kind.includes("recruit") || kind.startsWith("rec.")))
    );
  }

  if (scopeKey === "crm") {
    return href.startsWith("/crm") || kind.startsWith("crm.") || kind.startsWith("crm_");
  }

  if (scopeKey === "projects") {
    return (
      href.startsWith("/projects") ||
      kind.startsWith("project.") ||
      kind.startsWith("project_") ||
      text.includes("site_stage")
    );
  }

  if (scopeKey === "procurement") {
    return (
      href.startsWith("/procurement") ||
      kind.includes("procurement") ||
      kind.includes("scm") ||
      kind.includes("delivery") ||
      kind.includes("grn")
    );
  }

  const root = CUSTOM_ROOTS.find((entry) => entry.scope === scopeKey)?.root ?? `/${scopeKey}`;
  return href.startsWith(root) || kind.includes(scopeKey) || text.includes(scopeKey);
}

export function filterInboxForModule(
  items: readonly InboxNotification[],
  scope: NotificationModuleScope,
): InboxNotification[] {
  return items.filter((item) => matchesModule(item, scope));
}

export function notificationBellFooter(
  scope: NotificationModuleScope,
): { href: string; label: string } | null {
  switch (scope) {
    case "all":
      return { href: "/home", label: "Workspace home" };
    case "hr":
    case "payroll":
    case "recruitment":
      return { href: "/hr/ess-inbox", label: "Employee requests" };
    case "crm":
      return { href: "/crm/my-jobs", label: "CRM my jobs" };
    case "projects":
      return { href: "/projects/my-jobs", label: "Project my jobs" };
    case "procurement":
      return { href: "/procurement/approval", label: "Procurement approvals" };
    default: {
      const root = CUSTOM_ROOTS.find((entry) => entry.scope === scope)?.root ?? `/${scope}`;
      const title = scope.charAt(0).toUpperCase() + scope.slice(1);
      return { href: root, label: `${title} workspace` };
    }
  }
}
