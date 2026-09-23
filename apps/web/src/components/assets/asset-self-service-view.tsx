"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Props = {
  assetId: string;
};

/**
 * Legacy QR target. Redirects to the authenticated Information Portal so
 * older printed labels and bookmarked /self-service URLs stay valid.
 */
export function AssetSelfServiceView({ assetId }: Props) {
  const router = useRouter();

  useEffect(() => {
    const id = encodeURIComponent(assetId);
    router.replace(`/assets/information-portal/${id}?from=qr`);
  }, [assetId, router]);

  return (
    <div
      className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground"
      data-testid="asset-self-service-redirect"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Opening asset information portal…
    </div>
  );
}
