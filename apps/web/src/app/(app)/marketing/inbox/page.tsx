"use client";

import { Suspense } from "react";

import { MarketingInboxPage } from "@/components/marketing/marketing-inbox-page";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading inbox</p>}>
      <MarketingInboxPage />
    </Suspense>
  );
}
