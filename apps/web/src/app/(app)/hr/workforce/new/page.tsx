"use client";

import { Suspense } from "react";

import { EmployeeWizardPage } from "@/components/hr/workforce/employee-wizard-page";

/**
 * Add employee — full onboarding-style details filled by HR.
 * No invitation link; education & previous employment are optional.
 */
export default function NewEmployeePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <EmployeeWizardPage />
    </Suspense>
  );
}
