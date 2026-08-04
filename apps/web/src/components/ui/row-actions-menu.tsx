"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RowActionsMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  align?: "end" | "start";
  buttonSize?: "icon-sm" | "icon-xs";
  className?: string;
  menuClassName?: string;
};

/**
 * Three-dot row actions menu — portals to document.body with fixed
 * positioning so overflow tables don't clip or misplace the popover.
 */
export function RowActionsMenu({
  open,
  onOpenChange,
  children,
  align = "end",
  buttonSize = "icon-sm",
  className,
  menuClassName,
}: RowActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menu = menuRef.current;
    const menuWidth = menu?.offsetWidth || 176;
    const menuHeight = menu?.offsetHeight || 160;
    const gap = 4;
    const pad = 8;

    let top = rect.bottom + gap;
    if (top + menuHeight > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - gap - menuHeight);
    }

    let left = align === "end" ? rect.right - menuWidth : rect.left;
    left = Math.min(Math.max(pad, left), window.innerWidth - menuWidth - pad);
    setCoords({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    const id = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(id);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onOpenChange(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, onOpenChange, updatePosition]);

  return (
    <div className={cn("inline-flex", className)} data-row-actions-root>
      <Button
        ref={triggerRef}
        type="button"
        size={buttonSize}
        variant="ghost"
        className="cursor-pointer"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {mounted && open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              data-row-actions-menu
              className={cn(
                "fixed z-[200] min-w-[10rem] rounded-lg border border-border bg-card py-1 text-xs shadow-lg",
                menuClassName,
              )}
              style={{
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
                visibility: coords ? "visible" : "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function RowActionsItem({
  children,
  onClick,
  destructive,
  className,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  className?: string;
  href?: string;
}) {
  const classes = cn(
    "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-muted",
    destructive && "text-destructive",
    className,
  );

  if (href) {
    return (
      <a role="menuitem" href={href} className={classes} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      className={classes}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}
