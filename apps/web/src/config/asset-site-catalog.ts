/**
 * Frontend city → building catalog for Add Asset Location & Registration.
 * Org APIs have no city→building hierarchy; values compose into `location_label`.
 */

export type AssetSiteCity = {
  id: string;
  label: string;
  buildings: { id: string; label: string }[];
};

export const ASSET_SITE_CATALOG: AssetSiteCity[] = [
  {
    id: "mumbai",
    label: "Mumbai",
    buildings: [
      { id: "mumbai-crc-1", label: "CRC-1" },
      { id: "mumbai-crc-2", label: "CRC-2" },
      { id: "mumbai-it-park", label: "Mumbai IT Park" },
    ],
  },
  {
    id: "delhi",
    label: "Delhi",
    buildings: [
      { id: "delhi-crc-1", label: "CRC-1" },
      { id: "delhi-crc-2", label: "CRC-2" },
      { id: "delhi-ho", label: "Delhi Head Office" },
    ],
  },
  {
    id: "noida",
    label: "Noida",
    buildings: [
      { id: "noida-crc-1", label: "CRC-1" },
      { id: "noida-it-hub", label: "Noida IT Hub" },
    ],
  },
  {
    id: "gurgaon",
    label: "Gurgaon",
    buildings: [
      { id: "gurgaon-crc-1", label: "CRC-1" },
      { id: "gurgaon-cyber", label: "Cyber Park" },
    ],
  },
  {
    id: "bangalore",
    label: "Bangalore",
    buildings: [
      { id: "blr-crc-1", label: "CRC-1" },
      { id: "blr-manyata", label: "Manyata Tech Park" },
    ],
  },
  {
    id: "hyderabad",
    label: "Hyderabad",
    buildings: [
      { id: "hyd-crc-1", label: "CRC-1" },
      { id: "hyd-hitech", label: "HITEC City Campus" },
    ],
  },
  {
    id: "pune",
    label: "Pune",
    buildings: [
      { id: "pune-crc-1", label: "CRC-1" },
      { id: "pune-hinjewadi", label: "Hinjewadi IT Park" },
    ],
  },
];

export function getSiteCity(cityId: string): AssetSiteCity | undefined {
  return ASSET_SITE_CATALOG.find((c) => c.id === cityId);
}

export function buildingsForCity(cityId: string): { id: string; label: string }[] {
  return getSiteCity(cityId)?.buildings ?? [];
}

/** Compose city + building into Phase 4A `location_label`. */
export function composeLocationLabel(cityId: string, buildingId: string): string | undefined {
  const city = getSiteCity(cityId);
  if (!city) return undefined;
  const building = city.buildings.find((b) => b.id === buildingId);
  if (!building) return city.label;
  return `${city.label} · ${building.label}`;
}
