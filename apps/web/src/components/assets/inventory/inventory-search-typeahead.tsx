"use client";

import { useEffect, useId, useRef, useState } from "react";

import { StatusBadge } from "@/components/assets/shared";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { assetRegisterService, type AssetsRow } from "@/services/assets-service";

export type InventorySearchSuggestion = {
  id: string;
  assetCode: string;
  assetName: string;
  serialNumber: string;
  make: string;
  model: string;
  operationalStatus: string;
  raw: AssetsRow;
};

export type InventorySearchTypeaheadProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onSelectSuggestion: (suggestion: InventorySearchSuggestion) => void;
  branchId?: string;
  /** IT site location id — scopes search to assets at that location. */
  locationId?: string;
  className?: string;
  /** When set, run one GET /assets per status and merge (API accepts a single status). */
  operationalStatuses?: readonly string[];
  emptyMessage?: string;
  placeholder?: string;
  searchAriaLabel?: string;
};

const DEBOUNCE_MS = 280;
const MIN_QUERY = 2;

function rowToSuggestion(row: AssetsRow): InventorySearchSuggestion | null {
  const id = String(row.id ?? "");
  if (!id) return null;
  return {
    id,
    assetCode: String(row.asset_code ?? row.document_number ?? "—"),
    assetName: String(row.asset_name ?? "—"),
    serialNumber: typeof row.serial_number === "string" && row.serial_number.trim() ? row.serial_number : "—",
    make: typeof row.make === "string" ? row.make : "",
    model: typeof row.model === "string" ? row.model : "",
    operationalStatus: String(row.operational_status ?? ""),
    raw: row,
  };
}

async function searchSuggestions(input: {
  q: string;
  branchId?: string;
  locationId?: string;
  operationalStatuses?: readonly string[];
}): Promise<InventorySearchSuggestion[]> {
  const base = {
    q: input.q,
    page: 1,
    page_size: 8,
    ...(input.branchId ? { branch_id: input.branchId } : {}),
    ...(input.locationId ? { location_id: input.locationId } : {}),
  };
  const statuses = input.operationalStatuses ?? [];
  const pages =
    statuses.length > 0
      ? await Promise.all(
          statuses.map((operational_status) =>
            assetRegisterService.search({ ...base, operational_status }),
          ),
        )
      : [await assetRegisterService.search(base)];
  const seen = new Set<string>();
  const next: InventorySearchSuggestion[] = [];
  for (const page of pages) {
    for (const row of page.items ?? []) {
      const suggestion = rowToSuggestion(row);
      if (!suggestion || seen.has(suggestion.id)) continue;
      seen.add(suggestion.id);
      next.push(suggestion);
    }
  }
  return next.slice(0, 8);
}

export function InventorySearchTypeahead({
  value,
  onValueChange,
  onSubmit,
  onSelectSuggestion,
  branchId,
  locationId,
  className,
  operationalStatuses,
  emptyMessage = "No matching assets",
  placeholder = "Asset tag, name, serial, make, model, employee…",
  searchAriaLabel = "Search assets",
}: InventorySearchTypeaheadProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InventorySearchSuggestion[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [active, setActive] = useState(false);
  const statusKey = (operationalStatuses ?? []).join(",");

  useEffect(() => {
    if (!active) return;
    const q = value.trim();
    if (q.length < MIN_QUERY) {
      setItems([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    const statuses = statusKey ? statusKey.split(",") : undefined;
    const handle = window.setTimeout(() => {
      const requestId = ++requestRef.current;
      setLoading(true);
      setOpen(true);
      void searchSuggestions({ q, branchId, locationId, operationalStatuses: statuses })
        .then((next) => {
          if (requestId !== requestRef.current) return;
          setItems(next);
          setHighlight(0);
        })
        .catch(() => {
          if (requestId !== requestRef.current) return;
          setItems([]);
        })
        .finally(() => {
          if (requestId !== requestRef.current) return;
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [value, branchId, locationId, active, statusKey]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function selectItem(item: InventorySearchSuggestion) {
    onValueChange(item.assetCode);
    onSelectSuggestion(item);
    setOpen(false);
  }

  const showList = open && value.trim().length >= MIN_QUERY;

  return (
    <div ref={rootRef} className={cn("relative min-w-0 flex-1", className)}>
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={showList && items[highlight] ? `${listId}-${items[highlight].id}` : undefined}
        value={value}
        onChange={(e) => {
          setActive(true);
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setActive(true);
          if (value.trim().length >= MIN_QUERY) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((i) => Math.max(i - 1, 0));
            return;
          }
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key === "Enter") {
            if (showList && items[highlight]) {
              e.preventDefault();
              selectItem(items[highlight]);
              return;
            }
            onSubmit();
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        aria-label={searchAriaLabel}
        data-testid="inventory-search-typeahead"
        className="h-9"
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching assets"
          className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border/80 bg-popover p-1 shadow-lg"
          data-testid="inventory-search-suggestions"
        >
          {loading && items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</li>
          ) : (
            items.map((item, index) => (
              <li key={item.id} role="none">
                <button
                  type="button"
                  id={`${listId}-${item.id}`}
                  role="option"
                  aria-selected={index === highlight}
                  className={cn(
                    "flex w-full cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors duration-200",
                    index === highlight ? "bg-muted" : "hover:bg-muted/70",
                  )}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => selectItem(item)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-foreground">{item.assetCode}</span>
                    {item.operationalStatus ? (
                      <StatusBadge kind="operational" status={item.operationalStatus} />
                    ) : null}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">{item.assetName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[item.serialNumber !== "—" ? `S/N ${item.serialNumber}` : null, item.make, item.model]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
