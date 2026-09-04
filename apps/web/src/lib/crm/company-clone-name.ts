import type { Company } from "@/services/sales-crm-service";

/** Strip trailing ` V{n}` so clones share one base name. */
export function companyCloneBaseName(customerName: string): string {
  const trimmed = customerName.trim();
  const marker = " V";
  const idx = trimmed.toUpperCase().lastIndexOf(marker.toUpperCase());
  if (idx <= 0) return trimmed;
  const suffix = trimmed.slice(idx + marker.length);
  if (/^\d+$/.test(suffix)) return trimmed.slice(0, idx).trim();
  return trimmed;
}

/** Next name: `{base} V1`, `V2`, … based on existing company names in the tenant. */
export function nextCloneCompanyName(source: Company, allCompanies: Company[]): string {
  const base = companyCloneBaseName(source.customer_name);
  const prefix = `${base} V`;
  let maxVersion = 0;
  for (const row of allCompanies) {
    const name = row.customer_name.trim();
    if (!name.toUpperCase().startsWith(prefix.toUpperCase())) continue;
    const suffix = name.slice(prefix.length);
    if (/^\d+$/.test(suffix)) {
      maxVersion = Math.max(maxVersion, Number.parseInt(suffix, 10));
    }
  }
  return `${base} V${maxVersion + 1}`;
}
