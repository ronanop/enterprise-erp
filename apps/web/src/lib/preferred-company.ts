import type { OrgBranchOption, OrgCompanyOption } from "@/types/org-context";

/** Workspace standard company — all Projects seed / delivery data lives here. */
export const PREFERRED_COMPANY_CODE = "CDPL";

/** Prefer HQ when present among branches for the active company. */
export const PREFERRED_BRANCH_CODE = "HQ";

export function pickPreferredCompany(
  companies: readonly OrgCompanyOption[],
): OrgCompanyOption | null {
  if (companies.length === 0) return null;
  const preferred = companies.find(
    (c) => c.company_code.trim().toUpperCase() === PREFERRED_COMPANY_CODE,
  );
  return preferred ?? companies[0] ?? null;
}

export function pickPreferredBranch(
  branches: readonly OrgBranchOption[],
): OrgBranchOption | null {
  if (branches.length === 0) return null;
  const preferred = branches.find(
    (b) => b.branch_code.trim().toUpperCase() === PREFERRED_BRANCH_CODE,
  );
  return preferred ?? branches[0] ?? null;
}
