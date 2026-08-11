import { Suspense } from "react";

import { LeaveManagementPage } from "@/components/hr/leave/leave-management-page";

function LeaveFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Loading leave management…
    </div>
  );
}

export default function HrLeavePage() {
  return (
    <Suspense fallback={<LeaveFallback />}>
      <LeaveManagementPage />
    </Suspense>
  );
}
