import { AuthGuard } from "@/components/auth-guard";
import { AppShellClient } from "@/components/app-shell-client";
import { BottomNav } from "@/components/bottom-nav";
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
          <div className="flex-1 px-5 pb-28 pt-0">{children}</div>
          <BottomNav />
        </div>
      </AppShellClient>
    </AuthGuard>
  );
}
