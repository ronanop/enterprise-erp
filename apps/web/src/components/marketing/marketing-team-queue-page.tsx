"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type MarketingTeamQueuePageProps = {
  memberId: string;
};

/** @deprecated Use `/marketing/team/role/[roleKey]` — legacy per-user team links redirect to Approvals. */
export function MarketingTeamQueuePage({ memberId: _memberId }: MarketingTeamQueuePageProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace("/marketing/approvals");
  }, [router]);

  return (
    <p className="text-sm text-muted-foreground">
      Redirecting to approvals…
    </p>
  );
}
