"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type FilterSelectOption = {
  value: string;
  label: string;
};

type FilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  /** Shown for empty value (e.g. "All") */
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Rounded filter dropdown (replaces native &lt;select&gt; popup styling).
 * Opens with a soft slide/fade; list scrolls with erp-scroll.
 */
export function FilterSelect({
  value,
  onChange,
  options,
  placeholder = "All",
  className,
  disabled,
}: FilterSelectProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    minWidth: number;
    maxWidth: number;
  } | null>(null);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label || placeholder;

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menu = menuRef.current;
    const menuHeight = menu?.offsetHeight || 220;
    const gap = 6;
    const pad = 8;

    let top = rect.bottom + gap;
    if (top + menuHeight > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - gap - menuHeight);
    }

    const maxWidth = Math.min(384, window.innerWidth - pad * 2);
    const minWidth = Math.min(Math.max(rect.width, 180), maxWidth);
    // Grow to fit longest label (scrollWidth), never narrower than the trigger.
    const contentWidth = menu ? Math.ceil(menu.scrollWidth) : minWidth;
    const width = Math.min(Math.max(minWidth, contentWidth), maxWidth);

    let left = rect.left;
    left = Math.min(Math.max(pad, left), window.innerWidth - width - pad);
    setCoords({ top, left, minWidth: width, maxWidth });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    const id = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(id);
  }, [open, updatePosition, options.length]);

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

  return (
    <div className={cn("relative min-w-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={label}
        className={cn(
          "flex h-8 w-full cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none transition-[border-color,box-shadow,background-color] duration-200",
          "hover:bg-muted/40",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          open && "border-ring ring-3 ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>{label}</span>
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
                minWidth: coords?.minWidth ?? 180,
                maxWidth: coords?.maxWidth ?? 384,
                width: "max-content",
                visibility: coords ? "visible" : "hidden",
              }}
            >
              <div className="erp-scroll max-h-56 overflow-y-auto overscroll-contain p-1.5">
                {options.map((opt) => {
                  const active = opt.value === value;
                  return (
                    <button
                      key={opt.value || "__all__"}
                      type="button"
                      role="option"
                      aria-selected={active}
                      title={opt.label}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted/80",
                      )}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      <span className="whitespace-nowrap">{opt.label}</span>
                      {active ? <Check className="size-3.5 shrink-0 opacity-90" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
