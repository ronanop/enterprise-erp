import { Suspense } from "react";

import { AssetAddForm } from "@/components/assets/asset-add-form";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AddAssetPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const incomingUnitId = first(params.incomingUnitId);
  const incomingLineId = first(params.incomingLineId);

  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <AssetAddForm
        incomingUnitId={incomingUnitId}
        incomingLineId={incomingLineId}
      />
    </Suspense>
  );
}
