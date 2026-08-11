"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";

import { ProcurementRouteWarmup } from "@/components/procurement/procurement-route-warmup";
import { ProcurementWorkspaceNav } from "@/components/procurement/procurement-workspace-nav";
import { useStandaloneChrome } from "@/hooks/use-standalone-chrome";

function ProcurementLayoutInner({ children }: { children: ReactNode }) {
  const standalone = useStandaloneChrome();

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1 gap-5 overflow-x-clip">
      <ProcurementRouteWarmup />
      {!standalone ? <ProcurementWorkspaceNav /> : null}
      <div className="min-w-0 max-w-full overflow-x-clip">{children}</div>
    </div>
  );
}

export default function ProcurementLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-w-0 max-w-full overflow-x-clip">{children}</div>}>
      <ProcurementLayoutInner>{children}</ProcurementLayoutInner>
    </Suspense>
  );
}
