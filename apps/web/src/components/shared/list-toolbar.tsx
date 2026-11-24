"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CountBadge, IconBadge, SECTION_TITLE } from "@/components/shared/workspace-ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ListSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
};

export function ListSearch({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  className,
}: ListSearchProps) {
  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder ?? "Search"}
      className={cn(
        "h-8 w-full shrink-0 rounded-lg bg-background shadow-none transition-colors duration-200 sm:w-60",
        className,
      )}
    />
  );
}

/** Dense single-row toolbar above list tables (icon + title + filters + actions + search). */
export function ListToolbar({
  title,
  subtitle,
  count,
  countLabel,
  icon,
  actions,
  filters,
  search,
}: {
  title?: string;
  subtitle?: string;
  count?: number;
  countLabel?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  filters?: ReactNode;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
}) {
  const hasRight = Boolean(filters || actions || search);

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/70 px-3 py-2.5 sm:px-4">
      {title ? (
        <div className={cn("flex min-w-0 items-center gap-2.5", hasRight && "flex-1")}>
          {icon ? <IconBadge icon={icon} /> : null}
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className={cn(SECTION_TITLE, "truncate")}>{title}</h2>
              {typeof count === "number" ? (
                <CountBadge count={count} label={countLabel} />
              ) : null}
            </div>
            {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {hasRight ? (
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {filters}
          {actions}
          {search ? (
            <ListSearch
              value={search.value}
              onChange={search.onChange}
              placeholder={search.placeholder}
              aria-label={search.placeholder ?? (title ? `Search ${title}` : "Search")}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
