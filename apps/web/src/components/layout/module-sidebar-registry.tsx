import type { ReactNode } from "react";

import { HrSidebar } from "@/components/hr/hr-sidebar";

type ShellSidebarInput = {
  pathname: string;
  standalone: boolean;
  /** Focus modes that hide the left rail. */
  hideSidebar?: boolean;
};

/**
 * Standalone HRMS: every signed-in app route uses the HR sidebar.
 */
export function resolveShellSidebarKey({
  hideSidebar = false,
}: ShellSidebarInput): string | null {
  if (hideSidebar) return null;
  return "hr";
}

/** Left sidebar for the current route — always HRMS in this product. */
export function ShellSidebar(props: ShellSidebarInput) {
  const key = resolveShellSidebarKey(props);
  if (key === null) return null;
  return <HrSidebar />;
}
