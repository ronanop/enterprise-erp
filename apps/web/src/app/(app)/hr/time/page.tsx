import { Suspense } from "react";

import { AttendanceManagementPage } from "@/components/hr/attendance/attendance-management-page";
import { EmsSkeleton } from "@/components/hr/workforce/ems-primitives";

function AttendanceFallback() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="h-9 w-64 shrink-0 rounded-md bg-foreground/10 motion-safe:animate-pulse" />
      <EmsSkeleton cards={4} rows={10} />
    </div>
  );
}

export default function HrTimePage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <Suspense fallback={<AttendanceFallback />}>
        <AttendanceManagementPage />
      </Suspense>
    </div>
  );
}
