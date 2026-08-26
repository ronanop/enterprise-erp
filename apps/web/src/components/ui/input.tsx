import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, onWheel, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors",
        "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        // Hide native spinner so scroll/stepper UI does not fight data entry.
        type === "number" &&
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className,
      )}
      {...props}
      onWheel={(event) => {
        // Number inputs change value on scroll by default — block that while typing.
        if (type === "number") {
          event.currentTarget.blur();
        }
        onWheel?.(event);
      }}
    />
  );
}

export { Input };
