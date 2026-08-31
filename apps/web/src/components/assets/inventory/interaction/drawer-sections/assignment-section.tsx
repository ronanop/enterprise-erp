import type { AssetDetailDrawerAssignment } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { cn } from "@/lib/utils";

import {
  DrawerEmptyLine,
  DrawerKvField,
  DrawerKvGrid,
  DrawerSectionCard,
} from "./drawer-section";

export type AssignmentSectionProps = {
  assignment?: AssetDetailDrawerAssignment | null;
  className?: string;
};

export function AssignmentSection({ assignment, className }: AssignmentSectionProps) {
  const empty = !assignment || isAssignmentEmpty(assignment);

  return (
    <DrawerSectionCard
      title="Assignment"
      headingId="drawer-assignment-heading"
      className={cn(className)}
    >
      {empty ? (
        <DrawerEmptyLine>No active assignment</DrawerEmptyLine>
      ) : (
        <DrawerKvGrid>
          <DrawerKvField
            label="Employee"
            value={assignment!.employee}
            testId="drawer-assignment-employee"
          />
          <DrawerKvField
            label="Issue date"
            value={assignment!.issueDate}
            testId="drawer-assignment-issue-date"
          />
          <DrawerKvField label="Department" value={assignment!.department} span />
          <DrawerKvField
            label="Delivery Challan"
            value={
              assignment!.deliveryChallanSummary ??
              `${assignment!.deliveryReferenceNumber ?? "—"} · ${
                assignment!.deliveryReferenceStatus ?? "—"
              }`
            }
            testId="drawer-delivery-challan"
            span
          />
          <DrawerKvField
            label="Delivery reference"
            value={assignment!.deliveryReferenceNumber ?? "—"}
            testId="drawer-delivery-reference"
          />
          <DrawerKvField
            label="Delivery status"
            value={assignment!.deliveryReferenceStatus ?? "—"}
            testId="drawer-delivery-status"
          />
          <DrawerKvField
            label="Signature"
            value={assignment!.deliverySignature ?? "Not Signed"}
            testId="drawer-delivery-signature"
          />
          <DrawerKvField
            label="Assignment remarks"
            value={assignment!.assignmentRemarks ?? "—"}
            testId="drawer-assignment-remarks"
            pre
            span
          />
          <DrawerKvField
            label="Return remarks"
            value={assignment!.returnRemarks ?? "—"}
            testId="drawer-return-remarks"
            pre
            span
          />
        </DrawerKvGrid>
      )}
    </DrawerSectionCard>
  );
}

function isAssignmentEmpty(a: AssetDetailDrawerAssignment): boolean {
  const coreEmpty =
    (a.employee === "—" || !a.employee.trim()) &&
    (a.issueDate === "—" || !a.issueDate.trim()) &&
    (a.department === "—" || !a.department.trim());
  const enrichmentEmpty =
    (!a.deliveryReferenceNumber || a.deliveryReferenceNumber === "—") &&
    (!a.deliveryReferenceStatus || a.deliveryReferenceStatus === "—") &&
    (!a.assignmentRemarks || a.assignmentRemarks === "—") &&
    (!a.returnRemarks || a.returnRemarks === "—");
  return coreEmpty && enrichmentEmpty;
}
