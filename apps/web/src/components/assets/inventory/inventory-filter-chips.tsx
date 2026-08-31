"use client";

import { X } from "lucide-react";

import {
  DEFAULT_ASSET_TYPE_OPTIONS,
  DEFAULT_LIFECYCLE_OPTIONS,
  BRANCH_ALL_VALUE,
  type BranchOption,
  type InventoryFilterOption,
  type InventoryFilterValues,
} from "@/components/assets/shared";

export type InventoryFilterChip = {
  key: keyof InventoryFilterValues;
  label: string;
};

export function listActiveInventoryFilterChips(
  filters: InventoryFilterValues,
  lookups: {
    branches?: BranchOption[];
    categories?: InventoryFilterOption[];
    departments?: InventoryFilterOption[];
    locations?: InventoryFilterOption[];
    assetTypes?: InventoryFilterOption[];
  } = {},
): InventoryFilterChip[] {
  const chips: InventoryFilterChip[] = [];
  if (filters.search.trim()) {
    chips.push({ key: "search", label: `Search: ${filters.search.trim()}` });
  }
  if (filters.lifecycleStatus) {
    const life =
      DEFAULT_LIFECYCLE_OPTIONS.find((o) => o.value === filters.lifecycleStatus)?.label ??
      filters.lifecycleStatus;
    chips.push({ key: "lifecycleStatus", label: `Lifecycle: ${life}` });
  }
  if (filters.branchId && filters.branchId !== BRANCH_ALL_VALUE) {
    const branch =
      lookups.branches?.find((b) => b.id === filters.branchId)?.label ?? filters.branchId;
    chips.push({ key: "branchId", label: `Branch: ${branch}` });
  }
  if (filters.departmentId) {
    const department =
      lookups.departments?.find((d) => d.value === filters.departmentId)?.label ??
      filters.departmentId;
    chips.push({ key: "departmentId", label: `Department: ${department}` });
  }
  if (filters.assetType) {
    const typeOptions = lookups.assetTypes?.length
      ? lookups.assetTypes
      : DEFAULT_ASSET_TYPE_OPTIONS;
    const type =
      typeOptions.find((o) => o.value === filters.assetType)?.label ?? filters.assetType;
    chips.push({ key: "assetType", label: `Type: ${type}` });
  }
  if (filters.assignmentState) {
    const assignment = filters.assignmentState === "unassigned" ? "Unassigned" : "Assigned";
    chips.push({ key: "assignmentState", label: `Assignment: ${assignment}` });
  }
  if (filters.locationId && filters.locationId !== BRANCH_ALL_VALUE) {
    const location =
      lookups.locations?.find((l) => l.value === filters.locationId)?.label ?? filters.locationId;
    chips.push({ key: "locationId", label: `Location: ${location}` });
  }
  return chips;
}

export type InventoryActiveFilterChipsProps = {
  filters: InventoryFilterValues;
  branches?: BranchOption[];
  categories?: InventoryFilterOption[];
  departments?: InventoryFilterOption[];
  locations?: InventoryFilterOption[];
  assetTypes?: InventoryFilterOption[];
  onDismiss: (key: keyof InventoryFilterValues) => void;
};

export function InventoryActiveFilterChips({
  filters,
  branches,
  categories,
  departments,
  locations,
  assetTypes,
  onDismiss,
}: InventoryActiveFilterChipsProps) {
  const chips = listActiveInventoryFilterChips(filters, {
    branches,
    categories,
    departments,
    locations,
    assetTypes,
  });
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" data-testid="inventory-active-filter-chips">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-xs text-foreground"
        >
          {chip.label}
          <button
            type="button"
            className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
            aria-label={`Remove filter ${chip.label}`}
            onClick={() => onDismiss(chip.key)}
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
    </div>
  );
}
