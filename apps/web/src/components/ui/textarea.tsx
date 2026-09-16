import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[4.5rem] w-full min-w-0 rounded-xl border border-input/80 bg-background/60 px-3 py-2 text-sm outline-none transition-all duration-150",
        "placeholder:text-muted-foreground/60 focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/15",
        "shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] backdrop-blur-xs disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
