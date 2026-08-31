"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InventoryExportToolbarProps = {
  exporting?: boolean;
  exportError?: string | null;
  exportSuccess?: string | null;
  onExportExcel: () => void;
  onExportCsv: () => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Presentational export control — no fetch / file logic.
 */
export function InventoryExportToolbar({
  exporting,
  exportError,
  exportSuccess,
  onExportExcel,
  onExportCsv,
  disabled,
  className,
}: InventoryExportToolbarProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const busy = Boolean(exporting);
  const blocked = busy || disabled;

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
    <div
      ref={containerRef}
      className={cn("relative flex flex-col items-stretch gap-1 sm:items-end", className)}
      data-testid="inventory-export-toolbar"
    >
      <div className="relative inline-flex">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer gap-1.5 transition-colors duration-200"
          disabled={blocked}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          data-testid="inventory-export-trigger"
          onClick={() => setOpen((v) => !v)}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          {busy ? "Exporting…" : "Export"}
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </Button>
        {open ? (
          <div
            id={menuId}
            role="menu"
            aria-label="Export format"
            className="absolute right-0 top-full z-40 mt-1 min-w-[10.5rem] rounded-md border border-border bg-card py-1 shadow-md"
            data-testid="inventory-export-menu"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-muted/80 focus-visible:bg-muted/80 focus-visible:outline-none"
              disabled={blocked}
              data-testid="inventory-export-xlsx"
              onClick={() => {
                setOpen(false);
                onExportExcel();
              }}
            >
              Export Excel
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-muted/80 focus-visible:bg-muted/80 focus-visible:outline-none"
              disabled={blocked}
              data-testid="inventory-export-csv"
              onClick={() => {
                setOpen(false);
                onExportCsv();
              }}
            >
              Export CSV
            </button>
          </div>
        ) : null}
      </div>
      {exportError ? (
        <p className="text-xs text-destructive" role="alert" data-testid="inventory-export-error">
          {exportError}
        </p>
      ) : null}
      {exportSuccess && !exportError ? (
        <p className="text-xs text-muted-foreground" role="status" data-testid="inventory-export-success">
          {exportSuccess}
        </p>
      ) : null}
    </div>
  );
}
