"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

/**
 * Shared IT Admin register field groups for inventory detail drawer.
 * Presentational only — values come from InventoryRowViewModel / register-parity.
 */

import type { InventoryAccessoryLine, InventoryRowViewModel } from "@/components/assets/inventory.mapper";
import { Button } from "@/components/ui/button";
import {
  DrawerEmptyLine,
  DrawerKvField,
  DrawerKvGrid,
  DrawerSectionCard,
} from "@/components/assets/inventory/interaction/drawer-sections/drawer-section";
import { StatusBadge } from "@/components/assets/shared";
import { buildDcChallanDetailHref } from "@/components/assets/navigation/dc-challan-navigation";
import {
  resolveScmIssuedDocument,
  resolveSignedDocument,
} from "@/components/assets/dc-challan/dc-challan-document";
import type { DcChallanDocument, DcChallanRow } from "@/services/assets-service";

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

function ConfigurationValue({ text }: { text: string }) {
  if (!text || text === "—") return <>{text || "—"}</>;
  const parts = text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return <>{text}</>;
  return (
    <ul className="space-y-1 font-normal">
      {parts.map((part) => (
        <li key={part}>{part}</li>
      ))}
    </ul>
  );
}

export type InventoryRegisterGroupsProps = {
  model: InventoryRegisterGroupModel;
  className?: string;
  /** @deprecated Expandable-row density is removed; kept for call-site compatibility. */
  compact?: boolean;
  onCreateDcChallan?: () => void;
  dcChallan?: DcChallanRow | null;
  dcChallanLoading?: boolean;
  onViewDcDocument?: (kind: "scm-issued" | "signed", document: DcChallanDocument) => void;
};

export function InventoryRegisterGroups({
  model,
  className,
  onCreateDcChallan,
  dcChallan,
  dcChallanLoading,
  onViewDcDocument,
}: InventoryRegisterGroupsProps) {
  return (
    <div className={className} data-testid="inventory-expandable-register">
      <div className="space-y-6">
        <DrawerSectionCard title="Assignment" headingId="reg-assignment">
          <DrawerKvGrid>
            <DrawerKvField label="Employee Name" value={model.assignee} testId="inventory-expandable-assignee" />
            <DrawerKvField
              label="Employee ID"
              value={model.employeeId}
              testId="inventory-expandable-employee-id"
              mono
            />
            <DrawerKvField label="Phone" value={model.phone} testId="inventory-expandable-phone" />
            <DrawerKvField label="Issued Date" value={model.issuedDate} testId="inventory-expandable-issued" />
            <DrawerKvField
              label="Earlier Used By"
              value={model.earlierUsedBy}
              testId="inventory-expandable-earlier-used"
              span
            />
          </DrawerKvGrid>
        </DrawerSectionCard>

        <DrawerSectionCard title="IT Information" headingId="reg-it">
          <DrawerKvGrid>
            <DrawerKvField label="Make" value={model.make} testId="inventory-expandable-make" />
            <DrawerKvField label="Model" value={model.model} testId="inventory-expandable-model" />
            <DrawerKvField
              label="Configuration"
              value={<ConfigurationValue text={model.configuration} />}
              testId="inventory-expandable-configuration"
              span
            />
          </DrawerKvGrid>
        </DrawerSectionCard>

        <DrawerSectionCard title="Location" headingId="reg-location">
          <DrawerKvGrid>
            <DrawerKvField label="Branch" value={model.branch} testId="inventory-expandable-branch" />
            <DrawerKvField
              label="Current Location"
              value={model.location}
              testId="inventory-expandable-location"
            />
          </DrawerKvGrid>
        </DrawerSectionCard>

        <DrawerSectionCard title="Accessories" headingId="reg-accessories">
          <div data-testid="inventory-expandable-accessories">
            {model.accessories.length === 0 ? (
              <DrawerEmptyLine>No accessories assigned</DrawerEmptyLine>
            ) : (
              <ul className="list-none space-y-2 p-0">
                {model.accessories.map((line, idx) => (
                  <li
                    key={`${line.typeLabel}-${idx}`}
                    className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm"
                  >
                    <span className="min-w-24 font-medium text-foreground">{line.typeLabel}</span>
                    {line.componentName ? (
                      <span className="text-muted-foreground">{line.componentName}</span>
                    ) : null}
                    <span className="text-muted-foreground">
                      S/N: <span className="font-mono text-xs text-foreground">{line.serialDisplay}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DrawerSectionCard>

        <DrawerSectionCard title="Delivery Challan" headingId="reg-dc">
          {dcChallanLoading ? (
            <DrawerEmptyLine>Loading delivery challan…</DrawerEmptyLine>
          ) : dcChallan ? (
            <InventoryLinkedDcChallan
              challan={dcChallan}
              onViewDcDocument={onViewDcDocument}
            />
          ) : dcChallan === null ? (
            <div className="space-y-3">
              <DrawerEmptyLine>No delivery challan for this asset.</DrawerEmptyLine>
              {onCreateDcChallan ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={onCreateDcChallan}
                >
                  Create DC Challan
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <DrawerKvGrid>
                <DrawerKvField label="DC Number" value={model.dcNumber} testId="inventory-expandable-dc-number" />
                <DrawerKvField label="Status" value={model.dcStatus} testId="inventory-expandable-dc-status" />
                <DrawerKvField
                  label="Signature"
                  value={model.dcSignature}
                  testId="inventory-expandable-dc-signature"
                />
              </DrawerKvGrid>
              {onCreateDcChallan ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={onCreateDcChallan}
                >
                  Create DC Challan
                </Button>
              ) : null}
            </>
          )}
        </DrawerSectionCard>

        <DrawerSectionCard title="Remarks" headingId="reg-remarks">
          <DrawerKvGrid>
            <DrawerKvField
              label="Assignment Remarks"
              value={model.assignmentRemarks}
              testId="inventory-expandable-assignment-remarks"
              pre
              span
            />
            <DrawerKvField
              label="Return Remarks"
              value={model.returnRemarks}
              testId="inventory-expandable-return-remarks"
              pre
              span
            />
          </DrawerKvGrid>
        </DrawerSectionCard>
      </div>
    </div>
  );
}

function formatDcWhen(value?: string | null): string {
  if (!value) return "—";
  return value.replace("T", " ").slice(0, 16);
}

function InventoryLinkedDcChallan({
  challan,
  onViewDcDocument,
}: {
  challan: DcChallanRow;
  onViewDcDocument?: (kind: "scm-issued" | "signed", document: DcChallanDocument) => void;
}) {
  const scm = resolveScmIssuedDocument(challan);
  const signed = resolveSignedDocument(challan);
  const signedLabel = challan.signed_at || challan.status === "SIGNED" || challan.status === "RECEIVED"
    ? `Signed${challan.signed_at ? ` · ${formatDcWhen(challan.signed_at)}` : ""}`
    : "Not signed";
  const receivedLabel = challan.received_at || challan.status === "RECEIVED"
    ? `Received${challan.received_at ? ` · ${formatDcWhen(challan.received_at)}` : ""}`
    : "Not received";

  return (
    <div className="space-y-3" data-testid="inventory-linked-dc-challan">
      <DrawerKvGrid>
        <DrawerKvField
          label="DC Number"
          testId="inventory-expandable-dc-number"
          value={
            <Link
              href={buildDcChallanDetailHref(challan.id)}
              className="cursor-pointer font-mono text-xs text-sky-800 underline-offset-2 transition-colors duration-200 hover:underline"
            >
              {challan.dc_number}
            </Link>
          }
        />
        <DrawerKvField
          label="Status"
          testId="inventory-expandable-dc-status"
          value={<StatusBadge kind="dcChallan" status={challan.status} />}
        />
        <DrawerKvField label="Signed" value={signedLabel} testId="inventory-expandable-dc-signed" />
        <DrawerKvField label="Received" value={receivedLabel} testId="inventory-expandable-dc-received" />
      </DrawerKvGrid>
      <ul className="space-y-2">
        <InventoryDcDocumentRow
          label="SCM challan document"
          document={scm}
          onView={scm && onViewDcDocument ? () => onViewDcDocument("scm-issued", scm) : undefined}
        />
        <InventoryDcDocumentRow
          label="Signed document"
          document={signed}
          onView={signed && onViewDcDocument ? () => onViewDcDocument("signed", signed) : undefined}
        />
      </ul>
    </div>
  );
}

function InventoryDcDocumentRow({
  label,
  document,
  onView,
}: {
  label: string;
  document: DcChallanDocument | null;
  onView?: () => void;
}) {
  return (
    <li className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate">{document?.original_filename || document?.external_url || "Not attached"}</p>
      </div>
      {document && onView ? (
        <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={onView}>
          <Eye className="size-3.5" />
          View
        </Button>
      ) : null}
    </li>
  );
}

