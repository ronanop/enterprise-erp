/** CRM lead product type and sub-product option lists (lead create form). */

/** Selectable product types — Services is standalone; no combo "&" options. */
export const LEAD_PRODUCT_TYPES = [
  "Hardware",
  "Software",
  "Services",
  "Networking",
  "Cybersecurity",
  "Cloud",
  "AI",
  "Others",
] as const;

export type LeadProductType = (typeof LEAD_PRODUCT_TYPES)[number];

/** Legacy combo labels still present on older leads. */
const LEGACY_PRODUCT_TYPE_EXPAND: Record<string, readonly LeadProductType[]> = {
  "Hardware & Services": ["Hardware", "Services"],
  "Software & Services": ["Software", "Services"],
  "Hardware & Software": ["Hardware", "Software"],
};

/** Quote service types mirror lead product types except "Others". */
export const QUOTE_SERVICE_TYPES = LEAD_PRODUCT_TYPES.filter(
  (type): type is Exclude<LeadProductType, "Others"> => type !== "Others",
);

export type QuoteServiceType = (typeof QUOTE_SERVICE_TYPES)[number];

const LEGACY_QUOTE_SERVICE_TYPE_MAP: Record<string, QuoteServiceType> = {
  hardware: "Hardware",
  software: "Software",
  services: "Services",
};

export function normalizeQuoteServiceType(
  value: string | null | undefined,
): QuoteServiceType | "" {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  const legacy = LEGACY_QUOTE_SERVICE_TYPE_MAP[trimmed.toLowerCase()];
  if (legacy) return legacy;
  const match = QUOTE_SERVICE_TYPES.find((type) => type.toLowerCase() === trimmed.toLowerCase());
  return match ?? "";
}

export function isQuoteServiceType(value: string | null | undefined): boolean {
  return normalizeQuoteServiceType(value) !== "";
}

/** Sub-products shown when Product Type = Cloud. */
export const CLOUD_SUB_PRODUCTS = [
  "Billing Shift AWS",
  "Billing Shift Azure",
  "Billing Shift GCP",
  "AI-POC/ OLA/ MAP",
  "FinOps Aquila Clouds",
  "Finops Zolix Cloud",
  "Migration",
] as const;

export type CloudSubProduct = (typeof CLOUD_SUB_PRODUCTS)[number];

const LEAD_SUB_PRODUCT_CATEGORIES: Record<LeadProductType, readonly string[]> = {
  Hardware: [
    "Servers",
    "Storage",
    "Workstations / Laptops",
    "Peripherals",
    "Networking Hardware",
    "Others",
  ],
  Software: [
    "Enterprise Applications",
    "Operating Systems",
    "Databases",
    "Licensing / Subscriptions",
    "Security Software",
    "Others",
  ],
  Services: [
    "Implementation",
    "Consulting",
    "Managed Services",
    "Support & AMC",
    "Training",
    "Others",
  ],
  Networking: [
    "Switches",
    "Routers",
    "Wireless / Wi-Fi",
    "SD-WAN",
    "Firewalls (Network)",
    "Cabling / Structured Cabling",
    "Others",
  ],
  Cybersecurity: [
    "Endpoint Security",
    "Network Security",
    "Identity & Access Management",
    "SOC / Managed Detection",
    "Vulnerability Management",
    "Others",
  ],
  Cloud: CLOUD_SUB_PRODUCTS,
  AI: [
    "AI Platforms / Models",
    "Analytics & ML",
    "Computer Vision",
    "NLP / Generative AI",
    "AI Consulting & Implementation",
    "Others",
  ],
  Others: ["General", "Custom / Unspecified", "Others"],
};

const LEGACY_SUB_PRODUCT_CATEGORIES: Record<string, readonly string[]> = {
  "Hardware & Services": [
    "Hardware Supply + Installation",
    "Hardware Supply + Support / AMC",
    "Turnkey Infrastructure",
    "Others",
  ],
  "Software & Services": [
    "Implementation Services",
    "Customization & Integration",
    "Managed Application Services",
    "Support & AMC",
    "Others",
  ],
  "Hardware & Software": [
    "Bundled Solutions",
    "Appliance / Bundle",
    "System Integration Kit",
    "Others",
  ],
};

export const LEAD_PRODUCT_TYPE_SEPARATOR = ", ";

export function normalizeLeadProductType(value: string | null | undefined): LeadProductType | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const match = LEAD_PRODUCT_TYPES.find((type) => type.toLowerCase() === trimmed.toLowerCase());
  return match ?? null;
}

export function parseLeadProductTypes(value: string | null | undefined): LeadProductType[] {
  if (!value?.trim()) return [];
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const out: LeadProductType[] = [];
  for (const part of parts) {
    const expanded = LEGACY_PRODUCT_TYPE_EXPAND[part];
    if (expanded) {
      for (const item of expanded) {
        if (!out.includes(item)) out.push(item);
      }
      continue;
    }
    const normalized = normalizeLeadProductType(part);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return out;
}

export function formatLeadProductTypes(types: readonly string[]): string {
  return types.join(LEAD_PRODUCT_TYPE_SEPARATOR);
}

export function subProductOptionsForType(productType: string | null | undefined): readonly string[] {
  const normalized = normalizeLeadProductType(productType);
  if (normalized) return LEAD_SUB_PRODUCT_CATEGORIES[normalized];
  const legacy = (productType ?? "").trim();
  if (legacy && legacy in LEGACY_SUB_PRODUCT_CATEGORIES) {
    return LEGACY_SUB_PRODUCT_CATEGORIES[legacy];
  }
  return [];
}

export function subProductOptionsForTypes(productTypes: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const type of productTypes) {
    for (const option of subProductOptionsForType(type)) {
      if (seen.has(option)) continue;
      seen.add(option);
      merged.push(option);
    }
  }
  return merged;
}

export function isCloudLeadProductType(productType: string | null | undefined): boolean {
  return parseLeadProductTypes(productType).includes("Cloud");
}
