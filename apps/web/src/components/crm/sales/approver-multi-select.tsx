"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ApproverOption = { id: string; label: string; name?: string; email?: string };

type MenuCoords = {
  top: number;
  left: number;
  width: number;
};

function parseApproverLabel(label: string): { name: string; email: string | null } {
  const match = label.trim().match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: label.trim(), email: null };
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function optionParts(option: ApproverOption): { name: string; email: string | null } {
  if (option.name?.trim()) {
    return { name: option.name.trim(), email: option.email?.trim() || null };
  }
  return parseApproverLabel(option.label);
}

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
  const searchRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState<MenuCoords | null>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const optionById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => {
      const { name, email } = optionParts(option);
      return (
        name.toLowerCase().includes(q) ||
        (email?.toLowerCase().includes(q) ?? false) ||
        option.label.toLowerCase().includes(q)
      );
    });
  }, [options, search]);

  const triggerLabel =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? optionParts(optionById.get(value[0]) ?? { id: value[0], label: "1 approver selected" }).name
        : `${value.length} approvers selected`;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 320),
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  function openPicker() {
    updatePosition();
    setOpen(true);
    setSearch("");
    window.setTimeout(() => searchRef.current?.focus(), 0);
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
        className="fixed z-200 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg shadow-slate-900/10"
        style={{
          top: coords.top,
          left: coords.left,
          width: coords.width,
        }}
      >
        <div className="border-b border-slate-100 bg-slate-50/80 p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              ref={searchRef}
              value={search}
              placeholder="Search by name or email"
              className="h-9 border-slate-200 bg-white pl-8 text-[13px] shadow-none"
              onChange={(event) => setSearch(event.target.value)}
              onMouseDown={(event) => event.stopPropagation()}
            />
          </div>
        </div>
        <ul role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto p-1.5">
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-slate-500">No matching approvers</li>
          ) : (
            filteredOptions.map((option) => {
              const checked = selectedSet.has(option.id);
              const { name, email } = optionParts(option);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150",
                      "hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none",
                      checked && "bg-sky-50/80 hover:bg-sky-50",
                    )}
                    onClick={() => toggleOption(option.id)}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border transition-colors duration-150",
                        checked
                          ? "border-sky-600 bg-sky-600 text-white"
                          : "border-slate-300 bg-white text-transparent",
                      )}
                      aria-hidden
                    >
                      <Check className="size-2.5 stroke-3" />
                    </span>
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide",
                        checked ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600",
                      )}
                      aria-hidden
                    >
                      {initialsFromName(name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-900">{name}</span>
                      {email ? (
                        <span className="mt-0.5 block truncate text-[11px] text-slate-500">{email}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        {value.length > 0 ? (
          <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500">
            {value.length} selected
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="space-y-2">
      <div
        ref={triggerRef}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={0}
        className={cn(
          "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-white px-3 text-sm outline-none transition-all duration-200",
          open
            ? "border-sky-400 ring-2 ring-sky-200/80"
            : "border-slate-200 hover:border-slate-300 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-200/80",
        )}
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
        <span className={cn("min-w-0 truncate", value.length === 0 ? "text-slate-400" : "text-slate-800")}>
          {triggerLabel}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180 text-slate-600",
          )}
        />
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const option = optionById.get(id);
            const { name, email } = option
              ? optionParts(option)
              : { name: id, email: null as string | null };
            return (
              <span
                key={id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 py-1 pr-1 pl-1.5 text-[12px] text-sky-950"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[9px] font-semibold text-sky-800">
                  {initialsFromName(name)}
                </span>
                <span className="min-w-0 truncate font-medium" title={email ?? name}>
                  {name}
                </span>
                <button
                  type="button"
                  className="cursor-pointer rounded-full p-0.5 text-sky-700/70 transition-colors duration-150 hover:bg-sky-100 hover:text-sky-950"
                  aria-label={`Remove ${name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeOption(id);
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      {mounted ? createPortal(menu, document.body) : null}
    </div>
  );
}
