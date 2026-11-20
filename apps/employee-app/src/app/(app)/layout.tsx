import { AuthGuard } from "@/components/auth-guard";
import { AppShellClient } from "@/components/app-shell-client";
import { AppShellMain } from "@/components/app-shell-main";
import { DemoBanner } from "@/components/demo-banner";
import { OfflineBanner } from "@/components/offline-banner";
import * as ui from "@/theme/classes";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppShellClient>
        <div className={`${ui.shell} mx-auto flex max-w-lg flex-col`}>
          <DemoBanner />
          <OfflineBanner />
          <AppShellMain>{children}</AppShellMain>
        </div>
      </AppShellClient>
    </AuthGuard>
  );
}
