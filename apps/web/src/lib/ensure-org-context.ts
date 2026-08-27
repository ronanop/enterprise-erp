/**
 * Ensure Redis/server session has an active company context.
 * Soft navigations keep the access token but often lose Redis company scope,
 * which makes Org Setup (Branches, etc.) return an empty list until re-login.
 */

import { getStoredOrgContext, setStoredOrgContext } from "@/lib/org-context-storage";
import { contextService } from "@/services/api-client";
import type { OrgCompanyOption } from "@/types/org-context";

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

async function applyCompany(
  companyId: string,
  companyName?: string,
  branchId?: string | null,
): Promise<void> {
  await contextService.switchContext({
    company_id: companyId,
    branch_id: branchId ?? null,
  });
  const name =
    companyName ||
    getStoredOrgContext()?.companyName ||
    companyId;
  setStoredOrgContext({
    companyId,
    companyName: name,
    branchId: branchId || undefined,
  });
}

/**
 * Restore company context for the current access token.
 * @returns `ready` when API company scope is set, `needs_company` when user must pick one.
 */
export async function ensureOrgContextReady(): Promise<"ready" | "needs_company"> {
  // 1) Server already has company scope (Redis / default scope)
  try {
    const ctxRes = await contextService.getContext();
    const serverCompanyId = ctxRes.data?.company_id
      ? String(ctxRes.data.company_id)
      : "";
    if (serverCompanyId) {
      // Re-apply switch so Redis session stays warm after idle / Redis restart
      try {
        await applyCompany(
          serverCompanyId,
          getStoredOrgContext()?.companyId === serverCompanyId
            ? getStoredOrgContext()?.companyName
            : undefined,
          ctxRes.data?.branch_id ? String(ctxRes.data.branch_id) : null,
        );
      } catch {
        // Context already valid on server — continue even if switch fails
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
    /* fall through — try stored / company list */
  }

  // 2) Browser still remembers last company — push it back to Redis
  const stored = getStoredOrgContext();
  if (stored?.companyId) {
    try {
      await applyCompany(stored.companyId, stored.companyName, stored.branchId ?? null);
      return "ready";
    } catch {
      /* stored company may no longer be accessible */
    }
  }

  // 3) Resolve from accessible companies
  try {
    const res = await contextService.listCompanies();
    const companies = normalizeCompanies(res.data);

    if (companies.length === 0) {
      return "ready";
    }

    if (companies.length === 1) {
      const company = companies[0]!;
      await applyCompany(company.id, company.company_name);
      return "ready";
    }

    return "needs_company";
  } catch {
    // Don't block the whole app if context APIs are down
    return "ready";
  }
}
