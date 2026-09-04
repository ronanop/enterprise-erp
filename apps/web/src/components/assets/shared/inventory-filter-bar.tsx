"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function countAdvancedInventoryFilters(filters: InventoryFilterValues): number {
  let count = 0;
  if (filters.lifecycleStatus) count += 1;
  if (filters.categoryId) count += 1;
  if (filters.departmentId) count += 1;
  if (filters.assetType) count += 1;
  if (filters.assignmentState) count += 1;
  if (filters.branchId && filters.branchId !== BRANCH_ALL_VALUE) count += 1;
  if (filters.locationId && filters.locationId !== BRANCH_ALL_VALUE) count += 1;
  return count;
}

export function InventoryFilterBar({
  values,
  onChange,
  onApply,
  onReset,
  branches = [],
  categories: _categories = [],
  departments = [],
  assetTypes = DEFAULT_ASSET_TYPE_OPTIONS,
  locations = [],
  lifecycleOptions = DEFAULT_LIFECYCLE_OPTIONS,
  className,
}: InventoryFilterBarProps) {
  return (
    <div className={cn("space-y-4", className)} data-testid="inventory-filter-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Lifecycle status</Label>
          <Select
            value={values.lifecycleStatus || "__all"}
            onValueChange={(v) => onChange({ lifecycleStatus: v === "__all" ? "" : v })}
          >
            <SelectTrigger className="w-full cursor-pointer">
              <SelectValue placeholder="Lifecycle" />
            </SelectTrigger>
            <SelectContent>
              {lifecycleOptions.map((opt) => (
                <SelectItem key={opt.value || "__all"} value={opt.value || "__all"}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Branch</Label>
          <Select value={values.branchId || BRANCH_ALL_VALUE} onValueChange={(v) => onChange({ branchId: v })}>
            <SelectTrigger className="w-full cursor-pointer">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={BRANCH_ALL_VALUE}>All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Department</Label>
          <Select
            value={values.departmentId || "__all"}
            onValueChange={(v) => onChange({ departmentId: v === "__all" ? "" : v })}
          >
            <SelectTrigger className="w-full cursor-pointer">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Asset type</Label>
          <Select
            value={values.assetType || "__all"}
            onValueChange={(v) => onChange({ assetType: v === "__all" ? "" : v })}
          >
            <SelectTrigger className="w-full cursor-pointer">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {assetTypes.map((t) => (
                <SelectItem key={t.value || "__all"} value={t.value || "__all"}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Assignment</Label>
          <Select
            value={values.assignmentState || "__all"}
            onValueChange={(v) => onChange({ assignmentState: v === "__all" ? "" : v })}
          >
            <SelectTrigger className="w-full cursor-pointer">
              <SelectValue placeholder="Assignment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All assignment states</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Location</Label>
          <Select
            value={values.locationId || BRANCH_ALL_VALUE}
            onValueChange={(v) => onChange({ locationId: v })}
          >
            <SelectTrigger className="w-full cursor-pointer">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={BRANCH_ALL_VALUE}>All locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.value} value={loc.value}>
                  {loc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="cursor-pointer" onClick={onReset}>
          Reset
        </Button>
        <Button
          type="button"
          className="cursor-pointer"
          data-inventory-filter-apply="true"
          onClick={onApply}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
