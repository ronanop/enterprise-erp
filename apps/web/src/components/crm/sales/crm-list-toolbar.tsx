"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CRM_SECTION_TITLE, CrmCountBadge, CrmIconBadge } from "@/components/crm/crm-ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Dense single-row toolbar for CRM list cards (icon + title + actions + search). */
export function CrmListToolbar({
  title,
  count,
  icon,
  actions,
  search,
}: {
  title: string;
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
            <h2 className={cn(CRM_SECTION_TITLE, "truncate")}>{title}</h2>
            {typeof count === "number" ? <CrmCountBadge count={count} /> : null}
          </div>
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
