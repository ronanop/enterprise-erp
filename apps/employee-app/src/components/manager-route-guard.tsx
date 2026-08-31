"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEssMe } from "@/context/ess-me-context";
import { EmptyState } from "@/components/ui";

export function ManagerRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { me, loading } = useEssMe();

  useEffect(() => {
    if (!loading && me && !me.can_approve_team_leave) {
      router.replace("/leave");
    }
  }, [loading, me, router]);

  if (loading) {
    return <EmptyState title="Loading…" />;
  }
  if (!me?.can_approve_team_leave) {
    return null;
  }
  return <>{children}</>;
}
