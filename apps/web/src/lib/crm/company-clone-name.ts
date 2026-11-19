import type { Company } from "@/services/sales-crm-service";

/** Strip trailing ` V{n}` so clones share one base name. */
export function companyCloneBaseName(customerName: string): string {
  const trimmed = customerName.trim();
  const match = trimmed.match(/^(.+?)\s+V\d+$/i);
  return (match?.[1] ?? trimmed).trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Next name: `{base} V1`, `V2`, … based on existing company names in the tenant. */
export function nextCloneCompanyName(source: Company, allCompanies: Company[]): string {
  const base = companyCloneBaseName(source.customer_name);
  const pattern = new RegExp(`^${escapeRegExp(base)}\\s+V(\\d+)$`, "i");
  let maxVersion = 0;
  for (const row of allCompanies) {
    const match = row.customer_name.trim().match(pattern);
    if (match) {
      maxVersion = Math.max(maxVersion, Number.parseInt(match[1], 10));
    }
  }
  return `${base} V${maxVersion + 1}`;
}
