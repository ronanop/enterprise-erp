/**
 * CRM workspace config — aligned with FRD-05 screen inventory
 * and apps/api CRM routers (Lead → Opportunity → Activities).
 */

import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  ClipboardList,
  Handshake,
  Megaphone,
  MessageSquare,
  Target,
  UserPlus,
  Users,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type CrmWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type CrmPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource: "leads" | "opportunities" | "tasks" | "followups" | "meetings";
};

export const CRM_MODULE_KEY = "crm";

export const crmWorkspaceGroups: CrmWorkspaceGroup[] = [
  {
    key: "leads",
    title: "Lead Management",
    description: "Sources, leads, assignments, and lead activities",
    icon: UserPlus,
    resourceKeys: ["lead-sources", "leads", "lead-assignments", "lead-activities"],
  },
  {
    key: "pipeline",
    title: "Pipeline & Campaigns",
    description: "Pipelines, opportunities, stages, and campaigns",
    icon: Target,
    resourceKeys: ["pipelines", "opportunities", "opportunity-stages", "campaigns"],
  },
  {
    key: "engagement",
    title: "Engagement & Feedback",
    description: "Interactions, tasks, meetings, logs, and CSAT",
    icon: MessageSquare,
    resourceKeys: [
      "interactions",
      "tasks",
      "followups",
      "meetings",
      "call-logs",
      "email-logs",
      "visit-logs",
      "customer-feedback",
      "customer-satisfaction",
    ],
  },
];

/** FRD-05 CRM lifecycle (core operational stages) */
export const crmPipelineStages: CrmPipelineStage[] = [
  { key: "lead", title: "Lead", href: "/crm/leads", resource: "leads" },
  {
    key: "opportunity",
    title: "Opportunity",
    href: "/crm/opportunities",
    resource: "opportunities",
  },
  { key: "task", title: "Task", href: "/crm/tasks", resource: "tasks" },
  { key: "followup", title: "Follow-up", href: "/crm/followups", resource: "followups" },
  { key: "meeting", title: "Meeting", href: "/crm/meetings", resource: "meetings" },
];

export function getCrmResources(): ModuleResource[] {
  return getModule(CRM_MODULE_KEY)?.resources ?? [];
}

export function resolveCrmGroupResources(group: CrmWorkspaceGroup): ModuleResource[] {
  const all = getCrmResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const crmQuickLinks = [
  {
    title: "Leads",
    href: "/crm/leads",
    description: "Prospect pipeline",
    icon: Users,
  },
  {
    title: "Opportunities",
    href: "/crm/opportunities",
    description: "Deal book",
    icon: Handshake,
  },
  {
    title: "Campaigns",
    href: "/crm/campaigns",
    description: "Marketing campaigns",
    icon: Megaphone,
  },
  {
    title: "Tasks",
    href: "/crm/tasks",
    description: "Sales tasks",
    icon: ClipboardList,
  },
] as const;

export const crmIcons = {
  CalendarCheck,
} as const;
