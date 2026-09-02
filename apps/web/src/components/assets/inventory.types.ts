import type { OperationalStatusValue } from "@/components/assets/shared/asset-status";

export type InventoryPresetId =
  | "all"
  | "ready"
  | "assigned"
  | "in_maintenance"
  | "retired"
  | "pending_disposal"
  | "disposed"
  | "in_use_as_component";

export const INVENTORY_PRESETS: Array<{ id: InventoryPresetId; label: string }> = [
  { id: "all", label: "All Assets" },
  { id: "ready", label: "Ready To Move" },
  { id: "assigned", label: "Assigned" },
  { id: "in_maintenance", label: "In Maintenance" },
  { id: "in_use_as_component", label: "In Use as Component" },
  { id: "retired", label: "Retired" },
  { id: "pending_disposal", label: "Pending Disposal" },
  { id: "disposed", label: "Disposed" },
];

/** Selected pill tints — aligned with `statusColorMap` operational colors. */
export const INVENTORY_PRESET_PILL_CLASS: Record<InventoryPresetId, string> = {
  all: "border-primary bg-primary text-primary-foreground shadow-sm",
  ready: "border-sky-700 bg-sky-700 text-white shadow-sm",
  assigned: "border-emerald-700 bg-emerald-700 text-white shadow-sm",
  in_maintenance: "border-amber-700 bg-amber-700 text-white shadow-sm",
  in_use_as_component: "border-indigo-700 bg-indigo-700 text-white shadow-sm",
  retired: "border-rose-800 bg-rose-800 text-white shadow-sm",
  pending_disposal: "border-amber-700 bg-amber-700 text-white shadow-sm",
  disposed: "border-zinc-700 bg-zinc-700 text-white shadow-sm",
};

export const PRESET_OPERATIONAL_STATUS: Record<
  InventoryPresetId,
  OperationalStatusValue | undefined
> = {
  all: undefined,
  ready: "READY_TO_MOVE",
  assigned: "ASSIGNED",
  in_maintenance: "IN_MAINTENANCE",
  in_use_as_component: "IN_USE_AS_COMPONENT",
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
  in_maintenance: {
    title: "No assets in maintenance",
    description: "Assets with active maintenance work orders appear here.",
  },
  in_use_as_component: {
    title: "No component-attached assets",
    description: "Assets currently installed as components of another asset appear here.",
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
