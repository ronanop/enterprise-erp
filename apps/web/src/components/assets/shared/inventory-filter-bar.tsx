"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { OPERATIONAL_STATUS_LABELS, OPERATIONAL_STATUS_VALUES } from "./asset-status";
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
};

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

const DEFAULT_LIFECYCLE: InventoryFilterOption[] = [
  { value: "", label: "All lifecycle" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "in_maintenance", label: "In maintenance" },
  { value: "disposed", label: "Disposed" },
];

const DEFAULT_ASSET_TYPES: InventoryFilterOption[] = [
  { value: "", label: "All types" },
  { value: "fixed", label: "Fixed" },
  { value: "consumable", label: "Consumable" },
  { value: "digital", label: "Digital" },
  { value: "leased", label: "Leased" },
];

export function InventoryFilterBar({
  values,
  onChange,
  onApply,
  onReset,
  branches = [],
  categories = [],
  departments = [],
  assetTypes = DEFAULT_ASSET_TYPES,
  locations = [],
  lifecycleOptions = DEFAULT_LIFECYCLE,
  className,
}: InventoryFilterBarProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="inventory-search">Search</Label>
          <Input
            id="inventory-search"
            placeholder="Asset tag, name, serial…"
            value={values.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Operational status</Label>
          <Select
            value={values.operationalStatus || "__all"}
            onValueChange={(v) =>
              onChange({ operationalStatus: v === "__all" ? "" : v })
            }
          >
            <SelectTrigger className="w-full cursor-pointer">
              <SelectValue placeholder="All operational" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All operational</SelectItem>
              {OPERATIONAL_STATUS_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {OPERATIONAL_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Lifecycle status</Label>
          <Select
            value={values.lifecycleStatus || "__all"}
            onValueChange={(v) =>
              onChange({ lifecycleStatus: v === "__all" ? "" : v })
            }
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
          <Select
            value={values.branchId || BRANCH_ALL_VALUE}
            onValueChange={(v) => onChange({ branchId: v })}
          >
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
          <Label>Category</Label>
          <Select
            value={values.categoryId || "__all"}
            onValueChange={(v) => onChange({ categoryId: v === "__all" ? "" : v })}
          >
            <SelectTrigger className="w-full cursor-pointer">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
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
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          onClick={onReset}
        >
          Reset
        </Button>
        <Button type="button" className="cursor-pointer" onClick={onApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}
