"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { procurementUi } from "@/components/procurement/procurement-ui";

export function DeliverySectionCard({
  title,
  icon: Icon,
  subtitle,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={procurementUi.sectionCard}>
      <div>
        <h2
          className={cn(
            "inline-flex items-center gap-2 text-sm font-medium tracking-tight text-foreground",
          )}
        >
          {Icon ? (
            <Icon className="size-3.5 shrink-0 text-[#0369A1]" aria-hidden />
          ) : null}
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
