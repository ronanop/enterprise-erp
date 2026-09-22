"use client";

import { EssMeProvider } from "@/context/ess-me-context";
import { NotificationCenterProvider } from "@/context/notification-center-context";
import { ComplianceGuard } from "@/components/compliance-guard";

export function AppShellClient({ children }: { children: React.ReactNode }) {
  return (
    <EssMeProvider>
      <NotificationCenterProvider>
        <ComplianceGuard>{children}</ComplianceGuard>
      </NotificationCenterProvider>
    </EssMeProvider>
  );
}
