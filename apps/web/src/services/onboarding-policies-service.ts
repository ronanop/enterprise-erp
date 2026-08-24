/**
 * Onboarding policy documents — editable in Org Setup, consumed by candidate portal.
 */

export type OnboardingPolicyDoc = {
  id: string;
  code: string;
  title: string;
  body: string;
  sortOrder: number;
  status: "active" | "inactive";
  updatedAt: string;
};

const STORAGE_KEY = "erp_onboarding_policies_v1";

const DEFAULT_POLICIES: OnboardingPolicyDoc[] = [
  {
    id: "handbook",
    code: "POL-HANDBOOK",
    title: "Employee Handbook",
    body:
      "Welcome to the organization. This handbook outlines workplace expectations, leave entitlements, attendance rules, and HR contacts. Please read carefully before accepting.",
    sortOrder: 1,
    status: "active",
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "nda",
    code: "POL-NDA",
    title: "NDA",
    body:
      "You agree not to disclose confidential company information, customer data, or trade secrets during and after employment.",
    sortOrder: 2,
    status: "active",
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "it_policy",
    code: "POL-IT",
    title: "IT Policy",
    body:
      "Use company devices and accounts responsibly. Do not share passwords. Report security incidents promptly. Personal software installs require IT approval.",
    sortOrder: 3,
    status: "active",
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "code_of_conduct",
    code: "POL-COC",
    title: "Code of Conduct",
    body:
      "Treat colleagues with respect. Zero tolerance for harassment or discrimination. Follow conflict-of-interest and gift policies.",
    sortOrder: 4,
    status: "active",
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "privacy",
    code: "POL-PRIVACY",
    title: "Privacy Policy",
    body:
      "We process personal data for employment, payroll, and compliance. Data is retained per statutory requirements and shared only with authorized processors.",
    sortOrder: 5,
    status: "active",
    updatedAt: new Date(0).toISOString(),
  },
];

function readAll(): OnboardingPolicyDoc[] {
  if (typeof window === "undefined") return DEFAULT_POLICIES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_POLICIES));
      return DEFAULT_POLICIES.map((p) => ({ ...p }));
    }
    const parsed = JSON.parse(raw) as OnboardingPolicyDoc[];
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_POLICIES.map((p) => ({ ...p }));
    return parsed
      .map((p) => ({
        id: String(p.id),
        code: String(p.code ?? ""),
        title: String(p.title ?? ""),
        body: String(p.body ?? ""),
        sortOrder: Number(p.sortOrder ?? 0),
        status: p.status === "inactive" ? "inactive" : "active",
        updatedAt: String(p.updatedAt ?? new Date().toISOString()),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  } catch {
    return DEFAULT_POLICIES.map((p) => ({ ...p }));
  }
}

function writeAll(rows: OnboardingPolicyDoc[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listOnboardingPolicies(includeInactive = true): OnboardingPolicyDoc[] {
  const all = readAll();
  return includeInactive ? all : all.filter((p) => p.status === "active");
}

export function getOnboardingPolicy(id: string): OnboardingPolicyDoc | null {
  return readAll().find((p) => p.id === id) ?? null;
}

export function saveOnboardingPolicy(
  input: Omit<OnboardingPolicyDoc, "updatedAt"> & { updatedAt?: string },
): OnboardingPolicyDoc {
  const all = readAll();
  const next: OnboardingPolicyDoc = {
    ...input,
    title: input.title.trim() || "Untitled policy",
    body: input.body.trim(),
    updatedAt: new Date().toISOString(),
  };
  const idx = all.findIndex((p) => p.id === next.id);
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  writeAll(all);
  return next;
}

export function deleteOnboardingPolicy(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id));
}

/** Shape used by the candidate portal (compatible with legacy POLICY_DOCS). */
export function listActivePoliciesForPortal(): { id: string; label: string; body: string }[] {
  return listOnboardingPolicies(false).map((p) => ({
    id: p.id,
    label: p.title,
    body: p.body,
  }));
}
