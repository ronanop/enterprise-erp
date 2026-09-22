import { Suspense } from "react";

import { HrSetupCenter } from "@/components/hr/setup/setup-center";
import { HrLoadingBlock } from "@/components/hr/hr-primitives";

export default function HrSetupPage() {
  return (
    <Suspense fallback={<HrLoadingBlock label="Loading Org Setup…" />}>
      <HrSetupCenter />
    </Suspense>
  );
}
