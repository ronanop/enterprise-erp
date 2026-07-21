/**
 * Helpdesk workspace config — aligned with FRD-17 / ERD_17
 * and apps/api helpdesk routers (Ticket → Feedback).
 */

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Headphones,
  LifeBuoy,
  MessageSquareWarning,
  Ticket,
  Users,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type HelpdeskWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type HelpdeskPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "tickets"
    | "ticket-assignments"
    | "ticket-escalations"
    | "resolutions"
    | "knowledge-articles"
    | "customer-feedback";
};

export const HELPDESK_MODULE_KEY = "helpdesk";

export const helpdeskWorkspaceGroups: HelpdeskWorkspaceGroup[] = [
  {
    key: "tickets",
    title: "Catalog & Tickets",
    description: "Categories, priorities, tickets, assignments, comments",
    icon: Ticket,
    resourceKeys: [
      "ticket-categories",
      "ticket-priorities",
      "tickets",
      "ticket-assignments",
      "ticket-comments",
    ],
  },
  {
    key: "sla",
    title: "SLA & Closure",
    description: "SLAs, escalations, resolutions, and feedback",
    icon: MessageSquareWarning,
    resourceKeys: [
      "ticket-slas",
      "ticket-escalations",
      "resolutions",
      "customer-feedback",
    ],
  },
  {
    key: "knowledge",
    title: "Knowledge & Workforce",
    description: "KB, articles, teams, shifts, and schedules",
    icon: BookOpen,
    resourceKeys: [
      "knowledge-bases",
      "knowledge-articles",
      "support-teams",
      "support-shifts",
      "support-schedules",
    ],
  },
];

/** ERD_17 support lifecycle (core operational stages) */
export const helpdeskPipelineStages: HelpdeskPipelineStage[] = [
  {
    key: "ticket",
    title: "Ticket",
    href: "/helpdesk/tickets",
    resource: "tickets",
  },
  {
    key: "assignment",
    title: "Assignment",
    href: "/helpdesk/ticket-assignments",
    resource: "ticket-assignments",
  },
  {
    key: "escalation",
    title: "Escalation",
    href: "/helpdesk/ticket-escalations",
    resource: "ticket-escalations",
  },
  {
    key: "resolution",
    title: "Resolution",
    href: "/helpdesk/resolutions",
    resource: "resolutions",
  },
  {
    key: "article",
    title: "Article",
    href: "/helpdesk/knowledge-articles",
    resource: "knowledge-articles",
  },
  {
    key: "feedback",
    title: "Feedback",
    href: "/helpdesk/customer-feedback",
    resource: "customer-feedback",
  },
];

export function getHelpdeskResources(): ModuleResource[] {
  return getModule(HELPDESK_MODULE_KEY)?.resources ?? [];
}

export function resolveHelpdeskGroupResources(
  group: HelpdeskWorkspaceGroup,
): ModuleResource[] {
  const all = getHelpdeskResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const helpdeskQuickLinks = [
  {
    title: "Tickets",
    href: "/helpdesk/tickets",
    description: "Support queue",
    icon: Ticket,
  },
  {
    title: "Escalations",
    href: "/helpdesk/ticket-escalations",
    description: "SLA breaches",
    icon: LifeBuoy,
  },
  {
    title: "Knowledge",
    href: "/helpdesk/knowledge-articles",
    description: "Self-service KB",
    icon: BookOpen,
  },
  {
    title: "Teams",
    href: "/helpdesk/support-teams",
    description: "Support workforce",
    icon: Users,
  },
] as const;

export const helpdeskIcons = {
  Headphones,
} as const;
