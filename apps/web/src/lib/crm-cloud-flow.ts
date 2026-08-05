import type { SalesLead } from "@/services/sales-crm-service";

export const CLOUD_VARIANT_LABELS: Record<string, string> = {
  billing_shift: "Billing Shift",
  migration: "Cloud Migration (MAP)",
  poc_assessment: "POC / Assessment",
  cloud_other: "Cloud",
};

const CLOUD_CONSUMPTION_VARIANTS = new Set([
  "billing_shift",
  "migration",
  "poc_assessment",
  "cloud_other",
]);

export function cloudVariantFromLead(lead: SalesLead | null | undefined): string | null {
  if (!lead || (lead.product_type ?? "").trim().toLowerCase() !== "cloud") return null;
  const sub = [lead.sub_product_category, lead.sub_product, lead.sub_product_other]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (sub.includes("billing") && sub.includes("shift")) return "billing_shift";
  if (sub.includes("migration")) return "migration";
  if (sub.includes("poc") || sub.includes("assessment")) return "poc_assessment";
  return "cloud_other";
}

export function isCloudConsumptionVariant(variant: string | null | undefined): boolean {
  return !!variant && CLOUD_CONSUMPTION_VARIANTS.has(variant);
}

export function effectiveCloudVariant(
  opportunityVariant: string | null | undefined,
  lead: SalesLead | null | undefined,
): string | null {
  return opportunityVariant ?? cloudVariantFromLead(lead);
}
