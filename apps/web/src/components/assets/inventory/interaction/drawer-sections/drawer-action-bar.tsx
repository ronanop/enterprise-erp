"use client";

import type {
  AssetDetailDrawerActionId,
  InventoryActionPermissions,
  InventoryAssetRef,
} from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { DEFAULT_INVENTORY_ACTION_PERMISSIONS } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import {
  resolveDrawerPrimaryAction,
  statusActionEmptyMessage,
  type StatusDrivenActionId,
} from "@/components/assets/inventory/status-driven-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_TO_DRAWER_ACTION: Record<StatusDrivenActionId, AssetDetailDrawerActionId | null> = {
  view: null,
  edit: "edit",
  assign: "assign",
  return: "return",
  delete: "delete",
  history: "history",
  dispose: "dispose",
};

const PERMISSION_FOR_DRAWER_ACTION: Partial<
  Record<AssetDetailDrawerActionId, keyof InventoryActionPermissions>
> = {
  assign: "assign",
  return: "return",
  edit: "edit",
  delete: "delete",
  dispose: "dispose",
  history: "history",
};

export type DrawerActionBarProps = {
  asset?: InventoryAssetRef | null;
  permissions?: Partial<InventoryActionPermissions>;
  onAction?: (action: AssetDetailDrawerActionId, asset: InventoryAssetRef) => void;
  operationalStatus?: string | null;
  className?: string;
};

export function resolveDrawerActionVisibility(operationalStatus?: string | null): {
  showAllocate: boolean;
  showReturn: boolean;
  primaryAction: "assign" | "return" | "dispose" | "history" | null;
} {
  const primary = resolveDrawerPrimaryAction(operationalStatus);
  return {
    showAllocate: primary?.action === "assign",
    showReturn: primary?.action === "return",
    primaryAction:
      primary?.action === "assign" ||
      primary?.action === "return" ||
      primary?.action === "dispose" ||
      primary?.action === "history"
        ? primary.action
        : null,
  };
}

export function DrawerActionBar({
  asset,
  permissions: permissionsProp,
  onAction,
  operationalStatus,
  className,
}: DrawerActionBarProps) {
  const permissions = { ...DEFAULT_INVENTORY_ACTION_PERMISSIONS, ...permissionsProp };
  const primary = resolveDrawerPrimaryAction(operationalStatus);
  const drawerAction = primary ? STATUS_TO_DRAWER_ACTION[primary.action] : null;
  const permissionKey = drawerAction ? PERMISSION_FOR_DRAWER_ACTION[drawerAction] : undefined;
  const allowedByPermission = permissionKey ? permissions[permissionKey] : true;
  const showPrimary = Boolean(primary && drawerAction && allowedByPermission);

  return (
    <footer
      className={cn(
        "sticky bottom-0 shrink-0 border-t border-border/60 bg-card/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/90",
        className,
      )}
      data-testid="drawer-action-bar"
      data-operational-status={operationalStatus ?? ""}
    >
      {showPrimary && drawerAction ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            disabled={!asset || !onAction}
            onClick={() => {
              if (asset && onAction) onAction(drawerAction, asset);
            }}
          >
            {primary?.label}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="drawer-action-empty">
          {statusActionEmptyMessage(operationalStatus)}
        </p>
      )}
    </footer>
  );
}
