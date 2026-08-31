import { Suspense } from "react";

import { AssetDomainUsersPage } from "@/components/assets/asset-domain-users-page";

export default function AssetsUsersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AssetDomainUsersPage />
    </Suspense>
  );
}
