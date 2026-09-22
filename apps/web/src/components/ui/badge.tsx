import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-tight transition-all duration-150 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
        secondary: "border-border/60 bg-secondary/80 text-secondary-foreground",
        outline: "border-border/80 bg-background/60 text-foreground backdrop-blur-xs",
        success: "border-emerald-200/80 bg-emerald-50/90 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300",
        warning: "border-amber-200/80 bg-amber-50/90 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300",
        destructive: "border-destructive/25 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
