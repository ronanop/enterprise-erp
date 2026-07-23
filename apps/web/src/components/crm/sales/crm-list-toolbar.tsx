"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

/** Dense single-row toolbar for CRM list cards (title + actions + search). */
export function CrmListToolbar({
  title,
  count,
  actions,
  search,
}: {
  title: string;
  count?: number;
  actions?: ReactNode;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h2 className="truncate text-sm font-medium tracking-tight">{title}</h2>
        {typeof count === "number" ? (
          <Badge variant="secondary" className="shrink-0">
            {count} shown
          </Badge>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        {actions}
        {search ? (
          <Input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            aria-label={search.placeholder ?? `Search ${title}`}
            className="h-8 w-52 shrink-0 sm:w-56"
          />
        ) : null}
      </div>
    </div>
  );
}
