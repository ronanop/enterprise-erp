/** Permission flags for inventory row actions (UI only — no routing in 3.4B-1). */

export type InventoryMenuActionId =
  | "viewDetails"
  | "edit"
  | "assign"
  | "return"
  | "delete"
  | "dispose"
  | "portal"
  | "discovery"
  | "qr"
  | "transfer"
  | "maintenance"
  | "history";

export type InventoryActionPermissions = {
  viewDetails: boolean;
  edit: boolean;
  assign: boolean;
  return: boolean;
  delete: boolean;
  dispose: boolean;
  portal: boolean;
  discovery: boolean;
  qr: boolean;
  transfer: boolean;
  maintenance: boolean;
  history: boolean;
};

export const DEFAULT_INVENTORY_ACTION_PERMISSIONS: InventoryActionPermissions = {
  viewDetails: true,
  edit: true,
  assign: true,
  return: true,
  delete: true,
  dispose: true,
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
  operationalStatus?: string;
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
  returnCondition?: string;
};

export type AssetDetailDrawerConfigParts = {
  cpu: string;
  ram: string;
  storage: string;
  os: string;
  accessories: string;
};

export type AssetDetailDrawerTimelineEvent = {
  id: string;
  label: string;
  at: string;
  kind: "milestone" | "assigned" | "returned" | "status";
};

export type AssetDetailDrawerTabId =
  | "overview"
  | "configuration"
  | "assignment"
  | "history"
  | "timeline"
  | "documents";

export type AssetDetailDrawerActionId =
  | "assign"
  | "return"
  | "edit"
  | "delete"
  | "dispose"
  | "history"
  | "transfer"
  | "maintenance"
  | "portal"
  | "printLabel"
  | "printQr"
  | "printBarcode";

/** Presentational drawer payload (mapped from inventory row — no new APIs). */
export type AssetDetailDrawerData = {
  assetTag: string;
  laptopName: string;
  manufacturer: string;
  model: string;
  currentHolder: string;
  department: string;
  employeeId: string;
  location: string;
  configuration: string;
  configurationParts: AssetDetailDrawerConfigParts;
  branch: string;
  operationalStatus: string;
  lifecycleStatus: string;
  /** Value encoded in drawer QR (existing portal route). */
  qrValue: string;
  assignment?: AssetDetailDrawerAssignment | null;
  additional?: AssetDetailDrawerAdditional | null;
  history?: AssetDetailDrawerHistoryEntry[] | null;
  timeline?: AssetDetailDrawerTimelineEvent[] | null;
};

export const INVENTORY_MENU_ITEMS: Array<{
  id: InventoryMenuActionId;
  label: string;
  permissionKey: keyof InventoryActionPermissions;
  /** Maps to status-driven capability when set. */
  statusAction?: "view" | "edit" | "assign" | "return" | "delete" | "history" | "dispose";
}> = [
  { id: "viewDetails", label: "View Details", permissionKey: "viewDetails", statusAction: "view" },
  { id: "edit", label: "Edit", permissionKey: "edit", statusAction: "edit" },
  { id: "assign", label: "Allocate Asset", permissionKey: "assign", statusAction: "assign" },
  { id: "return", label: "Return Asset", permissionKey: "return", statusAction: "return" },
  { id: "delete", label: "Delete", permissionKey: "delete", statusAction: "delete" },
  { id: "dispose", label: "Complete Disposal", permissionKey: "dispose", statusAction: "dispose" },
  { id: "history", label: "View History", permissionKey: "history", statusAction: "history" },
];
