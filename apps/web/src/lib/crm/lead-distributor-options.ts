const RAW_LEAD_DISTRIBUTOR_OPTIONS = [
  "IN STOCK",
  "Redington",
  "Ingram Micro",
  "TD SYNNEX",
  "Tech Data",
  "Rashi Peripherals (RP Tech)",
  "Savex Technologies",
  "Supertron Electronics",
  "Iris Global Services",
  "Compuage Infocom",
  "e-Mall",
  "Exclusive Networks",
  "Westcon-Comstor",
  "Arrow Electronics",
  "Avnet",
  "Synnex",
  "ScanSource",
  "VAD Technologies",
  "CMS IT Services",
  "Beetel Teletech",
  "Creative Newtech",
  "Iris Global",
  "Astrum",
  "Nuvias",
  "Crayon",
  "Pax8",
  "ALSO",
  "Exertis",
  "D&H Distributing",
  "SYNNEX",
] as const;

export const LEAD_DISTRIBUTOR_OPTIONS: readonly string[] = [...new Set(RAW_LEAD_DISTRIBUTOR_OPTIONS)];

export const LEAD_DISTRIBUTOR_SEPARATOR = ", ";

export function parseLeadDistributorNames(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function formatLeadDistributorNames(names: readonly string[]): string {
  return names.join(LEAD_DISTRIBUTOR_SEPARATOR);
}
