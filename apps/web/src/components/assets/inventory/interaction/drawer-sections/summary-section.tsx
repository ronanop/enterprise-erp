import type { ReactNode } from "react";

import { StatusBadge } from "@/components/assets/shared";
import { isOperationalStatus } from "@/components/assets/shared/asset-status";
import { cn } from "@/lib/utils";

export type SummarySectionProps = {
  assetTag: string;
  laptopName: string;
  currentHolder: string;
  branch: string;
  operationalStatus: string;
  lifecycleStatus: string;
  className?: string;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function SummarySection({
  assetTag,
  laptopName,
  currentHolder,
  branch,
  operationalStatus,
  lifecycleStatus,
  className,
}: SummarySectionProps) {
  return (
    <section aria-labelledby="drawer-summary-heading" className={cn("space-y-3", className)}>
      <h3 id="drawer-summary-heading" className="text-sm font-medium tracking-tight text-foreground">
        Asset summary
      </h3>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Field label="Asset tag">
          <span className="font-mono text-xs">{assetTag}</span>
        </Field>
        <Field label="Laptop name">{laptopName}</Field>
        <Field label="Current holder">{currentHolder}</Field>
        <Field label="Branch">{branch}</Field>
        <Field label="Operational status">
          {isOperationalStatus(operationalStatus) ? (
            <StatusBadge kind="operational" status={operationalStatus} />
          ) : (
            operationalStatus
          )}
        </Field>
        <Field label="Lifecycle">
          <StatusBadge kind="lifecycle" status={lifecycleStatus} />
        </Field>
      </dl>
    </section>
  );
}
