"use client";

import { FileDown, FileUp, PackagePlus, RefreshCw, Search, Undo2, UserPlus } from "lucide-react";

import { BranchSelector, type BranchOption } from "@/components/assets/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type OperationsStickyToolbarProps = {
  branchId: string;
  branches: BranchOption[];
  onBranchChange: (branchId: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onAddAsset?: () => void;
  onAllocate?: () => void;
  onReturn?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  className?: string;
};

export function OperationsStickyToolbar({
  branchId,
  branches,
  onBranchChange,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  onAddAsset,
  onAllocate,
  onReturn,
  onImport,
  onExport,
  onRefresh,
  className,
}: OperationsStickyToolbarProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-30 -mx-4 border-b border-border/70 bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-6 md:px-6",
        "transition-shadow duration-200",
        className,
      )}
      data-testid="asset-ops-sticky-toolbar"
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
          data-testid="asset-ops-global-search"
        >
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tag, name, serial, employee, department, branch…"
              aria-label="Global asset search"
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="secondary" className="cursor-pointer shrink-0">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <BranchSelector
            value={branchId}
            onChange={onBranchChange}
            branches={branches}
            aria-label="Branch"
          />
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            onClick={onAddAsset}
            data-testid="toolbar-add-asset"
          >
            <PackagePlus className="size-4" aria-hidden />
            Add Asset
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={onAllocate}
          >
            <UserPlus className="size-4" aria-hidden />
            Allocate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={onReturn}
          >
            <Undo2 className="size-4" aria-hidden />
            Return
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={onImport}
          >
            <FileUp className="size-4" aria-hidden />
            Import
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={onExport}
          >
            <FileDown className="size-4" aria-hidden />
            Export
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={onRefresh}
            aria-label="Refresh dashboard"
            data-testid="asset-ops-refresh"
          >
            <RefreshCw className="size-4" aria-hidden />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
