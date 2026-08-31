import type { ReactNode } from "react";

import { StatusBadge } from "@/components/assets/shared";
import { isOperationalStatus } from "@/components/assets/shared/asset-status";

import {
  DrawerKvField,
  DrawerKvGrid,
  DrawerSectionCard,
} from "./drawer-section";

export type SummarySectionProps = {
  assetTag: string;
  laptopName: string;
  currentHolder: string;
  branch: string;
  operationalStatus: string;
  lifecycleStatus: string;
  className?: string;
};

function StatusField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-3">{children}</dd>
    </div>
  );
}

export function SummarySection({
  branch,
  operationalStatus,
  lifecycleStatus,
  className,
}: SummarySectionProps) {
  return (
    <DrawerSectionCard title="Overview" headingId="drawer-overview-heading" className={className}>
      <DrawerKvGrid>
        <DrawerKvField label="Branch" value={branch} />
        <StatusField label="Operational Status">
          <span data-testid="inventory-expandable-operational-status">
            {isOperationalStatus(operationalStatus) ? (
              <StatusBadge kind="operational" status={operationalStatus} />
            ) : (
              operationalStatus
            )}
          </span>
        </StatusField>
        <StatusField label="Lifecycle Status">
          <span data-testid="inventory-expandable-lifecycle-status">
            <StatusBadge kind="lifecycle" status={lifecycleStatus} />
          </span>
        </StatusField>
      </DrawerKvGrid>
    </DrawerSectionCard>
  );
}
