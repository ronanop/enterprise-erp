/**
 * Frontend module registry — standalone HRMS product.
 */

export type ModuleResource = {
  key: string;
  title: string;
  description: string;
  /** Absolute path under /api/v1 (e.g. /hr/designations) */
  apiPath: string;
  listable?: boolean;
};

export type ErpModule = {
  key: string;
  title: string;
  description: string;
  href: string;
  group: "platform" | "foundation" | "organization" | "master-data" | "operations";
  icon: "hr" | "dashboard" | "shield" | "building" | "boxes" | "wallet" | "recruit";
  resources: ModuleResource[];
};

export const erpModules: ErpModule[] = [
  {
    key: "hr",
    title: "HRMS",
    description:
      "Workforce lifecycle - profiles, employment, attendance, leave, performance, training, and separation.",
    href: "/hr",
    group: "operations",
    icon: "hr",
    resources: [
      {
        key: "designations",
        title: "Designations",
        description: "Job designation masters",
        apiPath: "/hr/designations",
      },
      {
        key: "employee-profiles",
        title: "Employee Profiles",
        description: "Employee master profiles",
        apiPath: "/hr/employee-profiles",
      },
      {
        key: "employment",
        title: "Employment",
        description: "Employment contracts and status",
        apiPath: "/hr/employment",
      },
      {
        key: "shifts",
        title: "Shifts",
        description: "Shift definitions",
        apiPath: "/hr/shifts",
      },
      {
        key: "shift-assignments",
        title: "Shift Assignments",
        description: "Employee shift roster",
        apiPath: "/hr/shift-assignments",
      },
      {
        key: "holiday-calendars",
        title: "Holiday Calendars",
        description: "Company holiday calendars",
        apiPath: "/hr/holiday-calendars",
      },
      {
        key: "leave-types",
        title: "Leave Types",
        description: "Leave type catalog",
        apiPath: "/hr/leave-types",
      },
      {
        key: "leave-balances",
        title: "Leave Balances",
        description: "Employee leave balances",
        apiPath: "/hr/leave-balances",
      },
      {
        key: "leave-requests",
        title: "Leave Requests",
        description: "Leave applications and approvals",
        apiPath: "/hr/leave-requests",
      },
      {
        key: "attendance",
        title: "Attendance",
        description: "Daily attendance records",
        apiPath: "/hr/attendance",
      },
      {
        key: "employee-documents",
        title: "Employee Documents",
        description: "HR document vault",
        apiPath: "/hr/employee-documents",
      },
      {
        key: "performance-reviews",
        title: "Performance Reviews",
        description: "Review cycles and ratings",
        apiPath: "/hr/performance-reviews",
      },
      {
        key: "goals",
        title: "Goals",
        description: "Employee goals and OKRs",
        apiPath: "/hr/goals",
      },
      {
        key: "appraisals",
        title: "Appraisals",
        description: "Appraisal scorecards",
        apiPath: "/hr/appraisals",
      },
      {
        key: "training",
        title: "Training",
        description: "Training programs",
        apiPath: "/hr/training",
      },
      {
        key: "separation",
        title: "Separation",
        description: "Resignation and exit process",
        apiPath: "/hr/separation",
      },
    ],
  },
];

export function getModule(key: string): ErpModule | undefined {
  return erpModules.find((m) => m.key === key);
}

/** @deprecated Prefer getModule */
export function getModuleByKey(key: string): ErpModule | undefined {
  return getModule(key);
}

export function getModuleByHref(href: string): ErpModule | undefined {
  const path = href.split("?")[0] ?? href;
  return erpModules.find((m) => path === m.href || path.startsWith(`${m.href}/`));
}

export function getResource(
  moduleKey: string,
  resourceKey: string,
): ModuleResource | undefined {
  return getModule(moduleKey)?.resources.find((r) => r.key === resourceKey);
}
