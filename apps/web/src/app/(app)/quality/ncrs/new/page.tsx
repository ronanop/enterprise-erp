import { Suspense } from "react";
import { NcrCreatePage } from "@/components/quality/quality-create-pages";

export default function NewNcrRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading form…</p>}>
      <NcrCreatePage />
    </Suspense>
  );
}
