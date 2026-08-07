"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEssMe } from "@/context/ess-me-context";
import { env } from "@/utils/env";
import * as ui from "@/theme/classes";

function isAllowedDuringCompliance(pathname: string): boolean {
  return (
    pathname.startsWith("/compliance") ||
    pathname.startsWith("/profile/change-password")
  );
}

export function ComplianceGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, loading } = useEssMe();

  useEffect(() => {
    if (env.useMock || loading || !me) return;
    if (isAllowedDuringCompliance(pathname)) return;

    if (me.must_change_password) {
      router.replace("/profile/change-password");
      return;
    }
    if ((me.pending_policy_count ?? 0) > 0) {
      router.replace("/compliance");
    }
  }, [me, loading, pathname, router]);

  if (!env.useMock && !loading && me) {
    if (!isAllowedDuringCompliance(pathname)) {
      if (me.must_change_password || (me.pending_policy_count ?? 0) > 0) {
        return (
          <div className={`${ui.shell} flex min-h-dvh items-center justify-center`}>
            <div className={`${ui.card} px-6 py-5 text-sm font-medium ${ui.muted}`}>
              Checking compliance…
            </div>
          </div>
        );
      }
    }
  }

  return <>{children}</>;
}
