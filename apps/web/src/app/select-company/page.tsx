import { Suspense } from "react";

import { SelectCompanyForm } from "@/app/select-company/select-company-form";

function SelectCompanyFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-sm text-muted-foreground">
      Loading company selection…
    </div>
  );
}

export default function SelectCompanyPage() {
  return (
    <Suspense fallback={<SelectCompanyFallback />}>
      <SelectCompanyForm />
    </Suspense>
  );
}
