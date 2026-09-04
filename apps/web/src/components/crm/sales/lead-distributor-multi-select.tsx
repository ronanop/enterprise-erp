"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, X } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { Input } from "@/components/ui/input";
import { LEAD_DISTRIBUTOR_OPTIONS } from "@/lib/crm/lead-distributor-options";
import { cn } from "@/lib/utils";

type LeadDistributorMultiSelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
};

type MenuCoords = {
  top: number;
  left: number;
  width: number;
};

export function LeadDistributorMultiSelect({ value, onChange }: LeadDistributorMultiSelectProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const allOptions = useMemo(() => {
    const preset = new Set(LEAD_DISTRIBUTOR_OPTIONS);
    const extras = customOptions.filter((name) => !preset.has(name));
    const selectedCustom = value.filter((name) => !preset.has(name) && !extras.includes(name));
    return [...LEAD_DISTRIBUTOR_OPTIONS, ...extras, ...selectedCustom];
  }, [customOptions, value]);

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

  function toggleOption(option: string) {
    if (selectedSet.has(option)) {
      onChange(value.filter((name) => name !== option));
      return;
    }
    onChange([...value, option]);
  }

  function removeOption(option: string) {
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
    const canonical = allOptions.find((option) => option.toLowerCase() === name.toLowerCase()) ?? name;
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
            placeholder="Search distributor"
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
        <div className="border-t border-border/80 p-1">
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
      <div className="space-y-2">
        <div ref={triggerRef} className="relative">
          <button
            type="button"
            className="flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors hover:bg-muted/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => {
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
                className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/30 px-2 py-0.5 text-xs text-foreground"
              >
                {option}
                <button
                  type="button"
                  className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  aria-label={`Remove ${option}`}
                  onClick={() => removeOption(option)}
                >
                  <X className="size-3" aria-hidden />
                </button>
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
