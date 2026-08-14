/**
 * Shared IT Admin register field groups for Inventory expandable / Detail consistency.
 * Presentational only — values come from InventoryRowViewModel / register-parity.
 */

import type { ReactNode } from "react";

import type { InventoryAccessoryLine, InventoryRowViewModel } from "@/components/assets/inventory.mapper";
import { StatusBadge } from "@/components/assets/shared";
import { isOperationalStatus } from "@/components/assets/shared/asset-status";
import { cn } from "@/lib/utils";

export type InventoryRegisterGroupModel = {
  assignee: string;
  employeeId: string;
  phone: string;
  issuedDate: string;
  earlierUsedBy: string;
  make: string;
  model: string;
  configuration: string;
  branch: string;
  location: string;
  operationalStatus: string;
  lifecycleStatus: string;
  accessories: InventoryAccessoryLine[];
  dcNumber: string;
  dcStatus: string;
  dcSignature: string;
  assignmentRemarks: string;
  returnRemarks: string;
};

export function inventoryRowToRegisterGroups(row: InventoryRowViewModel): InventoryRegisterGroupModel {
  return {
    assignee: row.currentHolder,
    employeeId: row.employeeId,
    phone: row.expandable.phoneNumber,
    issuedDate: row.issueDate,
    earlierUsedBy: row.expandable.earlierUsedBy,
    make: row.manufacturer,
    model: row.model,
    configuration: row.configuration,
    branch: row.branch,
    location: row.location,
    operationalStatus: row.operationalStatus,
    lifecycleStatus: row.lifecycleStatus,
    accessories: row.expandable.accessories ?? [],
    dcNumber: row.expandable.deliveryChallan,
    dcStatus: row.expandable.deliveryReferenceStatus,
    dcSignature: row.expandable.deliverySignature ?? "Not Signed",
    assignmentRemarks: row.expandable.assignmentRemarks,
    returnRemarks: row.expandable.returnRemarks,
  };
}

function GroupHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      id={id}
      className="sm:col-span-2 lg:col-span-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
    >
      {children}
    </p>
  );
}

function Field({
  label,
  value,
  testId,
  mono,
  pre,
  className,
}: {
  label: string;
  value: ReactNode;
  testId?: string;
  mono?: boolean;
  pre?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-medium text-foreground">{label}</dt>
      <dd
        data-testid={testId}
        className={cn(mono && "font-mono text-xs", pre && "whitespace-pre-wrap")}
      >
        {value}
      </dd>
    </div>
  );
}

export type InventoryRegisterGroupsProps = {
  model: InventoryRegisterGroupModel;
  className?: string;
  /** denser grid for expandable rows */
  compact?: boolean;
};

export function InventoryRegisterGroups({
  model,
  className,
  compact = true,
}: InventoryRegisterGroupsProps) {
  return (
    <dl
      className={cn(
        "grid gap-2 text-xs text-muted-foreground",
        compact ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
        className,
      )}
      data-testid="inventory-expandable-register"
    >
      <GroupHeading id="reg-assignment">Assignment</GroupHeading>
      <Field label="Assignee" value={model.assignee} testId="inventory-expandable-assignee" />
      <Field label="Employee ID" value={model.employeeId} testId="inventory-expandable-employee-id" mono />
      <Field label="Phone" value={model.phone} testId="inventory-expandable-phone" />
      <Field label="Issued Date" value={model.issuedDate} testId="inventory-expandable-issued" />
      <Field label="Earlier Used By" value={model.earlierUsedBy} testId="inventory-expandable-earlier-used" />

      <GroupHeading id="reg-status">Status</GroupHeading>
      <Field
        label="Operational Status"
        testId="inventory-expandable-operational-status"
        value={
          isOperationalStatus(model.operationalStatus) ? (
            <StatusBadge kind="operational" status={model.operationalStatus} />
          ) : (
            model.operationalStatus
          )
        }
      />
      <Field
        label="Lifecycle Status"
        testId="inventory-expandable-lifecycle-status"
        value={<StatusBadge kind="lifecycle" status={model.lifecycleStatus} />}
      />

      <GroupHeading id="reg-it">IT Information</GroupHeading>
      <Field label="Make" value={model.make} testId="inventory-expandable-make" />
      <Field label="Model" value={model.model} testId="inventory-expandable-model" />
      <Field
        label="Configuration"
        value={model.configuration}
        testId="inventory-expandable-configuration"
        className="sm:col-span-2 lg:col-span-1"
      />

      <GroupHeading id="reg-location">Location</GroupHeading>
      <Field label="Branch" value={model.branch} testId="inventory-expandable-branch" />
      <Field label="Current Location" value={model.location} testId="inventory-expandable-location" />

      <GroupHeading id="reg-accessories">Accessories</GroupHeading>
      <div className="sm:col-span-2 lg:col-span-3">
        <dd data-testid="inventory-expandable-accessories">
          {model.accessories.length === 0 ? (
            "No accessories assigned"
          ) : (
            <ul className="mt-0 list-none space-y-1 p-0">
              {model.accessories.map((line, idx) => (
                <li key={`${line.typeLabel}-${idx}`} className="flex flex-wrap gap-x-4 gap-y-0.5">
                  <span className="min-w-24 font-medium text-foreground">{line.typeLabel}</span>
                  {line.componentName ? (
                    <span className="text-muted-foreground">{line.componentName}</span>
                  ) : null}
                  <span>
                    S/N: <span className="font-mono text-xs">{line.serialDisplay}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </dd>
      </div>

      <GroupHeading id="reg-dc">Delivery Challan</GroupHeading>
      <Field label="DC Number" value={model.dcNumber} testId="inventory-expandable-dc-number" />
      <Field label="Status" value={model.dcStatus} testId="inventory-expandable-dc-status" />
      <Field label="Signature" value={model.dcSignature} testId="inventory-expandable-dc-signature" />

      <GroupHeading id="reg-remarks">Remarks</GroupHeading>
      <Field
        label="Assignment Remarks"
        value={model.assignmentRemarks}
        testId="inventory-expandable-assignment-remarks"
        pre
        className="sm:col-span-2 lg:col-span-3"
      />
      <Field
        label="Return Remarks"
        value={model.returnRemarks}
        testId="inventory-expandable-return-remarks"
        pre
        className="sm:col-span-2 lg:col-span-3"
      />
    </dl>
  );
}
