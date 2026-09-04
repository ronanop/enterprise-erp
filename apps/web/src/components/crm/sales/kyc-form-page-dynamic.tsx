"use client";

import dynamic from "next/dynamic";

function KycFormPageLoading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading KYC form">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
    </div>
  );
}

export const KycFormPageDynamic = dynamic(
  () => import("@/components/crm/sales/kyc-form-page").then((module) => module.KycFormPage),
  { loading: KycFormPageLoading },
);
