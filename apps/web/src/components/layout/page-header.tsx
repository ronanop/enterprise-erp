import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Optional back navigation shown above the title. */
  backHref?: string;
  backLabel?: string;
  /** When set, renders a back button instead of a link (e.g. close overlay on same page). */
  onBack?: () => void;
  className?: string;
  titleClassName?: string;
  /** Center the title in the header row. */
  centerTitle?: boolean;
}

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
  onBack,
  className,
  titleClassName,
  centerTitle = false,
}: PageHeaderProps) {
  const backControl =
    onBack && backLabel ? (
      <button
        type="button"
        onClick={onBack}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-8 w-fit cursor-pointer gap-1.5 transition-colors duration-200",
        )}
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to {backLabel}
      </button>
    ) : backHref && backLabel ? (
      <Link
        href={backHref}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-8 w-fit cursor-pointer gap-1.5 transition-colors duration-200",
        )}
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to {backLabel}
      </Link>
    ) : null;

  const titleBlock = (
    <div className={cn("space-y-1.5", centerTitle && "text-center")}>
      <h1
        className={cn(
          "text-[1.65rem] font-medium tracking-tight text-foreground",
          titleClassName,
        )}
      >
        {title}
      </h1>
      {description ? (
        <p
          className={cn(
            "max-w-2xl text-sm leading-relaxed text-muted-foreground",
            centerTitle && "mx-auto",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );

  if (centerTitle) {
    return (
      <div className={cn("space-y-4 border-b border-border/60 pb-5", className)}>
        <div className="relative flex min-h-10 items-start justify-between gap-3">
          <div className="z-10 flex min-w-0 shrink-0 justify-start">{backControl}</div>
          <div className="pointer-events-none absolute inset-x-0 top-0 hidden justify-center sm:flex">
            <div className="pointer-events-auto max-w-[min(100%,36rem)] px-4">{titleBlock}</div>
          </div>
          <div className="z-10 flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        </div>
        <div className="sm:hidden">{titleBlock}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {backControl}
        {titleBlock}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
