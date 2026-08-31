import { getPostLoginRedirect } from "@/config/module-logins";
import { contextService } from "@/services/api-client";
import { setStoredOrgContext } from "@/lib/org-context-storage";
import type { OrgCompanyOption } from "@/types/org-context";

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

/** Resolve where to navigate after login — may route through company selection. */
export async function resolvePostLoginNavigation(
  email: string,
  next?: string | null,
): Promise<string> {
  const destination = safeNext(next) ?? getPostLoginRedirect(email);

  try {
    const res = await contextService.listCompanies();
    const companies = normalizeCompanies(res.data);

    if (companies.length === 0) {
      return destination;
    }

    if (companies.length === 1) {
      const company = companies[0];
      await contextService.switchContext({ company_id: company.id });
      setStoredOrgContext({
        companyId: company.id,
        companyName: company.company_name,
      });
      return destination;
    }

    return `/select-company?next=${encodeURIComponent(destination)}`;
  } catch {
    return destination;
  }
}
