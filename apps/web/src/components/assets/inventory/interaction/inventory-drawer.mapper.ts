import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";
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

export function mapInventoryRowToDrawerData(row: InventoryRowViewModel): AssetDetailDrawerData {
  return {
    assetTag: row.assetTag,
    laptopName: row.laptopName,
    currentHolder: row.currentHolder,
    configuration: row.configuration,
    branch: row.branch,
    operationalStatus: row.operationalStatus,
    lifecycleStatus: row.lifecycleStatus,
    assignment: {
      employee: row.currentHolder,
      issueDate: row.issueDate,
      department: row.department,
      deliveryReferenceNumber: row.expandable.deliveryChallan,
      deliveryReferenceStatus: row.expandable.deliveryReferenceStatus,
      assignmentRemarks: row.expandable.assignmentRemarks,
      returnRemarks: row.expandable.returnRemarks,
    },
    additional: {
      earlierUsedBy: row.expandable.earlierUsedBy,
      deliveryChallan: row.expandable.deliveryChallan,
      deliveryReferenceStatus: row.expandable.deliveryReferenceStatus,
      remarks: row.expandable.assignmentRemarks,
      assignmentRemarks: row.expandable.assignmentRemarks,
      returnRemarks: row.expandable.returnRemarks,
    },
    history: row.assignmentHistory,
  };
}
