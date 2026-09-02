"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type InventoryFilterPopoverRenderProps = {
  close: () => void;
};

export type InventoryFilterPopoverProps = {
  activeCount: number;
  children: ReactNode | ((props: InventoryFilterPopoverRenderProps) => ReactNode);
  className?: string;
};

export function InventoryFilterPopover({
  activeCount,
  children,
  className,
}: InventoryFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const content = typeof children === "function" ? children({ close: () => setOpen(false) }) : children;

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <Button
        type="button"
        variant="outline"
        className="cursor-pointer gap-2 transition-colors duration-200"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        data-testid="inventory-filters-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filters
        {activeCount > 0 ? (
          <Badge variant="secondary" className="min-w-5 justify-center px-1.5" data-testid="inventory-filters-count">
            {activeCount}
          </Badge>
        ) : null}
      </Button>
      {open ? (
        <Card
          id={panelId}
          role="dialog"
          aria-label="Inventory filters"
          className="absolute left-0 z-40 mt-2 w-[min(calc(100vw-2rem),24rem)] py-3 shadow-lg sm:left-auto sm:right-0"
          data-testid="inventory-filters-panel"
        >
          <CardContent className="px-3">{content}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}
