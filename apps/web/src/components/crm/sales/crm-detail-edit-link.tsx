import Link from "next/link";
import { Pencil } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  href: string;
  label?: string;
  className?: string;
};

export function CrmDetailEditLink({ href, label = "Edit", className }: Props) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors duration-200 hover:bg-muted/60",
        className,
      )}
    >
      <Pencil className="size-3.5" /> {label}
    </Link>
  );
}
