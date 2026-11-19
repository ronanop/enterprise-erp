"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import * as ui from "@/theme/classes";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className={`${ui.shell} flex min-h-dvh items-center justify-center`}>
        <div className={`${ui.card} px-6 py-5 text-sm font-medium ${ui.muted}`}>
          Checking session…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
