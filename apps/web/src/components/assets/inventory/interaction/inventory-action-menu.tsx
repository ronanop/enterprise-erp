"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type MenuPlacement = {
  top: number;
  left: number;
  openUp: boolean;
};

const MENU_MIN_WIDTH = 200;
const MENU_VIEWPORT_PAD = 8;
const MENU_GAP = 4;

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
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const menuItems = INVENTORY_MENU_ITEMS.filter((item) => {
    if (item.id === "viewDetails") return false;
    return permissions[item.permissionKey];
  });

  const updatePlacement = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuEl = menuRef.current;
    const menuHeight = menuEl?.offsetHeight ?? menuItems.length * 36 + 8;
    const menuWidth = Math.max(menuEl?.offsetWidth ?? MENU_MIN_WIDTH, MENU_MIN_WIDTH);
    const spaceBelow = window.innerHeight - rect.bottom - MENU_VIEWPORT_PAD;
    const spaceAbove = rect.top - MENU_VIEWPORT_PAD;
    const openUp = spaceBelow < menuHeight + MENU_GAP && spaceAbove > spaceBelow;
    let top = openUp ? rect.top - menuHeight - MENU_GAP : rect.bottom + MENU_GAP;
    top = Math.min(
      Math.max(MENU_VIEWPORT_PAD, top),
      Math.max(MENU_VIEWPORT_PAD, window.innerHeight - menuHeight - MENU_VIEWPORT_PAD),
    );
    let left = rect.right - menuWidth;
    left = Math.min(
      Math.max(MENU_VIEWPORT_PAD, left),
      Math.max(MENU_VIEWPORT_PAD, window.innerWidth - menuWidth - MENU_VIEWPORT_PAD),
    );
    setPlacement({ top, left, openUp });
  }, [menuItems.length]);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    updatePlacement();
    const frame = requestAnimationFrame(() => updatePlacement());
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, updatePlacement]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
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

  const menu =
    open && menuItems.length > 0 && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            data-testid={`inventory-action-menu-${asset.assetTag}`}
            data-placement={placement?.openUp ? "top" : "bottom"}
            className="z-[100] min-w-[200px] rounded-md border border-border bg-popover p-1 shadow-md"
            style={{
              position: "fixed",
              top: placement?.top ?? -9999,
              left: placement?.left ?? -9999,
              visibility: placement ? "visible" : "hidden",
            }}
          >
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  onMenuAction?.(item.id, asset);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn("relative inline-flex items-center gap-1", className)}>
      {permissions.viewDetails ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="cursor-pointer transition-colors duration-200"
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
            ref={triggerRef}
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer transition-colors duration-200"
            disabled={disabled}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label="More actions"
            onClick={() => setOpen((v) => !v)}
          >
            <MoreVertical className="size-4" aria-hidden />
          </Button>
          {menu}
        </>
      ) : null}
    </div>
  );
}
