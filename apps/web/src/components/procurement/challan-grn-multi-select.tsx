"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScmReceiptBatch } from "@/services/procurement-service";
import { formatGrnLinePreview, receiptBatchKey } from "@/utils/delivery-challan-grn";

type ChallanGrnMultiSelectProps = {
  batches: ScmReceiptBatch[];
  selectedKeys: string[];
  disabled?: boolean;
  onChange: (keys: string[]) => void;
};

function batchUnits(batch: ScmReceiptBatch): number {
  return (batch.lines || []).reduce((sum, ln) => sum + (Number(ln.quantity) || 0), 0);
}

export function ChallanGrnMultiSelect({
  batches,
  selectedKeys,
  disabled,
  onChange,
}: ChallanGrnMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const selectedSet = new Set(selectedKeys);
  const selectedBatches = batches.filter((b) => selectedSet.has(receiptBatchKey(b)));

  const triggerLabel =
    selectedBatches.length === 0
      ? "Select GRN number(s)"
      : selectedBatches.length === 1
        ? selectedBatches[0].grn_number
        : `${selectedBatches.length} GRN(s) selected`;

  function toggleKey(key: string) {
    const next = selectedSet.has(key)
      ? selectedKeys.filter((k) => k !== key)
      : [...selectedKeys, key];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div ref={rootRef} className="relative max-w-md">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="h-9 w-full cursor-pointer justify-between gap-2 px-3 font-normal transition-colors duration-200"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="min-w-0 truncate text-left text-sm">{triggerLabel}</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </Button>
        {open && !disabled ? (
          <ul
            role="listbox"
            aria-multiselectable="true"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-card p-1 shadow-md"
          >
            {batches.map((batch) => {
              const key = receiptBatchKey(batch);
              const checked = selectedSet.has(key);
              const units = batchUnits(batch);
              const preview = formatGrnLinePreview(batch);
              return (
                <li key={key} role="option" aria-selected={checked}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150",
                      checked ? "bg-primary/10" : "hover:bg-muted/60",
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggleKey(key);
                    }}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      tabIndex={-1}
                      className="mt-0.5 size-4 shrink-0 pointer-events-none accent-primary"
                      checked={checked}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-medium text-foreground">
                        {batch.grn_number}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {units > 0
                          ? `${units} unit${units === 1 ? "" : "s"} · ${preview}`
                          : preview}
                      </span>
                      {batch.receipt_at ? (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {String(batch.receipt_at).slice(0, 10)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      {selectedBatches.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedBatches.map((batch) => {
            const key = receiptBatchKey(batch);
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/30 px-2 py-0.5 font-mono text-xs text-foreground"
              >
                {batch.grn_number}
                <button
                  type="button"
                  disabled={disabled}
                  className="cursor-pointer rounded px-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  aria-label={`Remove ${batch.grn_number}`}
                  onClick={() => toggleKey(key)}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
