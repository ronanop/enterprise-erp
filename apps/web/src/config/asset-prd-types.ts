/** Interim PRD asset type catalog until backend master exists. */

export type AssetPrdType = {
  id: string;
  typeName: string;
  categoryCode: string;
  description: string;
  /** Maps to API ast_asset.asset_type */
  apiAssetType: "fixed" | "consumable" | "digital" | "leased";
};

export const ASSET_PRD_TYPES: AssetPrdType[] = [
  {
    id: "laptop",
    typeName: "Laptop",
    categoryCode: "IT-HW",
    description: "Portable computers",
    apiAssetType: "fixed",
  },
  {
    id: "desktop",
    typeName: "Desktop",
    categoryCode: "IT-HW",
    description: "Workstation computers",
    apiAssetType: "fixed",
  },
  {
    id: "monitor",
    typeName: "Monitor",
    categoryCode: "IT-HW",
    description: "Displays",
    apiAssetType: "fixed",
  },
  {
    id: "keyboard",
    typeName: "Keyboard",
    categoryCode: "IT-HW",
    description: "Input devices",
    apiAssetType: "fixed",
  },
  {
    id: "mouse",
    typeName: "Mouse",
    categoryCode: "IT-HW",
    description: "Pointing devices",
    apiAssetType: "fixed",
  },
  {
    id: "mobile",
    typeName: "Mobile Device",
    categoryCode: "IT-HW",
    description: "Phones and tablets",
    apiAssetType: "digital",
  },
  {
    id: "furniture",
    typeName: "Office Furniture",
    categoryCode: "FURN",
    description: "Desks, chairs, cabinets",
    apiAssetType: "fixed",
  },
  {
    id: "vehicle",
    typeName: "Vehicle",
    categoryCode: "VEH",
    description: "Company vehicles",
    apiAssetType: "fixed",
  },
  {
    id: "other",
    typeName: "Other",
    categoryCode: "",
    description: "Unclassified asset type",
    apiAssetType: "fixed",
  },
];

export function prdTypesForCategory(categoryCode: string): AssetPrdType[] {
  const code = categoryCode.trim().toUpperCase();
  if (!code) return ASSET_PRD_TYPES;
  const matched = ASSET_PRD_TYPES.filter(
    (t) => !t.categoryCode || t.categoryCode.toUpperCase() === code || t.id === "other",
  );
  return matched.length > 0 ? matched : ASSET_PRD_TYPES;
}

export function getPrdType(id: string): AssetPrdType | undefined {
  return ASSET_PRD_TYPES.find((t) => t.id === id);
}
