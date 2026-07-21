/**
 * Portal workspace config — aligned with ERD_23 Customer Portal
 * and apps/api portal routers (Account → Service Request).
 */

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Ticket,
  UserCircle,
  Users,
  Wrench,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type PortalWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type PortalPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "portal-accounts"
    | "portal-sessions"
    | "order-views"
    | "invoice-views"
    | "support-tickets"
    | "service-requests";
};

export const PORTAL_MODULE_KEY = "portal";

export const portalWorkspaceGroups: PortalWorkspaceGroup[] = [
  {
    key: "identity",
    title: "Identity & Access",
    description: "Accounts, profiles, sessions, and login audits",
    icon: Users,
    resourceKeys: [
      "portal-accounts",
      "customer-profiles",
      "portal-sessions",
      "login-audits",
    ],
  },
  {
    key: "experience",
    title: "Experience & Comms",
    description: "Dashboards, notifications, messages, and preferences",
    icon: LayoutDashboard,
    resourceKeys: [
      "dashboards",
      "notifications",
      "message-threads",
      "preferences",
    ],
  },
  {
    key: "views",
    title: "Views & Requests",
    description: "Order/invoice views, documents, tickets, and service requests",
    icon: Ticket,
    resourceKeys: [
      "order-views",
      "invoice-views",
      "document-access",
      "support-tickets",
      "service-requests",
    ],
  },
];

/** ERD_23 self-service flow (core operational stages) */
export const portalPipelineStages: PortalPipelineStage[] = [
  {
    key: "account",
    title: "Account",
    href: "/portal/portal-accounts",
    resource: "portal-accounts",
  },
  {
    key: "session",
    title: "Session",
    href: "/portal/portal-sessions",
    resource: "portal-sessions",
  },
  {
    key: "order",
    title: "Order View",
    href: "/portal/order-views",
    resource: "order-views",
  },
  {
    key: "invoice",
    title: "Invoice View",
    href: "/portal/invoice-views",
    resource: "invoice-views",
  },
  {
    key: "ticket",
    title: "Ticket",
    href: "/portal/support-tickets",
    resource: "support-tickets",
  },
  {
    key: "service",
    title: "Service Req",
    href: "/portal/service-requests",
    resource: "service-requests",
  },
];

export function getPortalResources(): ModuleResource[] {
  return getModule(PORTAL_MODULE_KEY)?.resources ?? [];
}

export function resolvePortalGroupResources(
  group: PortalWorkspaceGroup,
): ModuleResource[] {
  const all = getPortalResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const portalQuickLinks = [
  {
    title: "Accounts",
    href: "/portal/portal-accounts",
    description: "Portal logins",
    icon: UserCircle,
  },
  {
    title: "Tickets",
    href: "/portal/support-tickets",
    description: "Support envelopes",
    icon: Ticket,
  },
  {
    title: "Orders",
    href: "/portal/order-views",
    description: "Projected order views",
    icon: FileText,
  },
  {
    title: "Service",
    href: "/portal/service-requests",
    description: "Service request envelopes",
    icon: Wrench,
  },
] as const;

export const portalIcons = {
  Bell,
  MessageSquare,
  LayoutDashboard,
} as const;
