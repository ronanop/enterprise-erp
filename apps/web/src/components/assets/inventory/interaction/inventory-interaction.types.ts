/** Permission flags for inventory row actions (UI only — no routing in 3.4B-1). */

export type InventoryMenuActionId =
  | "viewDetails"
  | "assign"
  | "return"
  | "portal"
  | "discovery"
  | "qr"
  | "transfer"
  | "maintenance"
  | "history";

export type InventoryActionPermissions = {
  viewDetails: boolean;
  assign: boolean;
  return: boolean;
  portal: boolean;
  discovery: boolean;
  qr: boolean;
  transfer: boolean;
  maintenance: boolean;
  history: boolean;
};

export const DEFAULT_INVENTORY_ACTION_PERMISSIONS: InventoryActionPermissions = {
  viewDetails: true,
  assign: true,
  return: true,
  portal: true,
  discovery: true,
  qr: true,
  transfer: true,
  maintenance: true,
  history: true,
};

export type InventoryQuickLinkId = "portal" | "discovery" | "qr" | "history";

/** Minimal asset identity passed from inventory rows to interaction callbacks. */
export type InventoryAssetRef = {
  id: string;
  assetTag?: string;
  laptopName?: string;
};

export type AssetDetailDrawerAssignment = {
  employee: string;
  issueDate: string;
  department: string;
  deliveryReferenceNumber?: string;
  deliveryReferenceStatus?: string;
  assignmentRemarks?: string;
  returnRemarks?: string;
};

export type AssetDetailDrawerAdditional = {
  earlierUsedBy: string;
  deliveryChallan: string;
  deliveryReferenceStatus?: string;
  remarks: string;
  assignmentRemarks?: string;
  returnRemarks?: string;
};

export type AssetDetailDrawerHistoryEntry = {
  id: string;
  documentNumber: string;
  status: string;
  assigneeLabel: string;
  allocatedAt: string;
  returnedAt: string;
  deliveryReferenceNumber: string;
  deliveryReferenceStatus: string;
  assignmentRemarks: string;
  returnRemarks: string;
};

/** Presentational drawer payload (mapped by container in a later phase). */
export type AssetDetailDrawerData = {
  assetTag: string;
  laptopName: string;
  currentHolder: string;
  configuration: string;
  branch: string;
  operationalStatus: string;
  lifecycleStatus: string;
  assignment?: AssetDetailDrawerAssignment | null;
  additional?: AssetDetailDrawerAdditional | null;
  history?: AssetDetailDrawerHistoryEntry[] | null;
};

export const INVENTORY_MENU_ITEMS: Array<{
  id: InventoryMenuActionId;
  label: string;
  permissionKey: keyof InventoryActionPermissions;
}> = [
  { id: "viewDetails", label: "View Details", permissionKey: "viewDetails" },
  { id: "assign", label: "Assign Asset", permissionKey: "assign" },
  { id: "return", label: "Return Asset", permissionKey: "return" },
  { id: "portal", label: "Information Portal", permissionKey: "portal" },
  { id: "discovery", label: "Discovery", permissionKey: "discovery" },
  { id: "qr", label: "QR Code", permissionKey: "qr" },
  { id: "transfer", label: "Transfer", permissionKey: "transfer" },
  { id: "maintenance", label: "Maintenance", permissionKey: "maintenance" },
  { id: "history", label: "History", permissionKey: "history" },
];
