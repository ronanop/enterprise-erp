import { getStoredOrgContext } from "@/lib/org-context-storage";
import { contextService } from "@/services/api-client";

/** Companies a payroll write should update. A selected company is one target. All companies updates every company. */
export async function payrollTargetCompanyIds(): Promise<string[]> {
  const stored = getStoredOrgContext();
  if (stored && !stored.allCompanies && stored.companyId) {
    return [stored.companyId];
  }
  const res = await contextService.listCompanies();
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map((row) => row.id).filter((id) => Boolean(id));
}
