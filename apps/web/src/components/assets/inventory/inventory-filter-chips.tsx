"use client";

import { X } from "lucide-react";

import {
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
  _lookups: {
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
