"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";

import { MarketingWorkspaceNav } from "@/components/marketing/marketing-workspace-nav";
import { useStandaloneChrome } from "@/hooks/use-standalone-chrome";

function MarketingLayoutInner({ children }: { children: ReactNode }) {
  const standalone = useStandaloneChrome();

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1 gap-5 overflow-x-clip">
      {/* Horizontal strip only when Marketing shares the main module sidebar. */}
      {!standalone ? <MarketingWorkspaceNav /> : null}
      <div className="min-w-0 max-w-full overflow-x-clip">{children}</div>
    </div>
  );
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-w-0 max-w-full overflow-x-clip">{children}</div>}>
      <MarketingLayoutInner>{children}</MarketingLayoutInner>
    </Suspense>
  );
}
