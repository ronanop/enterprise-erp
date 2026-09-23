"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Subtle navy/sky wash used on Non-IT premium pages — reuse for IT parity. */
export function AssetsAtmosphere({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 -top-2 h-44 overflow-hidden rounded-xl",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(3,105,161,0.09),_transparent_55%),radial-gradient(ellipse_at_top_right,_rgba(15,23,42,0.04),_transparent_50%)]" />
    </div>
  );
}

/** Page wrapper that hosts atmosphere + relative content stack. */
export function AssetsPremiumPage({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={cn("relative space-y-5", className)} data-testid={testId}>
      <AssetsAtmosphere />
      <div className="relative space-y-5">{children}</div>
    </div>
  );
}

export const ASSETS_ACCENT_BTN =
  "cursor-pointer gap-2 bg-[#0369A1] text-white transition-colors duration-200 hover:bg-[#0369A1]/90";

export const ASSETS_SURFACE_CARD =
  "overflow-hidden border-border/70 bg-background/95 shadow-md";

export const ASSETS_ICON_CHIP =
  "flex size-9 shrink-0 items-center justify-center rounded-lg bg-[rgba(3,105,161,0.1)] text-[#0369A1]";
