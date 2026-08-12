import type { ReactNode } from "react";

import { MarketingAmbientBackground } from "@/components/marketing/marketing-ambient-background";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-full">
      <MarketingAmbientBackground />
      <div className="relative">{children}</div>
    </div>
  );
}
