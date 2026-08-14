import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";
import { inventoryRowToRegisterGroups } from "@/components/assets/inventory/inventory-register-groups";
import type {
  AssetDetailDrawerData,
  InventoryAssetRef,
} from "@/components/assets/inventory/interaction/inventory-interaction.types";

export function inventoryRowToAssetRef(row: InventoryRowViewModel): InventoryAssetRef {
  return {
    id: row.id,
    assetTag: row.assetTag,
    laptopName: row.laptopName,
  };
}

/**
 * Project inventory row → drawer payload.
 * Assignment / IT / location / accessories / DC / remarks all come from the same
 * register-group model as the expandable row (Sub-phase 4E consistency).
 */
export function mapInventoryRowToDrawerData(row: InventoryRowViewModel): AssetDetailDrawerData {
  const groups = inventoryRowToRegisterGroups(row);
  return {
    assetTag: row.assetTag,
    laptopName: row.laptopName,
    currentHolder: row.currentHolder,
    configuration: row.configuration,
    make: row.manufacturer,
    model: row.model,
    serialNumber: row.serialNumber,
    location: row.location,
    branch: row.branch,
    operationalStatus: row.operationalStatus,
    lifecycleStatus: row.lifecycleStatus,
    registerGroups: groups,
    assignment: {
      employee: groups.assignee,
      employeeId: groups.employeeId,
      phone: groups.phone,
      issueDate: groups.issuedDate,
      earlierUsedBy: groups.earlierUsedBy,
      department: row.department,
      deliveryReferenceNumber: groups.dcNumber,
      deliveryReferenceStatus: groups.dcStatus,
      deliverySignature: groups.dcSignature,
      deliveryChallanSummary: row.expandable.deliveryChallanSummary,
      assignmentRemarks: groups.assignmentRemarks,
      returnRemarks: groups.returnRemarks,
    },
    additional: {
      earlierUsedBy: groups.earlierUsedBy,
      deliveryChallan: groups.dcNumber,
      deliveryReferenceStatus: groups.dcStatus,
      deliverySignature: groups.dcSignature,
      deliveryChallanSummary: row.expandable.deliveryChallanSummary,
      remarks: groups.assignmentRemarks,
      assignmentRemarks: groups.assignmentRemarks,
      returnRemarks: groups.returnRemarks,
      make: groups.make,
      model: groups.model,
      configuration: groups.configuration,
      branch: groups.branch,
      location: groups.location,
      accessories: groups.accessories,
      phone: groups.phone,
      employeeId: groups.employeeId,
    },
    history: row.assignmentHistory,
  };
}
