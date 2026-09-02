"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Eye, MoreVertical } from "lucide-react";

import {
  DEFAULT_INVENTORY_ACTION_PERMISSIONS,
  INVENTORY_MENU_ITEMS,
  type InventoryActionPermissions,
  type InventoryAssetRef,
  type InventoryMenuActionId,
} from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InventoryActionMenuProps = {
  asset: InventoryAssetRef;
  onView?: (asset: InventoryAssetRef) => void;
  onMenuAction?: (action: InventoryMenuActionId, asset: InventoryAssetRef) => void;
  permissions?: Partial<InventoryActionPermissions>;
  disabled?: boolean;
  className?: string;
};

export function InventoryActionMenu({
  asset,
  onView,
  onMenuAction,
  permissions: permissionsProp,
  disabled,
  className,
}: InventoryActionMenuProps) {
  const permissions = { ...DEFAULT_INVENTORY_ACTION_PERMISSIONS, ...permissionsProp };
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const menuItems = INVENTORY_MENU_ITEMS.filter((item) => {
    if (item.id === "viewDetails") return false;
    return permissions[item.permissionKey];
  });

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative inline-flex items-center gap-1", className)}>
      {permissions.viewDetails ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          disabled={disabled}
          onClick={() => onView?.(asset)}
        >
          <Eye className="mr-1 size-4" aria-hidden />
          View
        </Button>
      ) : null}
      {menuItems.length > 0 ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer"
            disabled={disabled}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label="More actions"
            onClick={() => setOpen((v) => !v)}
          >
            <MoreVertical className="size-4" aria-hidden />
          </Button>
          {open ? (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-md border border-border bg-popover p-1 shadow-md"
            >
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="flex w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setOpen(false);
                    onMenuAction?.(item.id, asset);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
