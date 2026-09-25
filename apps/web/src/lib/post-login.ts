import { getPostLoginRedirect } from "@/config/module-logins";
import { contextService } from "@/services/api-client";
import { setStoredOrgContext } from "@/lib/org-context-storage";
import {
  pickPreferredBranch,
  pickPreferredCompany,
} from "@/lib/preferred-company";
import type { OrgBranchOption, OrgCompanyOption } from "@/types/org-context";

function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

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

/** Resolve where to navigate after login — prefers CDPL when the user can access it. */
export async function resolvePostLoginNavigation(
  email: string,
  next?: string | null,
): Promise<string> {
  const destination = safeNext(next) ?? getPostLoginRedirect(email);

  try {
    const res = await contextService.listCompanies();
    const companies = normalizeCompanies(res.data);
    const company = pickPreferredCompany(companies);

    if (!company) {
      return destination;
    }

    let branchId: string | undefined;
    let branchName: string | undefined;
    try {
      const branchesRes = await contextService.listBranches(company.id);
      const branch = pickPreferredBranch(
        normalizeBranches(branchesRes.data, company.id),
      );
      branchId = branch?.id;
      branchName = branch?.branch_name;
    } catch {
      branchId = undefined;
    }

    await contextService.switchContext({
      company_id: company.id,
      branch_id: branchId ?? null,
    });
    setStoredOrgContext({
      companyId: company.id,
      companyName: company.company_name,
      branchId,
      branchName,
    });
    return destination;
  } catch {
    return destination;
  }
}
