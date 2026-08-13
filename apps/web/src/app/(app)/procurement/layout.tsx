"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";

import { ProcurementRouteWarmup } from "@/components/procurement/procurement-route-warmup";

function ProcurementLayoutInner({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 max-w-full grid-cols-1 gap-5 overflow-x-clip">
      <ProcurementRouteWarmup />
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
