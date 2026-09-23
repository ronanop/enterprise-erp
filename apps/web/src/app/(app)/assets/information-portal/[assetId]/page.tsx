import { Suspense } from "react";
import { AssetInformationPortalView } from "@/components/assets/asset-information-portal";

interface PageProps {
  params: Promise<{ assetId: string }>;
}

export default async function AssetInformationPortalPage({ params }: PageProps) {
  const { assetId } = await params;
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">Loading asset information portal…</div>
      }
    >
      <AssetInformationPortalView assetId={assetId} />
    </Suspense>
  );
}
