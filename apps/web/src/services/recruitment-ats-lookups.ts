/**
 * Shared option lists + INR helpers for Recruitment ATS forms.
 * Loads live employees / branches / recruiters when API is available;
 * falls back to sensible local defaults so forms always work.
 */

import { buildReportingManagerOptions } from "@/lib/hr/reporting-managers";
import { resourceService } from "@/services/api-client";
import { formatInr as formatInrBase } from "@/services/recruitment-service";

export type NamedOption = {
  id: string;
  name: string;
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  email?: string;
  /** People-role / reporting manager flag when known */
  isManager?: boolean;
};

export type AtsLookupSource = "live" | "employees" | "demo";

const BRANCH_FALLBACK: NamedOption[] = [
  { id: "head-office", name: "Head Office" },
  { id: "noida", name: "Noida" },
  { id: "bangalore", name: "Bangalore" },
  { id: "hyderabad", name: "Hyderabad" },
  { id: "pune", name: "Pune" },
];

const EMPLOYEE_FALLBACK: NamedOption[] = [
  { id: "emp-hr-lead", name: "Priya Sharma" },
  { id: "emp-eng-mgr", name: "Amit Verma" },
  { id: "emp-tech-lead", name: "Neha Kapoor" },
  { id: "emp-hr-bp", name: "Rahul Mehta" },
  { id: "emp-dir", name: "Sanjay Iyer" },
];

const RECRUITER_FALLBACK: NamedOption[] = [
  { id: "rec-1", name: "Ananya Gupta" },
  { id: "rec-2", name: "Vikram Singh" },
  { id: "rec-3", name: "Meera Nair" },
];

function rowName(row: Record<string, unknown>): string {
  const full = row.full_name ?? row.employee_name ?? row.name ?? row.display_name;
  if (typeof full === "string" && full.trim()) return full.trim();
  const first = typeof row.first_name === "string" ? row.first_name : "";
  const last = typeof row.last_name === "string" ? row.last_name : "";
  const joined = `${first} ${last}`.trim();
  if (joined) return joined;
  return String(row.employee_code ?? row.recruiter_code ?? row.document_number ?? row.id ?? "—");
}

function namedFromEmployee(row: Record<string, unknown>): NamedOption {
  const name = rowName(row);
  const code = String(row.employee_code ?? "").trim();
  const email = String(row.email ?? row.work_email ?? "").trim();
  const departmentId = String(row.department_id ?? row.departmentId ?? "").trim();
  const isManager =
    row.is_manager === true ||
    row.is_hiring_manager === true ||
    row.isManager === true;
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: code && !name.includes(code) ? `${name} (${code})` : name,
    ...(email ? { email } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(isManager ? { isManager: true } : {}),
  };
}

function looksLikeRecruiterRole(row: Record<string, unknown>): boolean {
  const blob = [
    row.designation,
    row.job_title,
    row.display_name,
    row.department,
    row.department_name,
  ]
    .map((v) => String(v ?? "").toLowerCase())
    .join(" ");
  return (
    blob.includes("recruiter") ||
    blob.includes("talent") ||
    blob.includes("staffing") ||
    /\bhr\b/.test(blob) ||
    blob.includes("human resource")
  );
}

function looksLikeHrRole(row: Record<string, unknown>): boolean {
  if (row.is_hr === true) return true;
  const blob = [
    row.designation,
    row.job_title,
    row.display_name,
    row.department,
    row.department_name,
  ]
    .map((v) => String(v ?? "").toLowerCase())
    .join(" ");
  return (
    /\bhr\b/.test(blob) ||
    blob.includes("human resource") ||
    blob.includes("people ops") ||
    blob.includes("people operations") ||
    blob.includes("talent acquisition") ||
    blob.includes("recruiter")
  );
}

function normalizeList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["rows", "items", "results", "data", "records"]) {
      if (Array.isArray(obj[key])) return normalizeList(obj[key]);
    }
  }
  return [];
}

export function formatInr(value: number): string {
  return formatInrBase(value || 0);
}

/** Parse INR typed input: strips ₹, commas, spaces */
export function parseInrInput(raw: string): number {
  const cleaned = raw.replace(/[₹,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Format digits as Indian grouping while typing (no currency symbol in the field value) */
export function formatInrGrouping(value: number | string): string {
  const n = typeof value === "number" ? value : parseInrInput(value);
  if (!n) return "";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

export function recruiterSourceHint(source: AtsLookupSource): string {
  if (source === "live") return "From People roles (Recruiter) / recruiter directory. Type a name to search.";
  if (source === "employees") {
    return "No recruiter flags yet — showing HR / Talent employees. Assign Recruiter in Org Setup → People roles.";
  }
  return "Demo names (Ananya Gupta, Vikram Singh, Meera Nair). Recruiter directory and employees did not load.";
}

export function hiringManagerSourceHint(source: AtsLookupSource): string {
  if (source === "live") {
    return "From People roles (Hiring manager). Type a name to search. Assign flags in Org Setup → People roles.";
  }
  if (source === "employees") {
    return "No hiring-manager flags yet — showing reporting managers. Assign flags in Org Setup → People roles.";
  }
  return "Demo names — employee directory did not load. Type a name to search.";
}

const HR_FALLBACK: NamedOption[] = [
  { id: "emp-hr-lead", name: "Priya Sharma" },
  { id: "emp-hr-bp", name: "Rahul Mehta" },
];

export async function loadAtsLookups(): Promise<{
  employees: NamedOption[];
  /** Employees flagged HR (or HR-like role) — used for Negotiation Round participants */
  hrEmployees: NamedOption[];
  /** Job-opening hiring managers (People roles → Hiring manager) */
  hiringManagers: NamedOption[];
  /** Line / normal managers (People roles → Manager) for meeting participants */
  managers: NamedOption[];
  branches: NamedOption[];
  departments: NamedOption[];
  designations: NamedOption[];
  recruiters: NamedOption[];
  recruiterSource: AtsLookupSource;
  managerSource: AtsLookupSource;
}> {
  let employees = EMPLOYEE_FALLBACK;
  let hrEmployees = HR_FALLBACK;
  let hiringManagers = EMPLOYEE_FALLBACK;
  let managers = EMPLOYEE_FALLBACK;
  let managerSource: AtsLookupSource = "demo";
  let branches = BRANCH_FALLBACK;
  let departments: NamedOption[] = [];
  let designations: NamedOption[] = [];
  let recruiters = RECRUITER_FALLBACK;
  let recruiterSource: AtsLookupSource = "demo";
  let empRows: Record<string, unknown>[] = [];

  try {
    const empRes = await resourceService.list("/employees", { page_size: 200 });
    empRows = normalizeList(empRes.data);
    if (empRows.length) {
      employees = empRows.map(namedFromEmployee);
      const flaggedHr = empRows.filter((r) => r.is_hr === true);
      if (flaggedHr.length) {
        hrEmployees = flaggedHr.map(namedFromEmployee);
      } else {
        const inferredHr = empRows.filter(looksLikeHrRole).map(namedFromEmployee);
        hrEmployees = inferredHr.length ? inferredHr : employees;
      }
      const flaggedHiring = empRows.filter((r) => r.is_hiring_manager === true);
      if (flaggedHiring.length) {
        hiringManagers = flaggedHiring.map(namedFromEmployee);
        managerSource = "live";
      } else {
        hiringManagers = [];
        managerSource = "employees";
      }

      const flaggedLineManagers = empRows.filter(
        (r) => r.is_manager === true || r.is_hiring_manager === true,
      );
      if (flaggedLineManagers.length) {
        managers = flaggedLineManagers.map(namedFromEmployee);
        if (managerSource !== "live") managerSource = "live";
      } else {
        const inferred = buildReportingManagerOptions(
          empRows.map((r) => ({
            id: String(r.id ?? ""),
            employee_code: String(r.employee_code ?? ""),
            first_name: String(r.first_name ?? ""),
            last_name: String(r.last_name ?? ""),
            designation: String(r.designation ?? r.job_title ?? ""),
            job_title: String(r.job_title ?? ""),
            display_name: rowName(r),
            reporting_manager_id: r.reporting_manager_id ? String(r.reporting_manager_id) : null,
            is_manager: r.is_manager === true,
            is_hiring_manager: r.is_hiring_manager === true,
            is_deleted: Boolean(r.is_deleted),
            status: String(r.status ?? "active"),
          })),
        );
        managers = inferred.length
          ? inferred.map((m) => {
              const emp = employees.find((e) => e.id === m.id);
              return {
                id: m.id,
                name: m.label,
                email: emp?.email,
                departmentId: emp?.departmentId,
                isManager: true as const,
              };
            })
          : employees;
        if (!flaggedHiring.length && inferred.length) {
          hiringManagers = managers;
        }
      }
    }
  } catch {
    /* fallback */
  }

  try {
    const brRes = await resourceService.list("/branches", { page_size: 100 });
    const brRows = normalizeList(brRes.data);
    if (brRows.length) {
      branches = brRows.map((r) => ({
        id: String(r.id ?? crypto.randomUUID()),
        name: String(r.branch_name ?? r.name ?? r.code ?? "Branch"),
        companyId: r.company_id ? String(r.company_id) : undefined,
      }));
    }
  } catch {
    /* optional lookup */
  }

  try {
    const recRes = await resourceService.list("/recruitment/recruiters", { page_size: 100 });
    const recRows = normalizeList(recRes.data).filter((r) => {
      const status = String(r.status ?? "active").toLowerCase();
      return status !== "inactive" && status !== "deleted";
    });
    if (recRows.length) {
      recruiters = recRows.map((r) => ({
        id: String(r.employee_id ?? r.id ?? crypto.randomUUID()),
        name: rowName(r),
      }));
      recruiterSource = "live";
    }
  } catch {
    /* try employees below */
  }

  const flaggedRecruiters = empRows.filter((r) => r.is_recruiter === true);
  if (flaggedRecruiters.length) {
    recruiters = flaggedRecruiters.map(namedFromEmployee);
    recruiterSource = "live";
  } else if (recruiterSource !== "live" && empRows.length) {
    const hrish = empRows.filter(looksLikeRecruiterRole).map(namedFromEmployee);
    if (hrish.length) {
      recruiters = hrish;
      recruiterSource = "employees";
    }
  }

  const companyIdFromBranch = branches.find((b) => b.companyId)?.companyId;

  // Prefer recruitment lookups (HRMS org departments + HR designations) so ATS
  // users with requisition:read get the same masters as Org Setup / HR Setup.
  try {
    const lookupRes = await resourceService.list("/recruitment/lookups/job-form", {
      ...(companyIdFromBranch ? { company_id: companyIdFromBranch } : {}),
    });
    const payload =
      lookupRes.data && typeof lookupRes.data === "object" && !Array.isArray(lookupRes.data)
        ? (lookupRes.data as Record<string, unknown>)
        : {};
    const deptRows = normalizeList(payload.departments);
    const desigRows = normalizeList(payload.designations);
    if (deptRows.length) {
      departments = deptRows
        .map((r) => ({
          id: String(r.id ?? ""),
          name: String(r.name ?? r.department_name ?? "Department"),
          companyId: r.company_id ? String(r.company_id) : undefined,
          branchId: r.branch_id ? String(r.branch_id) : undefined,
        }))
        .filter((d) => d.id)
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    if (desigRows.length) {
      designations = desigRows
        .map((r) => ({
          id: String(r.id ?? ""),
          name: String(r.name ?? r.designation_name ?? "Designation"),
          companyId: r.company_id ? String(r.company_id) : undefined,
        }))
        .filter((d) => d.id)
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch {
    /* fall through to direct org/HR masters */
  }

  if (!departments.length) {
    try {
      // Org departments API uses `limit`, not page_size (max 100).
      const deptRes = await resourceService.list("/departments", { limit: 100 });
      const deptRows = normalizeList(deptRes.data).filter((r) => {
        const status = String(r.status ?? "active").toLowerCase();
        return !r.is_deleted && status !== "inactive" && status !== "deleted";
      });
      if (deptRows.length) {
        departments = deptRows
          .map((r) => ({
            id: String(r.id ?? ""),
            name: String(r.department_name ?? r.name ?? "Department"),
            companyId: r.company_id ? String(r.company_id) : undefined,
            branchId: r.branch_id ? String(r.branch_id) : undefined,
          }))
          .filter((d) => d.id)
          .sort((a, b) => a.name.localeCompare(b.name));
      }
    } catch {
      /* optional */
    }
  }

  if (!designations.length) {
    try {
      const desigRes = await resourceService.list("/hr/designations", {
        page_size: 200,
        page: 1,
        ...(companyIdFromBranch ? { company_id: companyIdFromBranch } : {}),
      });
      const desigRows = normalizeList(desigRes.data).filter((r) => {
        const status = String(r.status ?? "active").toLowerCase();
        return !r.is_deleted && status !== "inactive" && status !== "deleted";
      });
      if (desigRows.length) {
        designations = desigRows
          .map((r) => ({
            id: String(r.id ?? ""),
            name: String(r.designation_name ?? r.name ?? "Designation"),
            companyId: r.company_id ? String(r.company_id) : undefined,
          }))
          .filter((d) => d.id)
          .sort((a, b) => a.name.localeCompare(b.name));
      }
    } catch {
      /* optional */
    }
  }

  return {
    employees,
    hrEmployees,
    hiringManagers,
    managers,
    branches,
    departments,
    designations,
    recruiters,
    recruiterSource,
    managerSource,
  };
}

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidIndianMobile(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\s+/g, ""));
}

export function isValidPincode(pin: string): boolean {
  return /^\d{6}$/.test(pin.trim());
}
