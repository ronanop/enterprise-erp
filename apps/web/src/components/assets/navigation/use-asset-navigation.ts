"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { createAssetNavigation, type AssetNavigation } from "@/components/assets/navigation/asset-navigation";

export function useAssetNavigation(): AssetNavigation {
  const router = useRouter();
  return useMemo(() => createAssetNavigation((href) => router.push(href)), [router]);
}
