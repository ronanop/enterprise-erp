"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { erpModules } from "@/config/modules";
import { moduleTitle } from "@/lib/module-access";
import { cn } from "@/lib/utils";

/** Sentinel value for Organization → Users “All modules” entitlement. */
export const ALL_MODULES_KEY = "*";

/** Platform / shell modules — not offered in Organization → Users assign picker. */
export const NON_ASSIGNABLE_MODULE_KEYS = new Set([
  "foundation",
  "email",
  "voice-agent",
  "organization",
  "master-data",
  // Parent Assets — assign IT Assets / Non-IT Assets submodules instead.
  "assets",
]);

type ModuleOption = {
  value: string;
  label: string;
  description: string;
};

type Props = {
  id?: string;
  value: string[];
  onChange: (moduleKeys: string[]) => void;
  disabled?: boolean;
  className?: string;
};

type MenuCoords = {
  top: number;
  left: number;
  width: number;
};

/** Multi-select module picker — CRM popover style (search + checkbox rows). */
export function ModuleAssignSelect({ id: _id, value, onChange, disabled, className }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState<MenuCoords | null>(null);

  const options = useMemo<ModuleOption[]>(
    () => [
      {
        value: ALL_MODULES_KEY,
        label: "All modules",
        description:
          "Full module-admin access across every ERP module (not the same as ERP admin).",
      },
      ...erpModules
        .filter((m) => !NON_ASSIGNABLE_MODULE_KEYS.has(m.key))
        .map((m) => ({
          value: m.key,
          label: m.title,
          description: m.description,
        })),
    ],
    [],
  );

  const selectedSet = useMemo(() => new Set(value), [value]);
  const optionByKey = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q),
    );
  }, [options, search]);

  const triggerLabel = useMemo(() => {
    if (value.length === 0) return "Select module…";
    if (value.includes(ALL_MODULES_KEY)) return "All modules";
    if (value.length === 1) {
      return optionByKey.get(value[0])?.label ?? moduleTitle(value[0]);
    }
    return `${value.length} modules selected`;
  }, [optionByKey, value]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 280),
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
  }

  function closePicker() {
    setOpen(false);
    setSearch("");
  }

  function toggleOption(key: string) {
    if (key === ALL_MODULES_KEY) {
      onChange(selectedSet.has(ALL_MODULES_KEY) ? [] : [ALL_MODULES_KEY]);
      return;
    }
    const withoutAll = value.filter((k) => k !== ALL_MODULES_KEY);
    if (selectedSet.has(key)) {
      onChange(withoutAll.filter((k) => k !== key));
      return;
    }
    onChange([...withoutAll, key]);
  }

  function removeOption(key: string) {
    onChange(value.filter((k) => k !== key));
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
        className="fixed z-[200] overflow-hidden rounded-lg border border-border/80 bg-popover shadow-md"
        style={{
          top: coords.top,
          left: coords.left,
          width: coords.width,
        }}
      >
        <div className="border-b border-border/80 p-2">
          <Input
            value={search}
            placeholder="Search modules…"
            className="h-8"
            onChange={(event) => setSearch(event.target.value)}
            onMouseDown={(event) => event.stopPropagation()}
            autoFocus
          />
        </div>
        <ul role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">No matches</li>
          ) : (
            filtered.map((option) => {
              const checked = selectedSet.has(option.value);
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-2.5 px-3 py-2 text-left text-sm outline-none transition-colors duration-150 hover:bg-muted/60",
                      checked && "bg-muted/40",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => toggleOption(option.value)}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors duration-150",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background",
                      )}
                      aria-hidden
                    >
                      {checked ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate", checked && "font-medium")}>
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground line-clamp-2">
                        {option.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    ) : null;

  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <div className="relative min-w-0">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-multiselectable="true"
          title={triggerLabel}
          className={cn(
            "flex h-8.5 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-input/80 bg-background/60 px-3 text-left text-sm outline-none transition-all duration-150",
            "hover:bg-muted/20",
            "focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/15",
            "shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] backdrop-blur-xs",
            open && "border-ring ring-3 ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          onClick={() => {
            if (open) closePicker();
            else openPicker();
          }}
        >
          <span
            className={cn("min-w-0 truncate", value.length === 0 && "text-muted-foreground")}
          >
            {triggerLabel}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </div>
      {mounted && menu ? createPortal(menu, document.body) : null}
      {value.length > 0 && !value.includes(ALL_MODULES_KEY) ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((key) => {
            const label = optionByKey.get(key)?.label ?? moduleTitle(key);
            return (
              <span
                key={key}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/80 bg-muted/30 px-2 py-0.5 text-xs text-foreground"
              >
                <span className="truncate">{label}</span>
                <button
                  type="button"
                  className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  aria-label={`Remove ${label}`}
                  disabled={disabled}
                  onClick={() => removeOption(key)}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
