import { Suspense } from "react";
import { ScarCreatePage } from "@/components/quality/quality-create-pages";

export default function NewScarRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading form…</p>}>
      <ScarCreatePage />
    </Suspense>
  );
}
