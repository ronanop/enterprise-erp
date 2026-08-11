"use client";

import { createContext, useContext } from "react";

export type SiteStageFormReadOnlyMeta = {
  readOnly: boolean;
  backHref?: string;
  backLabel?: string;
  readOnlyBanner?: string;
};

const defaultMeta: SiteStageFormReadOnlyMeta = { readOnly: false };

const SiteStageFormReadOnlyContext = createContext<SiteStageFormReadOnlyMeta>(defaultMeta);

export function SiteStageFormReadOnlyProvider({
  value,
  children,
}: {
  value: SiteStageFormReadOnlyMeta;
  children: React.ReactNode;
}) {
  return (
    <SiteStageFormReadOnlyContext.Provider value={value}>
      {children}
    </SiteStageFormReadOnlyContext.Provider>
  );
}

export function useSiteStageFormReadOnlyMeta(): SiteStageFormReadOnlyMeta {
  return useContext(SiteStageFormReadOnlyContext);
}

export function useSiteStageFormReadOnly(): boolean {
  return useSiteStageFormReadOnlyMeta().readOnly;
}
