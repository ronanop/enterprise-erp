"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  updateInventoryOrderLineDescription,
  type ProcurementInventoryRow,
} from "@/services/procurement-service";

export function InventoryDescriptionEditor({
  row,
  onSaved,
  onError,
}: {
  row: ProcurementInventoryRow;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const canEdit = Boolean(row.order_line_id) && row.source !== "grn_reversal";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => (row.description ?? "").trim());
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue((row.description ?? "").trim());
  }, [row.description]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function commit() {
    if (!canEdit || !row.order_line_id) {
      setEditing(false);
      return;
    }
    const next = value.trim();
    const prev = (row.description ?? "").trim();
    if (next === prev) {
      setEditing(false);
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await updateInventoryOrderLineDescription(row.order_line_id, next);
      setEditing(false);
      onSaved();
    } catch (err) {
      onError(formatApiError(err, "Failed to save description"));
      setValue(prev);
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <span className="line-clamp-2" title={row.description ?? ""}>
        {row.description?.trim() || "—"}
      </span>
    );
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={value}
        disabled={busy}
        maxLength={50}
        placeholder="Description"
        aria-label={`Description for ${row.product_name ?? "product"}`}
        className="h-8 text-xs"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setValue((row.description ?? "").trim());
            setEditing(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <span className="line-clamp-2 min-w-0 flex-1" title={row.description ?? ""}>
        {row.description?.trim() || "—"}
      </span>
      <button
        type="button"
        className={cn(
          "mt-0.5 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md",
          "text-muted-foreground transition-colors duration-200",
          "hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
        aria-label={`Edit description for ${row.product_name ?? "product"}`}
        title="Edit description"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}
