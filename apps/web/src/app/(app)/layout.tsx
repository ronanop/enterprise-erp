import type { ReactNode } from "react";
import { Suspense } from "react";

import { AuthSessionGuard } from "@/components/layout/auth-session-guard";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGate } from "@/components/layout/auth-gate";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthGate>
        <AuthSessionGuard>
          <AppShell>{children}</AppShell>
        </AuthSessionGuard>
      </AuthGate>
    </Suspense>
  );
}
