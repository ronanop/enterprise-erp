/** Permission flags for inventory row actions (UI only — no routing in 3.4B-1). */

export type InventoryMenuActionId =
  | "viewDetails"
  | "edit"
  | "delete"
  | "assign"
  | "return"
  | "portal"
  | "discovery"
  | "qr"
  | "transfer"
  | "maintenance"
  | "startDisposal"
  | "reinstate"
  | "history";

export type InventoryActionPermissions = {
  viewDetails: boolean;
  edit: boolean;
  delete: boolean;
  assign: boolean;
  return: boolean;
  portal: boolean;
  discovery: boolean;
  qr: boolean;
  transfer: boolean;
  maintenance: boolean;
  startDisposal: boolean;
  reinstate: boolean;
  history: boolean;
};

export const DEFAULT_INVENTORY_ACTION_PERMISSIONS: InventoryActionPermissions = {
  viewDetails: true,
  edit: true,
  delete: true,
  assign: true,
  return: true,
  portal: true,
  discovery: true,
  qr: true,
  transfer: true,
  maintenance: true,
  startDisposal: true,
  reinstate: true,
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
  employeeId?: string;
  phone?: string;
  issueDate: string;
  earlierUsedBy?: string;
  department: string;
  deliveryReferenceNumber?: string;
  deliveryReferenceStatus?: string;
  deliverySignature?: string;
  deliveryChallanSummary?: string;
  assignmentRemarks?: string;
  returnRemarks?: string;
};

export type AssetDetailDrawerAdditional = {
  earlierUsedBy: string;
  deliveryChallan: string;
  deliveryReferenceStatus?: string;
  deliverySignature?: string;
  deliveryChallanSummary?: string;
  remarks: string;
  assignmentRemarks?: string;
  returnRemarks?: string;
  make?: string;
  model?: string;
  configuration?: string;
  branch?: string;
  location?: string;
  accessories?: Array<{
    typeLabel: string;
    serialDisplay: string;
    componentName?: string;
    status?: string;
  }>;
  phone?: string;
  employeeId?: string;
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
  deliverySignature?: string;
  deliveryChallanSummary?: string;
  assignmentRemarks: string;
  returnRemarks: string;
};

/** Presentational drawer payload (mapped from inventory row via shared register groups). */
export type AssetDetailDrawerData = {
  assetTag: string;
  laptopName: string;
  currentHolder: string;
  configuration: string;
  make?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  branch: string;
  operationalStatus: string;
  lifecycleStatus: string;
  /** Same model as inventory expandable (preferred for 4E consistency). */
  registerGroups?: import("@/components/assets/inventory/inventory-register-groups").InventoryRegisterGroupModel;
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
  // Edit is shown in the overflow menu (not as a direct row button).
  { id: "edit", label: "Edit", permissionKey: "edit" },
  { id: "assign", label: "Assign Asset", permissionKey: "assign" },
  { id: "return", label: "Return Asset", permissionKey: "return" },
  // History + Discovery live inside Information Portal — single menu entry.
  { id: "portal", label: "Information Portal", permissionKey: "portal" },
  { id: "qr", label: "QR Code", permissionKey: "qr" },
  { id: "transfer", label: "User Transfer", permissionKey: "transfer" },
  { id: "maintenance", label: "Maintenance", permissionKey: "maintenance" },
  { id: "startDisposal", label: "Dispose", permissionKey: "startDisposal" },
  // Destructive action — always last in the overflow menu.
  { id: "delete", label: "Delete", permissionKey: "delete" },
];
