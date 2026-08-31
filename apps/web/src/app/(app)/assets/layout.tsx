"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";

import { AssetsWorkspaceNav } from "@/components/assets/assets-workspace-nav";
import { useStandaloneChrome } from "@/hooks/use-standalone-chrome";

function AssetsLayoutInner({ children }: { children: ReactNode }) {
  const standalone = useStandaloneChrome();

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1 gap-5 overflow-x-clip">
      {!standalone ? <AssetsWorkspaceNav /> : null}
      <div className="min-w-0 max-w-full overflow-x-clip">{children}</div>
    </div>
  );
}

export default function AssetsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-w-0 max-w-full overflow-x-clip">{children}</div>}>
      <AssetsLayoutInner>{children}</AssetsLayoutInner>
    </Suspense>
  );
}
