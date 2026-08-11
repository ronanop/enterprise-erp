"use client";

import { createContext, useContext } from "react";

const SiteStageFormReadOnlyContext = createContext(false);

export function SiteStageFormReadOnlyProvider({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: React.ReactNode;
}) {
  return (
    <SiteStageFormReadOnlyContext.Provider value={readOnly}>
      {children}
    </SiteStageFormReadOnlyContext.Provider>
  );
}

export function useSiteStageFormReadOnly(): boolean {
  return useContext(SiteStageFormReadOnlyContext);
}
