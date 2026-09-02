import { AssetDetailWorkspacePage } from "@/components/assets/asset-detail-workspace-page";

interface PageProps {
  params: Promise<{ assetId: string }>;
}

export default async function AssetDetailPage({ params }: PageProps) {
  const { assetId } = await params;
  return <AssetDetailWorkspacePage assetId={assetId} />;
}
