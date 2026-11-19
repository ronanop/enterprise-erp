"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import {
  KYC_CONTACT_DESIGNATION_OPTIONS,
  KYC_CONTACT_DESIGNATION_OTHER,
  isKycContactDesignationPreset,
  kycContactDesignationPresetLabel,
} from "@/lib/crm/kyc-form-data";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type KycContactDesignationFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

type MenuCoords = {
  top: number;
  left: number;
  width: number;
};

export function KycContactDesignationField({ value, onChange }: KycContactDesignationFieldProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState<MenuCoords | null>(null);

  const selectedPreset = kycContactDesignationPresetLabel(value);
  const showOtherInput = selectedPreset === KYC_CONTACT_DESIGNATION_OTHER;
  const otherValue =
    showOtherInput && value !== KYC_CONTACT_DESIGNATION_OTHER && !isKycContactDesignationPreset(value)
      ? value
      : "";

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [...KYC_CONTACT_DESIGNATION_OPTIONS];
    return KYC_CONTACT_DESIGNATION_OPTIONS.filter((option) => option.toLowerCase().includes(q));
  }, [search]);

  const displayValue = open
    ? search
    : selectedPreset === KYC_CONTACT_DESIGNATION_OTHER
      ? KYC_CONTACT_DESIGNATION_OTHER
      : value;

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
    if (selectedPreset === KYC_CONTACT_DESIGNATION_OTHER) {
      setSearch("");
    } else {
      setSearch(value);
    }
  }

  function closePicker() {
    setOpen(false);
    setSearch("");
  }

  function pick(option: string) {
    if (option === KYC_CONTACT_DESIGNATION_OTHER) {
      onChange(
        value && !isKycContactDesignationPreset(value) ? value : KYC_CONTACT_DESIGNATION_OTHER,
      );
    } else {
      onChange(option);
    }
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
      <ul
        ref={menuRef}
        className="fixed z-[200] max-h-48 overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md"
        role="listbox"
        style={{
          top: coords.top,
          left: coords.left,
          width: coords.width,
          visibility: coords ? "visible" : "hidden",
        }}
      >
        {filteredOptions.length === 0 ? (
          <li className="px-3 py-2 text-xs text-muted-foreground">No matches</li>
        ) : (
          filteredOptions.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === selectedPreset}
                className={cn(
                  "w-full cursor-pointer px-3 py-1.5 text-left text-sm transition-colors duration-200 hover:bg-muted/80",
                  option === selectedPreset && "bg-muted/60 font-medium",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(option)}
              >
                {option}
              </button>
            </li>
          ))
        )}
      </ul>
    ) : null;

  return (
    <div className="min-w-[200px] space-y-1.5">
      <div ref={triggerRef} className="relative">
        <Input
          value={displayValue}
          placeholder="Search designation"
          className="cursor-pointer pr-8"
          onChange={(event) => {
            setSearch(event.target.value);
            if (!open) {
              updatePosition();
              setOpen(true);
            }
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            if (!open) openPicker();
          }}
          onFocus={() => {
            if (!open) openPicker();
          }}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-haspopup="listbox"
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground transition-opacity duration-200 hover:opacity-80"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) closePicker();
            else openPicker();
          }}
          aria-label="Toggle designation list"
          aria-expanded={open}
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
      </div>
      {mounted && menu ? createPortal(menu, document.body) : null}
      {showOtherInput ? (
        <Input
          value={otherValue}
          placeholder="Specify designation"
          onChange={(event) => {
            const next = event.target.value;
            onChange(next.trim() ? next : KYC_CONTACT_DESIGNATION_OTHER);
          }}
        />
      ) : null}
    </div>
  );
}
