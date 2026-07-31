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
    id: "mobile",
    typeName: "Mobile Device",
    categoryCode: "IT-HW",
    description: "Phones and tablets",
    apiAssetType: "digital",
  },
];

export function prdTypesForCategory(categoryCode: string): AssetPrdType[] {
  const code = categoryCode.trim().toUpperCase();
  return ASSET_PRD_TYPES.filter(
    (t) => t.categoryCode.toUpperCase() === code || code === "",
  );
}
