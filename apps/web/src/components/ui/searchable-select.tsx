"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  /** Allow keeping a value that is not in the options list (legacy data). */
  allowCustomValue?: boolean;
};

/**
 * Click to open a dropdown, type to filter options, click (or Enter) to select.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  className,
  disabled,
  allowCustomValue = true,
}: SearchableSelectProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label || (allowCustomValue && value ? value : "") || placeholder;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const t = window.setTimeout(() => searchRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menu = menuRef.current;
    const menuHeight = menu?.offsetHeight || 280;
    const gap = 6;
    const pad = 8;

    let top = rect.bottom + gap;
    if (top + menuHeight > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - gap - menuHeight);
    }

    const width = Math.min(Math.max(rect.width, 200), window.innerWidth - pad * 2);
    let left = rect.left;
    left = Math.min(Math.max(pad, left), window.innerWidth - width - pad);
    setCoords({ top, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    const id = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(id);
  }, [open, updatePosition, filtered.length, query]);

  useEffect(() => {
    if (!open) return;

    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
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
  }, [open, updatePosition]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = filtered[highlight];
      if (hit) pick(hit.value);
      else if (allowCustomValue && query.trim()) pick(query.trim());
    }
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={displayLabel}
        className={cn(
          "flex h-8 w-full cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none transition-[border-color,box-shadow,background-color] duration-200",
          "hover:bg-muted/40",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          open && "border-ring ring-3 ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={cn("min-w-0 truncate", !value && "text-muted-foreground")}>
          {displayLabel}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
            open && "rotate-180",
          )}
        />
      </button>

      {mounted && open
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-label={placeholder}
              className="fixed z-[200] overflow-hidden rounded-xl border border-border/80 bg-card shadow-lg"
              style={{
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
                width: coords?.width ?? 220,
                visibility: coords ? "visible" : "hidden",
              }}
            >
              <div className="border-b border-border/60 p-1.5">
                <div className="flex h-8 items-center gap-1.5 rounded-lg border border-input bg-transparent px-2">
                  <Search className="size-3.5 shrink-0 text-muted-foreground" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    placeholder={searchPlaceholder}
                    className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onSearchKeyDown}
                  />
                </div>
              </div>
              <div className="erp-scroll max-h-52 overflow-y-auto overscroll-contain p-1.5">
                {filtered.length === 0 ? (
                  <p className="px-2.5 py-2 text-xs text-muted-foreground">No matches</p>
                ) : (
                  filtered.map((opt, i) => {
                    const active = opt.value === value;
                    const focused = i === highlight;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        title={opt.label}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150",
                          active
                            ? "bg-primary text-primary-foreground"
                            : focused
                              ? "bg-muted/80 text-foreground"
                              : "text-foreground hover:bg-muted/80",
                        )}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => pick(opt.value)}
                      >
                        <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                        {active ? <Check className="size-3.5 shrink-0" /> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
