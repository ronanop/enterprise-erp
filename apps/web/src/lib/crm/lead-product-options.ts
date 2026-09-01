/** CRM lead product type and sub-product option lists (lead create form). */

export const LEAD_PRODUCT_TYPES = [
  "Hardware",
  "Software",
  "Services",
  "Hardware & Services",
  "Hardware & Software",
  "Software & Services",
  "Networking",
  "Cybersecurity",
  "Cloud",
  "AI",
  "Others",
] as const;

export type LeadProductType = (typeof LEAD_PRODUCT_TYPES)[number];

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

export const LEAD_SUB_PRODUCT_CATEGORIES: Record<LeadProductType, readonly string[]> = {
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
  "Hardware & Services": [
    "Hardware Supply + Installation",
    "Hardware Supply + Support / AMC",
    "Turnkey Infrastructure",
    "Others",
  ],
  "Hardware & Software": [
    "Bundled Solutions",
    "Appliance / Bundle",
    "System Integration Kit",
    "Others",
  ],
  "Software & Services": [
    "Implementation Services",
    "Customization & Integration",
    "Managed Application Services",
    "Support & AMC",
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

export function normalizeLeadProductType(value: string | null | undefined): LeadProductType | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const match = LEAD_PRODUCT_TYPES.find((type) => type.toLowerCase() === trimmed.toLowerCase());
  return match ?? null;
}

export function subProductOptionsForType(productType: string | null | undefined): readonly string[] {
  const normalized = normalizeLeadProductType(productType);
  if (!normalized) return [];
  return LEAD_SUB_PRODUCT_CATEGORIES[normalized];
}

export function isCloudLeadProductType(productType: string | null | undefined): boolean {
  return normalizeLeadProductType(productType) === "Cloud";
}
