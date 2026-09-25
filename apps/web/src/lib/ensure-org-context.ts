/**
 * Ensure Redis/server session has an active company context.
 * Soft navigations keep the access token but often lose Redis company scope,
 * which makes Org Setup (Branches, etc.) return an empty list until re-login.
 *
 * Workspace standard: prefer CDPL (+ HQ) whenever the user can access it.
 */

import { getStoredOrgContext, setStoredOrgContext } from "@/lib/org-context-storage";
import {
  PREFERRED_COMPANY_CODE,
  pickPreferredBranch,
  pickPreferredCompany,
} from "@/lib/preferred-company";
import { contextService } from "@/services/api-client";
import type { OrgBranchOption, OrgCompanyOption } from "@/types/org-context";

function normalizeCompanies(data: unknown): OrgCompanyOption[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? ""),
      company_code: String(row.company_code ?? ""),
      company_name: String(row.company_name ?? row.name ?? ""),
      legal_name: row.legal_name ? String(row.legal_name) : undefined,
      status: row.status ? String(row.status) : undefined,
    }))
    .filter((c) => c.id && c.company_name);
}

function normalizeBranches(data: unknown, companyId: string): OrgBranchOption[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? ""),
      company_id: String(row.company_id ?? companyId),
      branch_code: String(row.branch_code ?? ""),
      branch_name: String(row.branch_name ?? row.name ?? ""),
      status: row.status ? String(row.status) : undefined,
    }))
    .filter((b) => b.id);
}

async function applyCompany(
  companyId: string,
  companyName?: string,
  branchId?: string | null,
): Promise<void> {
  let resolvedBranch = branchId ?? null;
  let branchName: string | undefined;
  if (!resolvedBranch) {
    try {
      const branchesRes = await contextService.listBranches(companyId);
      const branch = pickPreferredBranch(
        normalizeBranches(branchesRes.data, companyId),
      );
      resolvedBranch = branch?.id ?? null;
      branchName = branch?.branch_name;
    } catch {
      resolvedBranch = null;
    }
  }
  await contextService.switchContext({
    company_id: companyId,
    branch_id: resolvedBranch,
  });
  const name =
    companyName ||
    getStoredOrgContext()?.companyName ||
    companyId;
  setStoredOrgContext({
    companyId,
    companyName: name,
    branchId: resolvedBranch || undefined,
    branchName,
  });
}

/**
 * Restore company context for the current access token.
 * Prefers CDPL when available so Projects seed data is always in scope.
 * @returns `ready` when API company scope is set, `needs_company` when user must pick one.
 */
export async function ensureOrgContextReady(): Promise<"ready" | "needs_company"> {
  let companies: OrgCompanyOption[] = [];
  try {
    const res = await contextService.listCompanies();
    companies = normalizeCompanies(res.data);
  } catch {
    companies = [];
  }

  const preferred = pickPreferredCompany(companies);

  // 1) Standardize on CDPL when the user can access it
  if (preferred?.company_code.trim().toUpperCase() === PREFERRED_COMPANY_CODE) {
    try {
      await applyCompany(preferred.id, preferred.company_name);
      return "ready";
    } catch {
      /* fall through */
    }
  }

  // 2) Server already has company scope (Redis / default scope)
  try {
    const ctxRes = await contextService.getContext();
    const serverCompanyId = ctxRes.data?.company_id
      ? String(ctxRes.data.company_id)
      : "";
    if (serverCompanyId) {
      try {
        await applyCompany(
          serverCompanyId,
          getStoredOrgContext()?.companyId === serverCompanyId
            ? getStoredOrgContext()?.companyName
            : undefined,
          ctxRes.data?.branch_id ? String(ctxRes.data.branch_id) : null,
        );
      } catch {
        const stored = getStoredOrgContext();
        if (!stored?.companyId || stored.companyId !== serverCompanyId) {
          setStoredOrgContext({
            companyId: serverCompanyId,
            companyName: stored?.companyName || serverCompanyId,
            branchId: ctxRes.data?.branch_id
              ? String(ctxRes.data.branch_id)
              : undefined,
          });
        }
      }
      return "ready";
    }
  } catch {
    /* fall through - try stored / company list */
  }

  // 3) Browser still remembers last company - push it back to Redis
  const stored = getStoredOrgContext();
  if (stored?.companyId) {
    try {
      await applyCompany(stored.companyId, stored.companyName, stored.branchId ?? null);
      return "ready";
    } catch {
      /* stored company may no longer be accessible */
    }
  }

  // 4) Any accessible company (non-CDPL fallback)
  if (preferred) {
    try {
      await applyCompany(preferred.id, preferred.company_name);
      return "ready";
    } catch {
      /* fall through */
    }
  }

  if (companies.length === 0) {
    return "ready";
  }

  return "needs_company";
}
