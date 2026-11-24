"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, X } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { Input } from "@/components/ui/input";
import { loadCrmDistributorOptions } from "@/lib/crm/lead-distributor-options";
import { cn } from "@/lib/utils";

type LeadDistributorMultiSelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
  /** When set, replaces the built-in preset list (e.g. lead + row options). */
  options?: readonly string[];
  disabled?: boolean;
  /** Denser trigger for table cells. */
  compact?: boolean;
  "aria-label"?: string;
};

type MenuCoords = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const VIEWPORT_PAD = 8;
const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 280;

export function LeadDistributorMultiSelect({
  value,
  onChange,
  options,
  disabled = false,
  compact = false,
  "aria-label": ariaLabel = "Distributor name",
}: LeadDistributorMultiSelectProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [scmOptions, setScmOptions] = useState<string[]>(["IN STOCK"]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    if (options && options.length > 0) return;
    let cancelled = false;
    void loadCrmDistributorOptions(value.join(", ")).then((rows) => {
      if (!cancelled) setScmOptions(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [options, value]);

  const baseOptions = useMemo(() => {
    if (options && options.length > 0) {
      return Array.from(new Set(options.map((name) => name.trim()).filter(Boolean)));
    }
    return scmOptions;
  }, [options, scmOptions]);

  const allOptions = useMemo(() => {
    const preset = new Set(baseOptions.map((name) => name.toLowerCase()));
    const extras = customOptions.filter((name) => !preset.has(name.toLowerCase()));
    const selectedCustom = value.filter(
      (name) =>
        !preset.has(name.toLowerCase()) &&
        !extras.some((entry) => entry.toLowerCase() === name.toLowerCase()),
    );
    return [...baseOptions, ...extras, ...selectedCustom];
  }, [baseOptions, customOptions, value]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((option) => option.toLowerCase().includes(q));
  }, [allOptions, search]);

  const triggerLabel =
    value.length === 0
      ? "Select distributor(s)"
      : value.length === 1
        ? value[0]
        : `${value.length} distributors selected`;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const minWidth = compact ? 220 : rect.width;
    const width = Math.min(Math.max(rect.width, minWidth), vw - VIEWPORT_PAD * 2);

    let left = rect.left;
    if (left + width > vw - VIEWPORT_PAD) {
      left = Math.max(VIEWPORT_PAD, vw - VIEWPORT_PAD - width);
    }
    if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;

    const spaceBelow = vh - rect.bottom - MENU_GAP - VIEWPORT_PAD;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_PAD;
    const placeAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
    const available = Math.max(120, placeAbove ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(MENU_MAX_HEIGHT, available);
    const top = placeAbove
      ? Math.max(VIEWPORT_PAD, rect.top - MENU_GAP - maxHeight)
      : rect.bottom + MENU_GAP;

    setCoords({ top, left, width, maxHeight });
  }, [compact]);

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

  function toggleOption(option: string) {
    if (disabled) return;
    if (selectedSet.has(option)) {
      onChange(value.filter((name) => name !== option));
      return;
    }
    onChange([...value, option]);
  }

  function removeOption(option: string) {
    if (disabled) return;
    onChange(value.filter((name) => name !== option));
  }

  function openNewDistributorDialog() {
    closePicker();
    setDraftName(search.trim());
    setDialogError(null);
    setDialogOpen(true);
  }

  function closeNewDistributorDialog() {
    setDialogOpen(false);
    setDraftName("");
    setDialogError(null);
  }

  function saveNewDistributor() {
    const name = draftName.trim();
    if (!name) {
      setDialogError("Distributor name is required.");
      return;
    }
    const exists = allOptions.some((option) => option.toLowerCase() === name.toLowerCase());
    if (!exists) {
      setCustomOptions((rows) => [...rows, name]);
    }
    const canonical =
      allOptions.find((option) => option.toLowerCase() === name.toLowerCase()) ?? name;
    if (!selectedSet.has(canonical)) {
      onChange([...value, canonical]);
    }
    closeNewDistributorDialog();
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
        className="fixed z-[200] flex flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-md"
        style={{
          top: coords.top,
          left: coords.left,
          width: coords.width,
          maxHeight: coords.maxHeight,
        }}
      >
        <div className="shrink-0 border-b border-border/80 p-2">
          <Input
            value={search}
            placeholder="Search distributor"
            className="h-8"
            onChange={(event) => setSearch(event.target.value)}
            onMouseDown={(event) => event.stopPropagation()}
          />
        </div>
        <ul role="listbox" aria-multiselectable="true" className="min-h-0 flex-1 overflow-y-auto py-1">
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">No matches</li>
          ) : (
            filteredOptions.map((option) => {
              const checked = selectedSet.has(option);
              return (
                <li key={option}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-200 hover:bg-muted/80",
                      checked && "bg-muted/60 font-medium",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => toggleOption(option)}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      tabIndex={-1}
                      className="size-4 shrink-0 pointer-events-none accent-primary"
                      checked={checked}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 break-words">{option}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="shrink-0 border-t border-border/80 p-1">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-primary transition-colors duration-200 hover:bg-muted/80"
            onMouseDown={(event) => event.preventDefault()}
            onClick={openNewDistributorDialog}
          >
            <Plus className="size-4 shrink-0" aria-hidden />
            New distributor
          </button>
        </div>
      </div>
    ) : null;

  return (
    <>
      <div className={cn("space-y-2", compact && "space-y-1.5")}>
        <div ref={triggerRef} className="relative">
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
              "flex w-full cursor-pointer items-center justify-between gap-2 border bg-white px-2.5 shadow-none outline-none transition-colors duration-200",
              "focus-visible:border-sky-400 focus-visible:ring-1 focus-visible:ring-sky-300",
              compact
                ? "h-9 rounded-[4px] border-[#cfd7e3] text-[13px]"
                : "h-8 rounded-lg border-input text-sm hover:bg-muted/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              disabled && "cursor-default bg-[#f8fafc] opacity-70",
              value.length === 0 && "text-muted-foreground",
            )}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => {
              if (disabled) return;
              if (open) closePicker();
              else openPicker();
            }}
          >
            <span className={cn("min-w-0 truncate text-left", value.length === 0 && "text-muted-foreground")}>
              {triggerLabel}
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </div>
        {mounted && menu ? createPortal(menu, document.body) : null}
        {value.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {value.map((option) => (
              <span
                key={option}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/80 bg-muted/30 px-2 py-0.5 text-xs text-foreground"
              >
                <span className="min-w-0 truncate">{option}</span>
                {!disabled ? (
                  <button
                    type="button"
                    className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                    aria-label={`Remove ${option}`}
                    onClick={() => removeOption(option)}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={dialogOpen}
        title="New Distributor"
        description="Add a distributor name that is not in the preset list."
        confirmLabel="Add Distributor"
        cancelLabel="Cancel"
        onConfirm={saveNewDistributor}
        onCancel={closeNewDistributorDialog}
      >
        <div className="mt-3 space-y-3">
          {dialogError ? (
            <p className="text-xs text-destructive" role="alert">
              {dialogError}
            </p>
          ) : null}
          <FinanceField label="Distributor Name *">
            <Input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Distributor name"
              autoFocus
            />
          </FinanceField>
        </div>
      </ConfirmDialog>
    </>
  );
}
