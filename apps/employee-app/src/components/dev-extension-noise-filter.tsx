"use client";

import { useEffect } from "react";

import { installDevExtensionNoiseFilter } from "@/lib/dev-extension-noise";

/** Installs the extension console noise filter after mount to avoid head script hydration mismatches. */
export function DevExtensionNoiseFilter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    installDevExtensionNoiseFilter();
  }, []);

  return null;
}
