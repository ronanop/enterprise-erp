import type { AssetDetailDrawerAssignment } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { EmptyState } from "@/components/assets/shared";
import { cn } from "@/lib/utils";

export type AssignmentSectionProps = {
  assignment?: AssetDetailDrawerAssignment | null;
  className?: string;
};

export function AssignmentSection({ assignment, className }: AssignmentSectionProps) {
  const empty = !assignment || isAssignmentEmpty(assignment);

  return (
    <section aria-labelledby="drawer-assignment-heading" className={cn("space-y-3", className)}>
      <h3 id="drawer-assignment-heading" className="text-sm font-medium tracking-tight text-foreground">
        Assignment
      </h3>
      {empty ? (
        <EmptyState
          variant="no-queue"
          compact
          title="No active assignment"
          description="Assignment details will appear when an asset is issued."
        />
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Employee</dt>
            <dd className="mt-0.5 text-sm" data-testid="drawer-assignment-employee">
              {assignment!.employee}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Issue date</dt>
            <dd className="mt-0.5 text-sm" data-testid="drawer-assignment-issue-date">
              {assignment!.issueDate}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Department</dt>
            <dd className="mt-0.5 text-sm">{assignment!.department}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Delivery Challan</dt>
            <dd className="mt-0.5 text-sm" data-testid="drawer-delivery-challan">
              {assignment!.deliveryChallanSummary ??
                `${assignment!.deliveryReferenceNumber ?? "—"} · ${
                  assignment!.deliveryReferenceStatus ?? "—"
                }`}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Delivery reference</dt>
            <dd className="mt-0.5 text-sm" data-testid="drawer-delivery-reference">
              {assignment!.deliveryReferenceNumber ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Delivery status</dt>
            <dd className="mt-0.5 text-sm" data-testid="drawer-delivery-status">
              {assignment!.deliveryReferenceStatus ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Signature</dt>
            <dd className="mt-0.5 text-sm" data-testid="drawer-delivery-signature">
              {assignment!.deliverySignature ?? "Not Signed"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Assignment remarks</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm" data-testid="drawer-assignment-remarks">
              {assignment!.assignmentRemarks ?? "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Return remarks</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm" data-testid="drawer-return-remarks">
              {assignment!.returnRemarks ?? "—"}
            </dd>
          </div>
        </dl>
      )}
    </section>
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
