"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { ModulePaneSearch } from "@/components/layout/module-pane-search";
import { navigation } from "@/config/navigation";
import {
  homeModuleHits,
  resolveShellSearchScope,
} from "@/lib/shell-search";

/** Topbar search — HRMS panes (and a small home catalog). */
export function ShellGlobalSearch({ className }: { className?: string }) {
  const pathname = usePathname();
  const scope = resolveShellSearchScope(pathname);

  const homePanes = useMemo(() => {
    if (scope.mode !== "home") return [];
    return homeModuleHits(navigation.flatMap((group) => group.items));
  }, [scope.mode]);

  if (scope.mode === "panes") {
    return (
      <ModulePaneSearch
        className={className}
        placeholder={scope.placeholder}
        panes={scope.panes}
      />
    );
  }

  return (
    <ModulePaneSearch
      className={className}
      placeholder={scope.placeholder}
      panes={homePanes}
    />
  );
}
