import { AssetAddForm } from "@/components/assets/asset-add-form";

interface PageProps {
  params: Promise<{ assetId: string }>;
}

export default async function EditAssetPage({ params }: PageProps) {
  const { assetId } = await params;
  return <AssetAddForm assetId={assetId} />;
}
