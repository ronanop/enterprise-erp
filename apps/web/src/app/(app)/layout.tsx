import type { ReactNode } from "react";

import { AuthSessionGuard } from "@/components/layout/auth-session-guard";
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthSessionGuard>
      <AppShell>{children}</AppShell>
    </AuthSessionGuard>
  );
}
