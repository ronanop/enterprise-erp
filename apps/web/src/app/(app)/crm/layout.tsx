"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";

import { CrmWorkspaceNav } from "@/components/crm/crm-workspace-nav";
import { useStandaloneChrome } from "@/hooks/use-standalone-chrome";

function CrmLayoutInner({ children }: { children: ReactNode }) {
  const standalone = useStandaloneChrome();

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1 gap-4 overflow-x-clip">
      {/* Horizontal strip only when CRM shares the main module sidebar. */}
      {!standalone ? <CrmWorkspaceNav /> : null}
      <div className="min-w-0 max-w-full overflow-x-clip">{children}</div>
    </div>
  );
}

export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-w-0 max-w-full overflow-x-clip">{children}</div>}>
      <CrmLayoutInner>{children}</CrmLayoutInner>
    </Suspense>
  );
}
