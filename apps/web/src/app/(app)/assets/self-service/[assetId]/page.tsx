import { AssetSelfServiceView } from "@/components/assets/asset-self-service-view";

interface PageProps {
  params: Promise<{ assetId: string }>;
}

export default async function AssetSelfServicePage({ params }: PageProps) {
  const { assetId } = await params;
  return <AssetSelfServiceView assetId={assetId} />;
}
