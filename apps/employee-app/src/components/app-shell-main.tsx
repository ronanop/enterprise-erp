"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";

/** Content padding adapts when the floating dock is hidden (compliance gate). */
export function AppShellMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideDock =
    pathname.startsWith("/compliance") ||
    pathname.startsWith("/profile/change-password");

  return (
    <>
      <div className={`flex-1 px-5 pt-0 ${hideDock ? "pb-8" : "pb-32"}`}>
        {children}
      </div>
      <BottomNav />
    </>
  );
}
