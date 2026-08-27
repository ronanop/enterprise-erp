import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function DrawerSectionCard({
  title,
  headingId,
  children,
  className,
  testId,
}: {
  title: string;
  headingId: string;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      aria-labelledby={headingId}
      data-testid={testId}
      className={cn(
        "@container rounded-xl border border-border/80 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <h3
        id={headingId}
        className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
      >
        {title}
      </h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function DrawerKvGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl
      data-testid="drawer-kv-grid"
      className={cn(
        "grid grid-cols-1 gap-x-8 gap-y-4 @min-[26rem]:grid-cols-2",
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function DrawerKvField({
  label,
  value,
  testId,
  mono,
  pre,
  span,
}: {
  label: string;
  value: ReactNode;
  testId?: string;
  mono?: boolean;
  pre?: boolean;
  span?: boolean;
}) {
  return (
    <div className={cn("min-w-0", span && "@min-[26rem]:col-span-2")}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        data-testid={testId}
        className={cn(
          "mt-1 text-sm font-medium break-words text-foreground",
          mono && "font-mono text-xs font-normal",
          pre && "whitespace-pre-wrap font-normal",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function DrawerEmptyLine({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground" role="status">
      {children}
    </p>
  );
}
