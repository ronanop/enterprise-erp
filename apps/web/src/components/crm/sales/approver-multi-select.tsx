"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ApproverOption = { id: string; label: string };

type MenuCoords = {
  top: number;
  left: number;
  width: number;
};

/** Multi-select approver control that opens like a dropdown. */
export function ApproverMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select approver(s)",
}: {
  options: ApproverOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState<MenuCoords | null>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const labelById = useMemo(
    () => new Map(options.map((option) => [option.id, option.label])),
    [options],
  );

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, search]);

  const triggerLabel =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (labelById.get(value[0]) ?? "1 approver selected")
        : `${value.length} approvers selected`;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  function openPicker() {
    updatePosition();
    setOpen(true);
    setSearch("");
  }

  function closePicker() {
    setOpen(false);
    setSearch("");
  }

  function toggleOption(id: string) {
    if (selectedSet.has(id)) {
      onChange(value.filter((item) => item !== id));
      return;
    }
    onChange([...value, id]);
  }

  function removeOption(id: string) {
    onChange(value.filter((item) => item !== id));
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
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDocumentMouseDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDocumentMouseDown);
    };
  }, [open]);

  const menu =
    mounted && open && coords ? (
      <div
        ref={menuRef}
        className="fixed z-[200] overflow-hidden rounded-lg border border-border bg-popover shadow-md"
        style={{
          top: coords.top,
          left: coords.left,
          width: coords.width,
        }}
      >
        <div className="border-b border-border/80 p-2">
          <Input
            value={search}
            placeholder="Search approver"
            className="h-8"
            onChange={(event) => setSearch(event.target.value)}
            onMouseDown={(event) => event.stopPropagation()}
          />
        </div>
        <ul role="listbox" aria-multiselectable="true" className="max-h-56 overflow-y-auto py-1">
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">No matches</li>
          ) : (
            filteredOptions.map((option) => {
              const checked = selectedSet.has(option.id);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-muted/60",
                      checked && "bg-muted/40",
                    )}
                    onClick={() => toggleOption(option.id)}
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 cursor-pointer accent-primary"
                      checked={checked}
                      readOnly
                      tabIndex={-1}
                    />
                    <span className="min-w-0 truncate">{option.label}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    ) : null;

  return (
    <div className="space-y-1.5">
      <div
        ref={triggerRef}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={0}
        className="flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => (open ? closePicker() : openPicker())}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) closePicker();
            else openPicker();
          }
          if (event.key === "Escape" && open) {
            event.preventDefault();
            closePicker();
          }
        }}
      >
        <span className={cn("min-w-0 truncate", value.length === 0 && "text-muted-foreground")}>
          {triggerLabel}
        </span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground", open && "rotate-180")} />
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => (
            <span
              key={id}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-1.5 py-0.5 text-[11px] text-foreground"
            >
              <span className="min-w-0 truncate">{labelById.get(id) ?? id}</span>
              <button
                type="button"
                className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={`Remove ${labelById.get(id) ?? "approver"}`}
                onClick={(event) => {
                  event.stopPropagation();
                  removeOption(id);
                }}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {mounted ? createPortal(menu, document.body) : null}
    </div>
  );
}
