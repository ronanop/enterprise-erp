"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HrUnderlineTabs, type HrTabItem } from "@/components/hr/hr-primitives";
import { cn } from "@/lib/utils";

export function EmsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted/60" />
        ))}
      </div>
      <div className="h-10 rounded-lg bg-muted/60" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-muted/40" />
      ))}
    </div>
  );
}

export function EmsAvatar({
  name,
  photoUrl,
  size = "md",
  shape = "circle",
}: {
  name: string;
  photoUrl?: string;
  size?: "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "rounded";
}) {
  const dim =
    size === "xl"
      ? "size-36 text-2xl"
      : size === "lg"
        ? "size-16 text-lg"
        : size === "sm"
          ? "size-8 text-xs"
          : "size-10 text-sm";
  const radius = shape === "rounded" ? "rounded-xl" : "rounded-full";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt="" className={cn("shrink-0 object-cover", radius, dim)} />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-primary font-semibold text-primary-foreground",
        radius,
        dim,
      )}
    >
      {initials || <User className="size-4" />}
    </div>
  );
}

export function EmsPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
      <span>
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="cursor-pointer"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-[4rem] text-center">
          Page {page} / {pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="cursor-pointer"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function EmsFormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function EmsStepper({
  steps,
  current,
}: {
  steps: { id: string; label: string }[];
  current: number;
}) {
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step.id}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[11px] font-medium tracking-wide uppercase transition-colors",
              active
                ? "border-foreground bg-primary text-primary-foreground"
                : done
                  ? "border-transparent bg-hrms-mint text-hrms-success"
                  : "border-border bg-muted/30 text-muted-foreground",
            )}
          >
            {index + 1}. {step.label}
          </li>
        );
      })}
    </ol>
  );
}

export function EmsTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: HrTabItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <HrUnderlineTabs
      embedded
      size="sm"
      tabs={tabs}
      value={active}
      onChange={onChange}
      className="border-b border-border/70"
    />
  );
}

export function EmsTimeline({ items }: { items: { title: string; detail?: string; at: string; actor?: string }[] }) {
  if (!items.length) {
    return <p className="text-xs text-muted-foreground">No activity recorded yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="relative border-l-2 border-border/80 pl-4 pb-1">
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          {item.detail ? <p className="text-xs text-muted-foreground">{item.detail}</p> : null}
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {item.actor ? `${item.actor} · ` : ""}
            {new Date(item.at).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
