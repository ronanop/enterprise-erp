import { AssetInformationPortalView } from "@/components/assets/asset-information-portal";

interface PageProps {
  params: Promise<{ assetId: string }>;
}

export default async function AssetInformationPortalPage({ params }: PageProps) {
  const { assetId } = await params;
  return <AssetInformationPortalView assetId={assetId} />;
}
