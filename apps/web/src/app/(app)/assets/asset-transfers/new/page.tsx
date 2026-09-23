"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserTransferContainer } from "@/components/assets/user-transfer-container";

function UserTransferPageInner() {
  const searchParams = useSearchParams();
  const assetId = searchParams.get("assetId")?.trim() || null;
  return <UserTransferContainer assetId={assetId} />;
}

/**
 * Assigned → user transfer entry.
 * Convention matches issue/return wizards: `/assets/asset-transfers/new?assetId=…`
 */
export default function UserTransferNewPage() {
  return (
    <Suspense fallback={null}>
      <UserTransferPageInner />
    </Suspense>
  );
}
