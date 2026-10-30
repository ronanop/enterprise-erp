import { apiClient } from "@/services/api-client";
import { env, getApiUrl, resolveApiUrl } from "@/utils/env";

export type PublicCareerRole = {
  id: string;
  job_code: string;
  title: string;
  employment_type: string;
  priority: string;
  openings: number;
  filled?: number;
  experience_min: number | null;
  experience_max: number | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency_code?: string | null;
  description: string;
  justification?: string | null;
  target_hire_date?: string | null;
  location: string;
  department_id?: string | null;
  /** Always external on the public board; internal openings are filtered out. */
  posting_audience?: "internal" | "external";
};

export type CareerApplicationInput = {
  jobRequisitionId: string;
  fullName: string;
  email: string;
  phone: string;
  resume?: File | null;
  alternatePhone?: string;
  gender?: string;
  dob?: string;
  address?: string;
  state?: string;
  pincode?: string;
  currentCompany?: string;
  currentDesignation?: string;
  experienceYears?: number | null;
  expectedSalary?: number | null;
  noticePeriodDays?: number | null;
  skills?: string[];
  portfolioUrl?: string;
  linkedinUrl?: string;
};

/** Known seed / demo requisition codes — never show on careers. */
const DEMO_JOB_CODES = new Set([
  "JR-0001",
  "JR-0002",
  "JR-DASH-001",
  "JR-DASH-002",
  "JP-0001",
  "JP-0002",
  "JP-DASH-001",
  "JP-DASH-002",
]);

function isDemoJobCode(code: string | null | undefined): boolean {
  const raw = (code || "").trim().toUpperCase();
  if (!raw) return false;
  if (DEMO_JOB_CODES.has(raw)) return true;
  return raw.startsWith("JR-DASH-") || raw.startsWith("JP-DASH-");
}

export async function listPublicCareerRoles(): Promise<PublicCareerRole[]> {
  const res = await apiClient<PublicCareerRole[]>("/public/careers/roles", { auth: false });
  return (res.data ?? []).filter((r) => {
    if (isDemoJobCode(r.job_code)) return false;
    // Internal openings are for employees only — never list on public careers.
    if (String(r.posting_audience ?? "external").toLowerCase() === "internal") return false;
    return true;
  });
}

function appendIf(form: FormData, key: string, value: string | number | null | undefined) {
  if (value == null) return;
  const text = String(value).trim();
  if (!text) return;
  form.append(key, text);
}

export async function submitCareerApplication(
  input: CareerApplicationInput,
): Promise<{ candidate_code: string; application_code: string; duplicate?: boolean }> {
  const form = new FormData();
  form.append("job_requisition_id", input.jobRequisitionId);
  form.append("full_name", input.fullName);
  form.append("email", input.email);
  form.append("phone", input.phone);
  if (input.resume) form.append("resume", input.resume);
  appendIf(form, "alternate_phone", input.alternatePhone);
  appendIf(form, "gender", input.gender);
  appendIf(form, "dob", input.dob);
  appendIf(form, "address", input.address);
  appendIf(form, "state", input.state);
  appendIf(form, "pincode", input.pincode);
  appendIf(form, "current_company", input.currentCompany);
  appendIf(form, "current_designation", input.currentDesignation);
  appendIf(form, "experience_years", input.experienceYears);
  appendIf(form, "expected_salary", input.expectedSalary);
  appendIf(form, "notice_period_days", input.noticePeriodDays);
  if (input.skills?.length) form.append("skills", input.skills.join(", "));
  appendIf(form, "portfolio_url", input.portfolioUrl);
  appendIf(form, "linkedin_url", input.linkedinUrl);

  await resolveApiUrl();
  const base = (getApiUrl() || env.apiUrl).replace(/\/$/, "");
  const response = await fetch(`${base}/public/careers/apply`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  const json = (await response.json()) as {
    message?: string;
    data?: { candidate_code: string; application_code: string; duplicate?: boolean };
    errors?: string[];
  };
  if (!response.ok) {
    throw new Error(json.message || json.errors?.[0] || "Application failed");
  }
  if (!json.data) throw new Error("Empty response");
  return json.data;
}
