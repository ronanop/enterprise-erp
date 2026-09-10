import { Suspense } from "react";
import { CapaCreatePage } from "@/components/quality/quality-create-pages";

export default function NewCapaRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading form…</p>}>
      <CapaCreatePage />
    </Suspense>
  );
}
