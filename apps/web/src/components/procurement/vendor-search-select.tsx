"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VendorOption } from "@/services/procurement-service";
import {
  IN_STOCK_DISTRIBUTOR_LABEL,
  isInStockDistributor,
} from "@/utils/ovf-stock";

type MenuCoords = {
  top: number;
  left: number;
  width: number;
};

type VendorSearchSelectProps = {
  value: string;
  vendors: VendorOption[];
  onChange: (label: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Always offer IN STOCK as the first selectable option. */
  includeInStock?: boolean;
};

export function VendorSearchSelect({
  value,
  vendors,
  onChange,
  disabled = false,
  placeholder = "Select vendor…",
  className,
  includeInStock = false,
}: VendorSearchSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState<MenuCoords | null>(null);

  const options = useMemo(() => {
    const labels = vendors
      .map((row) => row.label.trim())
      .filter(Boolean)
      .filter((label) => !isInStockDistributor(label))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    const base = includeInStock ? [IN_STOCK_DISTRIBUTOR_LABEL, ...labels] : labels;
    const current = value.trim();
    if (
      current &&
      !base.some((label) => label.toLowerCase() === current.toLowerCase())
    ) {
      return [current, ...base];
    }
    return base;
  }, [vendors, value, includeInStock]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((label) => label.toLowerCase().includes(q));
  }, [options, search]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 220),
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  function openPicker() {
    if (disabled) return;
    updatePosition();
    setOpen(true);
    setSearch("");
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  function closePicker() {
    setOpen(false);
    setSearch("");
  }

  function selectOption(label: string) {
    onChange(label);
    closePicker();
  }

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onLayout = () => updatePosition();
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onDocumentMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closePicker();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closePicker();
    }
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDocumentMouseDown);
      window.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDocumentMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? closePicker() : openPicker())}
        className={cn(
          "flex h-8 w-full min-w-[160px] max-w-[240px] cursor-pointer items-center justify-between gap-1.5 rounded-md border border-border bg-background px-2 text-left text-xs transition-colors duration-200",
          "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "cursor-not-allowed opacity-70 hover:bg-background",
          !value.trim() && "text-muted-foreground",
          className,
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">{value.trim() || placeholder}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {mounted && open && coords
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="fixed z-[220] overflow-hidden rounded-lg border border-border/80 bg-card shadow-lg"
              style={{
                top: coords.top,
                left: coords.left,
                width: coords.width,
              }}
            >
              <div className="relative border-b border-border/60 p-2">
                <Search
                  className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search vendors…"
                  className="h-8 pl-8 text-xs"
                  aria-label="Search vendors"
                />
              </div>
              <ul className="max-h-56 overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <li className="px-2.5 py-3 text-center text-xs text-muted-foreground">
                    No vendors match
                  </li>
                ) : (
                  filtered.map((label) => {
                    const selected = label.toLowerCase() === value.trim().toLowerCase();
                    return (
                      <li key={label}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={cn(
                            "flex w-full cursor-pointer items-center rounded-md px-2.5 py-1.5 text-left text-xs transition-colors duration-150",
                            selected
                              ? "bg-sky-50 font-medium text-sky-950"
                              : "text-foreground hover:bg-muted/60",
                          )}
                          onClick={() => selectOption(label)}
                        >
                          <span className="truncate">{label}</span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
