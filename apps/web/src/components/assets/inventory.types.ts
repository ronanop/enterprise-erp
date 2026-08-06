import type { OperationalStatusValue } from "@/components/assets/shared/asset-status";

export type InventoryPresetId =
  | "all"
  | "ready"
  | "assigned"
  | "retired"
  | "pending_disposal"
  | "disposed";

export const INVENTORY_PRESETS: Array<{ id: InventoryPresetId; label: string }> = [
  { id: "all", label: "All Assets" },
  { id: "ready", label: "Ready To Move" },
  { id: "assigned", label: "Assigned" },
  { id: "retired", label: "Retired" },
  { id: "pending_disposal", label: "Pending Disposal" },
  { id: "disposed", label: "Disposed" },
];

export const PRESET_OPERATIONAL_STATUS: Record<
  InventoryPresetId,
  OperationalStatusValue | undefined
> = {
  all: undefined,
  ready: "READY_TO_MOVE",
  assigned: "ASSIGNED",
  retired: "RETIRED",
  pending_disposal: "PENDING_DISPOSAL",
  disposed: "DISPOSED",
};

export const PRESET_EMPTY_COPY: Record<
  InventoryPresetId,
  { title: string; description: string }
> = {
  all: {
    title: "No assets found",
    description: "Adjust filters or register a new asset.",
  },
  ready: {
    title: "No ready assets",
    description: "No assets ready for assignment in this branch.",
  },
  assigned: {
    title: "No assigned assets",
    description: "Check the Ready To Move queue to assign assets.",
  },
  retired: {
    title: "No retired assets",
    description: "Retired assets will appear here.",
  },
  pending_disposal: {
    title: "No pending disposal",
    description: "No assets marked for disposal.",
  },
  disposed: {
    title: "No disposed assets",
    description: "Disposed assets will appear here.",
  },
};
