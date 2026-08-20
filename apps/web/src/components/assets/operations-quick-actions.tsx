"use client";

import {
  FileDown,
  FileUp,
  PackagePlus,
  Undo2,
  UserPlus,
} from "lucide-react";

import { QuickActionCard } from "@/components/assets/shared";
import { cn } from "@/lib/utils";

export type OperationsQuickActionsProps = {
  onAddAsset?: () => void;
  onAllocate?: () => void;
  onReturn?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  className?: string;
};

export function OperationsQuickActions({
  onAddAsset,
  onAllocate,
  onReturn,
  onImport,
  onExport,
  className,
}: OperationsQuickActionsProps) {
  return (
    <section
      aria-labelledby="asset-ops-quick-actions-heading"
      className={cn("space-y-3", className)}
      data-testid="asset-ops-operations-panel"
    >
      <h2
        id="asset-ops-quick-actions-heading"
        className="text-sm font-medium tracking-tight text-foreground"
      >
        Operations
      </h2>
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        data-testid="asset-ops-quick-actions-grid"
      >
        <QuickActionCard
          title="Add Asset"
          description="Open asset registration"
          icon={PackagePlus}
          onPress={onAddAsset}
        />
        <QuickActionCard
          title="Allocate Asset"
          description="Open assignment wizard"
          icon={UserPlus}
          onPress={onAllocate}
        />
        <QuickActionCard
          title="Return Asset"
          description="Open return wizard"
          icon={Undo2}
          onPress={onReturn}
        />
        <QuickActionCard
          title="Bulk Import"
          description="Open inventory import"
          icon={FileUp}
          onPress={onImport}
        />
        <QuickActionCard
          title="Export Register"
          description="Export current register"
          icon={FileDown}
          onPress={onExport}
        />
      </div>
    </section>
  );
}
