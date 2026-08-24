/**
 * HR Setup configuration center — section + tab registry (Darwinbox-style).
 */

import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  Clock3,
  FileText,
  FolderTree,
  GitBranch,
  Layers,
  Mail,
  MapPin,
  DoorOpen,
  Shield,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

export type HrSetupTabId =
  | "branches"
  | "departments"
  | "designations"
  | "job-levels"
  | "grades"
  | "work-locations"
  | "rooms"
  | "entities"
  | "employment-types"
  | "employment-type"
  | "reporting"
  | "document-types"
  | "onboarding-policies"
  | "leave-policies"
  | "leave-types"
  | "holiday-calendar"
  | "shift-master"
  | "shift-rotation"
  | "shift-assignment"
  | "attendance-rules"
  | "salary-components"
  | "bank-master"
  | "tax-rules"
  | "pf-esi"
  | "approval-flows"
  | "email-templates"
  | "notification-settings"
  | "roles-permissions";

export type HrSetupSectionId = "organization" | "employment" | "leave";

export type HrSetupTab = {
  id: HrSetupTabId;
  title: string;
  description: string;
  /** api = FastAPI resource; local = browser config store; derived = computed list */
  source: "api" | "local" | "derived";
  apiPath?: string;
  codePrefix?: string;
};

export type HrSetupSection = {
  id: HrSetupSectionId;
  title: string;
  description: string;
  icon: LucideIcon;
  tabs: HrSetupTab[];
};

export const hrSetupSections: HrSetupSection[] = [
  {
    id: "organization",
    title: "Organization",
    description: "Company structure and job architecture",
    icon: Building2,
    tabs: [
      {
        id: "branches",
        title: "Branches",
        description: "Operating branches and locations",
        source: "api",
        apiPath: "/branches",
        codePrefix: "BR",
      },
      {
        id: "departments",
        title: "Departments",
        description: "Department hierarchy",
        source: "api",
        apiPath: "/departments",
        codePrefix: "DEP",
      },
      {
        id: "designations",
        title: "Designations",
        description: "Job titles and levels",
        source: "api",
        apiPath: "/hr/designations",
        codePrefix: "DES",
      },
      {
        id: "job-levels",
        title: "Job Levels",
        description: "Junior through CXO bands",
        source: "api",
        apiPath: "/hr/job-levels",
        codePrefix: "LVL",
      },
      {
        id: "grades",
        title: "Grades",
        description: "Pay grades and salary bands",
        source: "api",
        apiPath: "/hr/grades",
        codePrefix: "GRD",
      },
      {
        id: "work-locations",
        title: "Base Location",
        description: "Office / site address and geofence",
        source: "api",
        apiPath: "/locations",
        codePrefix: "LOC",
      },
      {
        id: "entities",
        title: "Legal Entities",
        description: "Company / legal entities for employee assignment",
        source: "local",
        codePrefix: "ENT",
      },
    ],
  },
  {
    id: "employment",
    title: "Employment",
    description: "Employment taxonomy and documents",
    icon: Briefcase,
    tabs: [
      {
        id: "employment-types",
        title: "Employment Group",
        description: "Management groups — shifts, calendars, feature toggles",
        source: "api",
        apiPath: "/hr/management-groups",
        codePrefix: "MG",
      },
      {
        id: "employment-type",
        title: "Employment Type",
        description: "Permanent, contract, trainee — used in profiles and onboarding",
        source: "local",
        codePrefix: "ET",
      },
      {
        id: "reporting",
        title: "Reporting Structure",
        description: "Reporting managers derived from roles",
        source: "derived",
      },
      {
        id: "document-types",
        title: "Document Types",
        description: "KYC catalog — drives onboarding uploads",
        source: "local",
        codePrefix: "DOC",
      },
      {
        id: "onboarding-policies",
        title: "Onboarding Policies",
        description: "Policy text shown to candidates before signature",
        source: "local",
        codePrefix: "POL",
      },
    ],
  },
  {
    id: "leave",
    title: "Leave Setup",
    description: "Policies, types, and holidays",
    icon: CalendarDays,
    tabs: [
      {
        id: "leave-policies",
        title: "Leave Policies",
        description: "Accrual and approval rules",
        source: "local",
        codePrefix: "LP",
      },
      {
        id: "leave-types",
        title: "Leave Types",
        description: "Casual, sick, privilege…",
        source: "api",
        apiPath: "/hr/leave-types",
        codePrefix: "LT",
      },
      {
        id: "holiday-calendar",
        title: "Holiday Calendar",
        description: "National and company holidays",
        source: "api",
        apiPath: "/hr/holiday-calendars",
        codePrefix: "HC",
      },
      {
        id: "attendance-rules",
        title: "Attendance Policy",
        description: "Arrival windows, half-day rules, biometric punch mode",
        source: "api",
        apiPath: "/hr/attendance-rules",
        codePrefix: "AR",
      },
    ],
  },
];

/** Standalone Meeting Room module (sidebar) — not an Org Setup tab. */
export const meetingRoomTab: HrSetupTab = {
  id: "rooms",
  title: "Meeting Room",
  description: "Meeting rooms, conference halls, and training rooms with capacity & features",
  source: "api",
  apiPath: "/hr/training-rooms",
  codePrefix: "ROOM",
};

export const setupSectionIcons: Record<HrSetupSectionId, LucideIcon> = {
  organization: Building2,
  employment: Briefcase,
  leave: CalendarDays,
};

export const setupTabIcons: Partial<Record<HrSetupTabId, LucideIcon>> = {
  branches: Building2,
  departments: FolderTree,
  designations: Users,
  "job-levels": Layers,
  grades: Layers,
  "work-locations": MapPin,
  rooms: DoorOpen,
  entities: Building2,
  "employment-types": UserCog,
  "employment-type": Briefcase,
  reporting: Users,
  "document-types": FileText,
  "onboarding-policies": Shield,
  "leave-policies": Shield,
  "leave-types": CalendarDays,
  "holiday-calendar": CalendarDays,
  "shift-master": Clock3,
  "shift-rotation": Clock3,
  "shift-assignment": Clock3,
  "attendance-rules": Clock3,
  "salary-components": Wallet,
  "bank-master": Banknote,
  "tax-rules": Wallet,
  "pf-esi": Wallet,
  "approval-flows": GitBranch,
  "email-templates": Mail,
  "notification-settings": Bell,
  "roles-permissions": Shield,
};

export function getSetupSection(id: string | null | undefined) {
  return hrSetupSections.find((s) => s.id === id) ?? hrSetupSections[0];
}

export function getSetupTab(sectionId: string, tabId: string | null | undefined) {
  const section = getSetupSection(sectionId);
  return section.tabs.find((t) => t.id === tabId) ?? section.tabs[0];
}

export function nextCode(prefix: string, existing: string[]): string {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
  for (const code of existing) {
    const m = code.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}
