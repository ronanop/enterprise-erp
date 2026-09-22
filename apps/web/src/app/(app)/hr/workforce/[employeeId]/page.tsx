import { Suspense } from "react";

import { EmployeeProfilePage } from "@/components/hr/workforce/employee-profile-page";
import { EmsSkeleton } from "@/components/hr/workforce/ems-primitives";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  return (
    <Suspense fallback={<EmsSkeleton />}>
      <EmployeeProfilePage employeeId={employeeId} />
    </Suspense>
  );
}
