import { Suspense } from "react";

import { PayrollManagementPage } from "@/components/hr/payroll/payroll-management-page";
import { HrLoadingBlock } from "@/components/hr/hr-primitives";

export default function HrPayrollPage() {
  return (
    <Suspense fallback={<HrLoadingBlock label="Loading payroll…" />}>
      <PayrollManagementPage />
    </Suspense>
  );
}
