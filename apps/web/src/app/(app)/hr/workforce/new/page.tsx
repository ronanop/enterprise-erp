import { Suspense } from "react";

import { EmployeeWizardPage } from "@/components/hr/workforce/employee-wizard-page";
import { EmsSkeleton } from "@/components/hr/workforce/ems-primitives";

export default function NewEmployeePage() {
  return (
    <Suspense fallback={<EmsSkeleton />}>
      <EmployeeWizardPage />
    </Suspense>
  );
}
