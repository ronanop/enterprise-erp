import { Suspense } from "react";

import { MarketingHeadReviewPage } from "@/components/marketing/marketing-head-review-page";

type PageProps = {
  params: Promise<{ contentId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { contentId } = await params;
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>}>
      <MarketingHeadReviewPage contentId={contentId} />
    </Suspense>
  );
}
