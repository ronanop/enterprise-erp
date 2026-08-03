/**
 * HRMS sidebar navigation — people stack under /hr.
 * Payroll / Recruitment are nested in the HRMS workspace for a unified HR feel.
 */

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Bell,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Clock3,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Settings2,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

export type HrNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

export type HrNavGroup = {
  label: string;
  items: HrNavItem[];
};

export const hrNavGroups: HrNavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        title: "Dashboard",
        href: "/hr",
        icon: LayoutDashboard,
        description: "Executive HR overview & analytics",
      },
      {
        title: "ESS",
        href: "/hr/ess",
        icon: Bell,
        description: "Employee requests & approval notifications",
      },
      {
        title: "Employees",
        href: "/hr/workforce",
        icon: Users,
        description: "Employee directory",
      },
      {
        title: "HR Setup",
        href: "/hr/setup",
        icon: Settings2,
        description: "Designations, leave types, holidays",
      },
    ],
  },
  {
    label: "Time & Leave",
    items: [
      {
        title: "Leave",
        href: "/hr/leave",
        icon: CalendarDays,
        description: "Requests, balances & approvals",
      },
      {
        title: "Attendance",
        href: "/hr/time",
        icon: Clock3,
        description: "Attendance register, calendar & OT",
      },
      {
        title: "On Duty & OT",
        href: "/hr/time/ot-allotment",
        icon: Clock3,
        description: "On Duty, OT/overday & Comp Off approvals",
      },
      {
        title: "Biometric devices",
        href: "/hr/time/biometric-devices",
        icon: Clock3,
        description: "Device registry & punch sync API",
      },
      {
        title: "Shifts & Roster",
        href: "/hr/roster",
        icon: ClipboardList,
        description: "Shifts, roster & rotations",
      },
    ],
  },
  {
    label: "Talent & Learning",
    items: [
      {
        title: "Performance",
        href: "/hr/talent",
        icon: BadgeCheck,
        description: "Goals, KPIs, reviews & appraisals",
      },
      {
        title: "Training",
        href: "/hr/learning",
        icon: GraduationCap,
        description: "Programs and completion",
      },
      {
        title: "Separation",
        href: "/hr/separation",
        icon: UserMinus,
        description: "Exit and clearance",
      },
    ],
  },
  {
    label: "Hire & Pay",
    items: [
      {
        title: "Recruitment",
        href: "/hr/recruitment",
        icon: Briefcase,
        description: "ATS — jobs, pipeline & offers",
      },
      {
        title: "Onboarding",
        href: "/hr/onboarding",
        icon: UserPlus,
        description: "Pre-joining portal & activation",
      },
      {
        title: "Payroll",
        href: "/hr/payroll",
        icon: Wallet,
        description: "Structures, runs, payslips & compliance",
      },
      {
        title: "Reports",
        href: "/hr/reports",
        icon: Gauge,
        description: "HR KPIs and summaries",
      },
    ],
  },
];

export function isHrPath(pathname: string): boolean {
  return pathname === "/hr" || pathname.startsWith("/hr/");
}
