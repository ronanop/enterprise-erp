/**
 * Ensure Redis session has both company and branch before transactional writes
 * (e.g. procurement purchase orders).
 */

import { getStoredOrgContext, setStoredOrgContext } from "@/lib/org-context-storage";
import { contextService } from "@/services/api-client";

function firstBranchId(
  rows: Array<{ id?: string; branch_id?: string }> | null | undefined,
): string | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0];
  const id = String(row?.id ?? row?.branch_id ?? "").trim();
  return id || null;
}

/**
 * Makes sure the active session has a branch_id.
 * @returns resolved company/branch, or null if none can be selected.
 */
export async function ensureSessionBranch(): Promise<{
  company_id: string;
  branch_id: string;
} | null> {
  try {
    const ctxRes = await contextService.getContext();
    const companyId = ctxRes.data?.company_id ? String(ctxRes.data.company_id) : "";
    const branchId = ctxRes.data?.branch_id ? String(ctxRes.data.branch_id) : "";
    if (companyId && branchId) {
      return { company_id: companyId, branch_id: branchId };
    }

    let nextCompanyId = companyId;
    if (!nextCompanyId) {
      const stored = getStoredOrgContext();
      if (stored?.companyId) {
        nextCompanyId = stored.companyId;
      } else {
        const companiesRes = await contextService.listCompanies();
        const companies = Array.isArray(companiesRes.data) ? companiesRes.data : [];
        nextCompanyId = companies[0]?.id ? String(companies[0].id) : "";
      }
    }
    if (!nextCompanyId) return null;

    let nextBranchId = branchId || getStoredOrgContext()?.branchId || "";
    if (!nextBranchId) {
      const branchesRes = await contextService.listBranches(nextCompanyId);
      nextBranchId = firstBranchId(branchesRes.data) || "";
    }
    if (!nextBranchId) return null;

    const switched = await contextService.switchContext({
      company_id: nextCompanyId,
      branch_id: nextBranchId,
    });
    const resolvedCompany = String(switched.data?.company_id || nextCompanyId);
    const resolvedBranch = String(switched.data?.branch_id || nextBranchId);
    const stored = getStoredOrgContext();
    setStoredOrgContext({
      companyId: resolvedCompany,
      companyName: stored?.companyName || resolvedCompany,
      branchId: resolvedBranch,
      branchName: stored?.branchName,
    });
    return { company_id: resolvedCompany, branch_id: resolvedBranch };
  } catch {
    return null;
  }
}
