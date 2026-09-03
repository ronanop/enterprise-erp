"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";

import { ServiceFieldEngineerLayoutGuard } from "@/components/service/service-field-engineer-layout-guard";
import { ServiceWorkspaceNav } from "@/components/service/service-workspace-nav";

function ServiceLayoutInner({ children }: { children: ReactNode }) {
  return (
    <ServiceFieldEngineerLayoutGuard>
      <div className="grid min-w-0 max-w-full grid-cols-1 gap-5 overflow-x-clip">
        <ServiceWorkspaceNav />
        <div className="min-w-0 max-w-full overflow-x-clip">{children}</div>
      </div>
    </ServiceFieldEngineerLayoutGuard>
  );
}

export default function ServiceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={<div className="min-w-0 max-w-full overflow-x-clip">{children}</div>}
    >
      <ServiceLayoutInner>{children}</ServiceLayoutInner>
    </Suspense>
  );
}
