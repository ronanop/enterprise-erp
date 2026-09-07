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
  FilePenLine,
  FileText,
  Gift,
  LayoutDashboard,
  MonitorCog,
  Package,
  Plane,
  Settings2,
  Shield,
  ShoppingBag,
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
  /** Superadmin Panel — hidden from HR Admins */
  superAdminOnly?: boolean;
  /** Superadmin can grant this key to an HR Admin. Omit on Superadmin Panel. */
  navKey?: string;
};

export type HrNavGroup = {
  label: string;
  items: HrNavItem[];
};

export type HrNavAccessToggle = { navKey: string; title: string };
export type HrNavAccessGroup = { label: string; items: HrNavAccessToggle[] };

/** Flat order: Dashboard → hire → employees → time → talent → pay → utilities → offboarding. */
export const hrNavGroups: HrNavGroup[] = [
  {
    label: "",
    items: [
      {
        title: "Dashboard & Reports",
        href: "/hr",
        icon: LayoutDashboard,
        description: "Executive HR overview & analytics",
        navKey: "dashboard",
      },
      {
        title: "Recruitment",
        href: "/hr/recruitment",
        icon: Briefcase,
        description: "ATS — jobs, pipeline & offers",
        navKey: "recruitment",
      },
      {
        title: "Onboarding",
        href: "/hr/onboarding",
        icon: UserPlus,
        description: "Pre-joining portal & activation",
        navKey: "onboarding",
      },
      {
        title: "Employees",
        href: "/hr/workforce",
        icon: Users,
        description: "Employee directory",
        navKey: "employees",
      },
      {
        title: "Attendance",
        href: "/hr/time",
        icon: ClipboardCheck,
        description: "Attendance register & calendar",
        navKey: "attendance",
      },
      // Hidden for now — restore to show Leave in the sidebar
      // {
      //   title: "Leave",
      //   href: "/hr/leave",
      //   icon: CalendarDays,
      //   description: "Leave requests & approvals",
      // },
      {
        title: "Biometric Devices",
        href: "/hr/time/biometric-devices",
        icon: Fingerprint,
        description: "Device registry & punch sync API",
        navKey: "biometric-devices",
      },
      {
        title: "Performance",
        href: "/hr/talent",
        icon: BadgeCheck,
        description: "Goals, KPIs, reviews & appraisals",
        navKey: "performance",
      },
      {
        title: "Training",
        href: "/hr/learning",
        icon: GraduationCap,
        description: "Programs and completion",
        navKey: "training",
      },
      {
        title: "Payroll",
        href: "/hr/payroll",
        icon: Wallet,
        description: "Salary structures, runs, payslips & incentives",
        children: [
          {
            title: "Salary structure",
            href: "/hr/payroll?section=salary-structure",
            icon: Wallet,
            description: "CTC templates and components",
            navKey: "payroll-salary-structure",
          },
          {
            title: "Assign salary",
            href: "/hr/payroll?section=assign-salary",
            icon: Users,
            description: "Assign structures and CTC to employees",
            navKey: "payroll-assign-salary",
          },
          {
            title: "Run payroll",
            href: "/hr/payroll?section=run-payroll",
            icon: ClipboardList,
            description: "Monthly payroll run and month lock",
            navKey: "payroll-run",
          },
          {
            title: "Payslip",
            href: "/hr/payroll?section=payslip",
            icon: FileText,
            description: "Generate and download employee payslips",
            navKey: "payroll-payslip",
          },
          {
            title: "Revised salary",
            href: "/hr/payroll?section=revised-salary",
            icon: FilePenLine,
            description: "Salary revisions and effective dates",
            navKey: "payroll-revised-salary",
          },
          {
            title: "Incentives",
            href: "/hr/payroll?section=incentives",
            icon: Gift,
            description: "Bonuses, arrears, and incentives",
            navKey: "payroll-incentives",
          },
          {
            title: "Salary configuration",
            href: "/hr/payroll?section=salary-configuration",
            icon: Settings2,
            description: "30-day salary basis, sandwich, and PF",
            navKey: "payroll-salary-configuration",
          },
        ],
      },
      {
        title: "Employee Requests",
        href: "/hr/ess",
        icon: Bell,
        description: "Employee requests & approval notifications",
        navKey: "employee-requests",
      },
      {
        title: "EDoc",
        href: "/hr/edoc",
        icon: FileStack,
        description: "Employee document vault, types & onboarding policies",
        navKey: "edoc",
      },
      {
        title: "Org Setup",
        href: "/hr/setup",
        icon: Settings2,
        description: "Organisation, employment, leave & roster configuration",
        children: [
          {
            title: "Organisation",
            href: "/hr/setup?section=organization",
            icon: Building2,
            description: "Branches, departments, designations",
            navKey: "org-organisation",
          },
          {
            title: "Employment",
            href: "/hr/setup?section=employment",
            icon: Briefcase,
            description: "Groups, types, documents & onboarding policies",
            navKey: "org-employment",
          },
          {
            title: "Leave Setup",
            href: "/hr/setup?section=leave",
            icon: CalendarDays,
            description: "Leave types, holidays, attendance policy",
            navKey: "org-leave-setup",
          },
          {
            title: "Shifts & Roster",
            href: "/hr/roster",
            icon: ClipboardList,
            description: "Shifts, roster & rotations",
            navKey: "org-shifts-roster",
          },
        ],
      },
      {
        title: "IT & Admin",
        href: "/hr/it-admin",
        icon: MonitorCog,
        description: "Meeting rooms, stocks, travel & requisitions",
        children: [
          {
            title: "Meeting Room",
            href: "/hr/meeting-rooms",
            icon: DoorOpen,
            description: "Rooms, equipment, and meeting requests",
            navKey: "it-meeting-room",
          },
          {
            title: "Stocks Manage",
            href: "/hr/it-admin/stocks",
            icon: Package,
            description: "Admin stock inventory & issues",
            navKey: "it-stocks",
          },
          {
            title: "Travel Desk",
            href: "/hr/it-admin/travel",
            icon: Plane,
            description: "Travel requests & bookings",
            navKey: "it-travel",
          },
          {
            title: "Requisition",
            href: "/hr/it-admin/requisition",
            icon: ShoppingBag,
            description: "ID card, visiting card, t-shirts, gifts",
            navKey: "it-requisition",
          },
        ],
      },
      {
        title: "Offboarding",
        href: "/hr/separation",
        icon: UserMinus,
        description: "Resignation, clearance, exit interview & FNF",
        navKey: "offboarding",
      },
      {
        title: "Superadmin Panel",
        href: "/hr/superadmin",
        icon: Shield,
        description: "Assign HR Admins and HR module users — visible only to HRMS Superadmin",
        superAdminOnly: true,
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

export function collectHrNavKeys(groups: HrNavGroup[] = hrNavGroups): string[] {
  const keys: string[] = [];
  for (const g of groups) {
    for (const item of g.items) {
      if (item.superAdminOnly) continue;
      if (item.children?.length) {
        for (const child of item.children) {
          if (child.navKey) keys.push(child.navKey);
        }
      } else if (item.navKey) {
        keys.push(item.navKey);
      }
    }
  }
  return keys;
}

export const ALL_HR_NAV_KEYS = collectHrNavKeys();

export function hrNavAccessGroups(groups: HrNavGroup[] = hrNavGroups): HrNavAccessGroup[] {
  const out: HrNavAccessGroup[] = [];
  for (const g of groups) {
    for (const item of g.items) {
      if (item.superAdminOnly) continue;
      if (item.children?.length) {
        out.push({
          label: item.title,
          items: item.children
            .filter((child): child is HrNavItem & { navKey: string } => Boolean(child.navKey))
            .map((child) => ({ navKey: child.navKey, title: child.title })),
        });
        continue;
      }
      if (!item.navKey) continue;
      const last = out[out.length - 1];
      if (last && last.label === "") {
        last.items.push({ navKey: item.navKey, title: item.title });
      } else {
        out.push({ label: "", items: [{ navKey: item.navKey, title: item.title }] });
      }
    }
  }
  return out;
}
