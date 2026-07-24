"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CrmCountBadge, CrmIconBadge } from "@/components/crm/crm-ui";
import { Input } from "@/components/ui/input";

/** Dense single-row toolbar for CRM list cards (icon + title + actions + search). */
export function CrmListToolbar({
  title,
  subtitle,
  count,
  icon,
  actions,
  search,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  icon?: LucideIcon;
  actions?: ReactNode;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {icon ? <CrmIconBadge icon={icon} /> : null}
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-medium tracking-tight">{title}</h2>
            {typeof count === "number" ? <CrmCountBadge count={count} /> : null}
          </div>
          {subtitle ? <p className="text-[11px] text-muted-foreground">{subtitle}</p> : null}
        </div>
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
