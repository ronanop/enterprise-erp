/**
 * HRMS workspace config — aligned with FRD-09 screen inventory
 * and apps/api HR routers (Employee → Attendance → Leave → Performance).
 */

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  IdCard,
  UserRound,
  Users,
  UserX,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type HrWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type HrPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "employee-profiles"
    | "employment"
    | "attendance"
    | "leave-requests"
    | "training";
};

export const HR_MODULE_KEY = "hr";

export const hrWorkspaceGroups: HrWorkspaceGroup[] = [
  {
    key: "workforce",
    title: "Workforce",
    description: "Designations, employee profiles, and employment",
    icon: Users,
    resourceKeys: ["designations", "employee-profiles", "employment"],
  },
  {
    key: "time",
    title: "Time & Leave",
    description: "Shifts, holidays, attendance, balances, and leave requests",
    icon: CalendarDays,
    resourceKeys: [
      "shifts",
      "shift-assignments",
      "holiday-calendars",
      "leave-types",
      "leave-balances",
      "leave-requests",
      "attendance",
    ],
  },
  {
    key: "talent",
    title: "Talent & Exit",
    description: "Documents, reviews, goals, appraisals, training, separation",
    icon: GraduationCap,
    resourceKeys: [
      "employee-documents",
      "performance-reviews",
      "goals",
      "appraisals",
      "training",
      "separation",
    ],
  },
];

/** FRD-09 HR lifecycle (core operational stages) */
export const hrPipelineStages: HrPipelineStage[] = [
  {
    key: "profiles",
    title: "Profiles",
    href: "/hr/employee-profiles",
    resource: "employee-profiles",
  },
  { key: "employment", title: "Employment", href: "/hr/employment", resource: "employment" },
  { key: "attendance", title: "Attendance", href: "/hr/attendance", resource: "attendance" },
  {
    key: "leave",
    title: "Leave",
    href: "/hr/leave-requests",
    resource: "leave-requests",
  },
  { key: "training", title: "Training", href: "/hr/training", resource: "training" },
];

export function getHrResources(): ModuleResource[] {
  return getModule(HR_MODULE_KEY)?.resources ?? [];
}

export function resolveHrGroupResources(group: HrWorkspaceGroup): ModuleResource[] {
  const all = getHrResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const hrQuickLinks = [
  {
    title: "Profiles",
    href: "/hr/employee-profiles",
    description: "Employee master",
    icon: UserRound,
  },
  {
    title: "Attendance",
    href: "/hr/attendance",
    description: "Daily attendance",
    icon: ClipboardList,
  },
  {
    title: "Leave",
    href: "/hr/leave-requests",
    description: "Leave requests",
    icon: CalendarDays,
  },
  {
    title: "Reviews",
    href: "/hr/performance-reviews",
    description: "Performance reviews",
    icon: BadgeCheck,
  },
] as const;

export const hrIcons = {
  IdCard,
  UserX,
} as const;
