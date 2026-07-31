import type { ReactNode } from "react";

import { AssetsModuleSidebar } from "@/components/assets/assets-module-sidebar";

export default function AssetsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <AssetsModuleSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
