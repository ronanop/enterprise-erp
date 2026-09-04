"use client";

import { cn } from "@/lib/utils";

import { BRANCH_ALL_VALUE, type BranchOption } from "./branch-selector";

export type InventoryFilterOption = { value: string; label: string };

export type InventoryFilterValues = {
  search: string;
  operationalStatus: string;
  lifecycleStatus: string;
  branchId: string;
  categoryId: string;
  departmentId: string;
  assetType: string;
  locationId: string;
  /** Phase 5F: "assigned" | "unassigned" | "" */
  assignmentState: string;
};

export const EMPTY_INVENTORY_FILTERS: InventoryFilterValues = {
  search: "",
  operationalStatus: "",
  lifecycleStatus: "",
  branchId: BRANCH_ALL_VALUE,
  categoryId: "",
  departmentId: "",
  assetType: "",
  locationId: BRANCH_ALL_VALUE,
  assignmentState: "",
};

export const DEFAULT_LIFECYCLE_OPTIONS: InventoryFilterOption[] = [
  { value: "", label: "All lifecycle" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "in_maintenance", label: "In maintenance" },
  { value: "disposed", label: "Disposed" },
];

export const DEFAULT_ASSET_TYPE_OPTIONS: InventoryFilterOption[] = [
  { value: "", label: "All types" },
];

export type InventoryFilterBarProps = {
  values: InventoryFilterValues;
  onChange: (patch: Partial<InventoryFilterValues>) => void;
  onApply?: () => void;
  onReset?: () => void;
  branches?: BranchOption[];
  categories?: InventoryFilterOption[];
  departments?: InventoryFilterOption[];
  assetTypes?: InventoryFilterOption[];
  locations?: InventoryFilterOption[];
  lifecycleOptions?: InventoryFilterOption[];
  className?: string;
};

/** Advanced inventory filters were removed from All Assets (search + status dropdown only). */
export function countAdvancedInventoryFilters(_filters: InventoryFilterValues): number {
  return 0;
}

/** @deprecated All Assets no longer renders an advanced filter form. Kept for shared exports. */
export function InventoryFilterBar({ className }: InventoryFilterBarProps) {
  return <div className={cn(className)} data-testid="inventory-filter-form" hidden />;
}
