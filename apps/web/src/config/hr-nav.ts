/**
 * HRMS sidebar navigation — flat list under /hr (no section headers).
 */

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  Fingerprint,
  DoorOpen,
  LayoutDashboard,
  Settings2,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
  GraduationCap,
} from "lucide-react";

export type HrNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  /** Nested links (e.g. Org Setup sections) */
  children?: HrNavItem[];
};

export type HrNavGroup = {
  label: string;
  items: HrNavItem[];
};

/** Flat order: Dashboard → hire → time → talent → pay, then utilities. */
export const hrNavGroups: HrNavGroup[] = [
  {
    label: "",
    items: [
      {
        title: "Dashboard and Reports",
        href: "/hr",
        icon: LayoutDashboard,
        description: "Executive HR overview & analytics",
      },
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
        title: "Attendance",
        href: "/hr/time",
        icon: ClipboardCheck,
        description: "Attendance register & calendar",
      },
      {
        title: "Shifts & Roster",
        href: "/hr/roster",
        icon: ClipboardList,
        description: "Shifts, roster & rotations",
      },
      {
        title: "Leave",
        href: "/hr/leave",
        icon: CalendarDays,
        description: "Leave requests & approvals",
      },
      {
        title: "Biometric Devices",
        href: "/hr/time/biometric-devices",
        icon: Fingerprint,
        description: "Device registry & punch sync API",
      },
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
        title: "Offboarding",
        href: "/hr/separation",
        icon: UserMinus,
        description: "Resignation, clearance, exit interview & FNF",
      },
      {
        title: "Payroll",
        href: "/hr/payroll",
        icon: Wallet,
        description: "Structures, runs, payslips & compliance",
      },
      {
        title: "Employees",
        href: "/hr/workforce",
        icon: Users,
        description: "Employee directory",
      },
      {
        title: "Employee Requests",
        href: "/hr/ess",
        icon: Bell,
        description: "Employee requests & approval notifications",
      },
      {
        title: "EDoc",
        href: "/hr/edoc",
        icon: FileStack,
        description: "Employee documents, policies & acceptance records",
      },
      {
        title: "Org Setup",
        href: "/hr/setup",
        icon: Settings2,
        description: "Organisation, employment & leave configuration",
        children: [
          {
            title: "Organisation",
            href: "/hr/setup?section=organization",
            icon: Building2,
            description: "Branches, departments, designations",
          },
          {
            title: "Employment",
            href: "/hr/setup?section=employment",
            icon: Briefcase,
            description: "Groups, types, documents & onboarding policies",
          },
          {
            title: "Leave Setup",
            href: "/hr/setup?section=leave",
            icon: CalendarDays,
            description: "Leave types, holidays, attendance policy",
          },
        ],
      },
      {
        title: "Meeting Room",
        href: "/hr/meeting-rooms",
        icon: DoorOpen,
        description: "Rooms, equipment, and meeting requests",
      },
    ],
  },
];

export function isHrPath(pathname: string): boolean {
  return pathname === "/hr" || pathname.startsWith("/hr/");
}

/** Flatten hrefs including nested children for active-path resolution. */
export function flattenHrNavHrefs(groups: HrNavGroup[] = hrNavGroups): string[] {
  const hrefs: string[] = [];
  for (const g of groups) {
    for (const item of g.items) {
      hrefs.push(item.href);
      for (const child of item.children ?? []) hrefs.push(child.href);
    }
  }
  return hrefs;
}
