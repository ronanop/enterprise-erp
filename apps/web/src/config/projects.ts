/**
 * Projects workspace config — aligned with FRD-11 / ERD_14
 * and apps/api project routers (Project → Budget).
 */

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ClipboardList,
  FolderKanban,
  GitBranch,
  Scale,
  Timer,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type ProjectsWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type ProjectsPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "projects"
    | "project-phases"
    | "project-milestones"
    | "project-tasks"
    | "timesheets"
    | "project-budgets";
};

export const PROJECTS_MODULE_KEY = "projects";

export const projectsWorkspaceGroups: ProjectsWorkspaceGroup[] = [
  {
    key: "wbs",
    title: "Portfolio & WBS",
    description: "Projects, phases, milestones, and tasks",
    icon: FolderKanban,
    resourceKeys: [
      "projects",
      "project-phases",
      "project-milestones",
      "project-tasks",
    ],
  },
  {
    key: "delivery",
    title: "Time & Resources",
    description: "Timesheets, entries, plans, and allocations",
    icon: Timer,
    resourceKeys: [
      "timesheets",
      "timesheet-entries",
      "resource-plans",
      "resource-allocations",
    ],
  },
  {
    key: "control",
    title: "Control & Governance",
    description: "Budgets, costs, issues, risks, changes, documents",
    icon: Scale,
    resourceKeys: [
      "project-budgets",
      "project-costs",
      "project-issues",
      "project-risks",
      "change-requests",
      "project-documents",
    ],
  },
];

/** ERD_14 delivery lifecycle (core operational stages) */
export const projectsPipelineStages: ProjectsPipelineStage[] = [
  {
    key: "project",
    title: "Project",
    href: "/projects/projects",
    resource: "projects",
  },
  {
    key: "phase",
    title: "Phase",
    href: "/projects/project-phases",
    resource: "project-phases",
  },
  {
    key: "milestone",
    title: "Milestone",
    href: "/projects/project-milestones",
    resource: "project-milestones",
  },
  {
    key: "task",
    title: "Task",
    href: "/projects/project-tasks",
    resource: "project-tasks",
  },
  {
    key: "timesheet",
    title: "Timesheet",
    href: "/projects/timesheets",
    resource: "timesheets",
  },
  {
    key: "budget",
    title: "Budget",
    href: "/projects/project-budgets",
    resource: "project-budgets",
  },
];

export function getProjectsResources(): ModuleResource[] {
  return getModule(PROJECTS_MODULE_KEY)?.resources ?? [];
}

export function resolveProjectsGroupResources(
  group: ProjectsWorkspaceGroup,
): ModuleResource[] {
  const all = getProjectsResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const projectsQuickLinks = [
  {
    title: "Projects",
    href: "/projects/projects",
    description: "Portfolio register",
    icon: FolderKanban,
  },
  {
    title: "Tasks",
    href: "/projects/project-tasks",
    description: "WBS work items",
    icon: ClipboardList,
  },
  {
    title: "Timesheets",
    href: "/projects/timesheets",
    description: "Time capture",
    icon: Timer,
  },
  {
    title: "Risks",
    href: "/projects/project-risks",
    description: "Risk register",
    icon: AlertTriangle,
  },
] as const;

export const projectsIcons = {
  GitBranch,
} as const;
