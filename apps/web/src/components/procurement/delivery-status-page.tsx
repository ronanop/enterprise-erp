"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { DeliveryStatusEditPanel } from "@/components/procurement/delivery-status-edit-panel";
import { DeliveryStatusListPage } from "@/components/procurement/delivery-status-list-page";

function DeliveryStatusPageClient() {
  const searchParams = useSearchParams();
  const challanId = searchParams.get("challan")?.trim() || "";

  if (challanId) {
    return <DeliveryStatusEditPanel challanId={challanId} />;
  }

  return <DeliveryStatusListPage />;
}

export function DeliveryStatusPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading delivery status…</p>}
    >
      <DeliveryStatusPageClient />
    </Suspense>
  );
}
