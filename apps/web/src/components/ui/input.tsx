import * as React from "react";

import { cn } from "@/lib/utils";

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") {
        ref(node);
      } else {
        ref.current = node;
      }
    }
  };
}

function Input({ className, type, onWheel, ref, ...props }: React.ComponentProps<"input">) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input || type !== "number") return;

    const blockWheelChange = (event: WheelEvent) => {
      if (document.activeElement === input) {
        event.preventDefault();
      }
    };

    input.addEventListener("wheel", blockWheelChange, { passive: false });
    return () => input.removeEventListener("wheel", blockWheelChange);
  }, [type]);

  function handleWheel(event: React.WheelEvent<HTMLInputElement>) {
    if (type === "number" && document.activeElement === event.currentTarget) {
      event.preventDefault();
    }
    onWheel?.(event);
  }

  return (
    <input
      ref={mergeRefs(inputRef, ref)}
      type={type}
      data-slot="input"
      onWheel={type === "number" ? handleWheel : onWheel}
      className={cn(
        "flex h-8.5 w-full min-w-0 rounded-lg border border-input/80 bg-background/60 px-3 py-1.5 text-sm outline-none transition-all duration-150",
        "placeholder:text-muted-foreground/60 focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/15",
        "shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] backdrop-blur-xs disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
