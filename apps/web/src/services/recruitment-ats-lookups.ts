/**
 * Shared option lists + INR helpers for Recruitment ATS forms.
 * Loads live employees / branches / recruiters when API is available;
 * falls back to sensible local defaults so forms always work.
 */

import { resourceService } from "@/services/api-client";
import { formatInr as formatInrBase } from "@/services/recruitment-service";

export type NamedOption = { id: string; name: string };

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

export async function loadAtsLookups(): Promise<{
  employees: NamedOption[];
  branches: NamedOption[];
  recruiters: NamedOption[];
}> {
  let employees = EMPLOYEE_FALLBACK;
  let branches = BRANCH_FALLBACK;
  let recruiters = RECRUITER_FALLBACK;

  try {
    const empRes = await resourceService.list("/employees", { page_size: 200 });
    const empRows = normalizeList(empRes.data);
    if (empRows.length) {
      employees = empRows.map((r) => ({
        id: String(r.id ?? crypto.randomUUID()),
        name: rowName(r),
      }));
    }
  } catch {
    /* fallback */
  }

  try {
    const brRes = await resourceService.list("/organization/branches", { page_size: 100 });
    const brRows = normalizeList(brRes.data);
    if (brRows.length) {
      branches = brRows.map((r) => ({
        id: String(r.id ?? crypto.randomUUID()),
        name: String(r.branch_name ?? r.name ?? r.code ?? "Branch"),
      }));
    }
  } catch {
    try {
      const brRes2 = await resourceService.list("/branches", { page_size: 100 });
      const brRows2 = normalizeList(brRes2.data);
      if (brRows2.length) {
        branches = brRows2.map((r) => ({
          id: String(r.id ?? crypto.randomUUID()),
          name: String(r.branch_name ?? r.name ?? "Branch"),
        }));
      }
    } catch {
      /* fallback */
    }
  }

  try {
    const recRes = await resourceService.list("/recruitment/recruiters", { page_size: 100 });
    const recRows = normalizeList(recRes.data);
    if (recRows.length) {
      recruiters = recRows.map((r) => ({
        id: String(r.id ?? crypto.randomUUID()),
        name: rowName(r),
      }));
    }
  } catch {
    /* fallback */
  }

  return { employees, branches, recruiters };
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
