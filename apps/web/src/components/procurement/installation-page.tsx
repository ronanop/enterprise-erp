"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { InstallationDetailPage } from "@/components/procurement/installation-detail-page";
import { InstallationListPage } from "@/components/procurement/installation-list-page";

function InstallationPageClient() {
  const searchParams = useSearchParams();
  const challanId = searchParams.get("challan")?.trim() || "";

  if (challanId) {
    return <InstallationDetailPage challanId={challanId} />;
  }

  return <InstallationListPage />;
}

export function InstallationPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading installation…</p>}
    >
      <InstallationPageClient />
    </Suspense>
  );
}
