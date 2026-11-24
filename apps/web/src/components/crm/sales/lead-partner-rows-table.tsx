"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Plus, Trash2 } from "lucide-react";

import { CRM_TABLE_HEAD_CELL, CRM_TABLE_HEAD_ROW, CrmSection } from "@/components/crm/crm-ui";
import {
  buildVendorAddressEntriesFromForm,
  emptyVendorFormDraft,
  validateVendorFormDraft,
  VendorFormFields,
  type VendorFormDraft,
} from "@/components/procurement/vendor-form-fields";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  emptyLeadPartnerRow,
  type LeadPartnerRow,
} from "@/lib/crm/lead-partner-rows";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  createVendorOption,
  resolveVendorOrgScope,
} from "@/services/procurement-service";

const ADD_DISTRIBUTOR_VALUE = "__add_distributor__";

type LeadPartnerRowsTableProps = {
  title: string;
  icon: LucideIcon;
  nameLabel: string;
  rows: LeadPartnerRow[];
  nameOptions: readonly string[];
  onChange: (rows: LeadPartnerRow[]) => void;
  nameRequired?: boolean;
  /**
   * When true (Distributor Information), show “Add Distributor” which opens
   * the same vendor-style create dialog used in Procurement.
   */
  allowCustomName?: boolean;
  companyId?: string | null;
  branchId?: string | null;
  /** Called after a distributor/vendor is created so the parent can refresh options. */
  onDistributorCreated?: (name: string) => void;
};

export function LeadPartnerRowsTable({
  title,
  icon,
  nameLabel,
  rows,
  nameOptions,
  onChange,
  nameRequired = false,
  allowCustomName = false,
  companyId,
  branchId,
  onDistributorCreated,
}: LeadPartnerRowsTableProps) {
  const displayRows = rows.length > 0 ? rows : [emptyLeadPartnerRow()];
  const [addRowId, setAddRowId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [draft, setDraft] = useState<VendorFormDraft>(emptyVendorFormDraft());

  function updateRow(id: string, patch: Partial<LeadPartnerRow>) {
    onChange(displayRows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    onChange([...displayRows, emptyLeadPartnerRow()]);
  }

  function removeRow(id: string) {
    if (displayRows.length <= 1) {
      onChange([emptyLeadPartnerRow()]);
      return;
    }
    onChange(displayRows.filter((row) => row.id !== id));
  }

  function openAddDistributor(rowId: string) {
    setAddRowId(rowId);
    setDialogError(null);
    setDraft(emptyVendorFormDraft());
    setDialogOpen(true);
  }

  function closeAddDistributor() {
    setDialogOpen(false);
    setDialogBusy(false);
    setDialogError(null);
    setAddRowId(null);
  }

  async function saveDistributor() {
    const validationError = validateVendorFormDraft(draft);
    if (validationError) {
      setDialogError(validationError);
      return;
    }
    const name = draft.vendorName.trim();
    const addressEntries = buildVendorAddressEntriesFromForm(draft);
    const contactPerson = [draft.contactFirstName, draft.contactLastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ");

    setDialogBusy(true);
    setDialogError(null);
    try {
      let scopeCompanyId = companyId?.trim() || "";
      let scopeBranchId = branchId?.trim() || "";
      if (!scopeCompanyId || !scopeBranchId) {
        const scope = await resolveVendorOrgScope().catch(() => null);
        scopeCompanyId = scope?.company_id || "";
        scopeBranchId = scope?.branch_id || "";
      }
      if (!scopeCompanyId || !scopeBranchId) {
        setDialogError("Could not resolve company/branch to create a distributor.");
        return;
      }

      await createVendorOption({
        vendor_name: name,
        company_id: scopeCompanyId,
        branch_id: scopeBranchId,
        addressEntries,
        vendor_type: draft.vendorType,
        email: draft.email,
        mobile: draft.mobile,
        contactFirstName: draft.contactFirstName,
        contactLastName: draft.contactLastName,
      });

      if (addRowId) {
        updateRow(addRowId, {
          name,
          contact_person: contactPerson,
          contact_number: draft.mobile.trim(),
          contact_email: draft.email.trim(),
        });
      }
      onDistributorCreated?.(name);
      closeAddDistributor();
    } catch (err) {
      setDialogError(formatApiError(err, "Failed to create distributor"));
    } finally {
      setDialogBusy(false);
    }
  }

  const optionSet = new Set(nameOptions.map((name) => name.toLowerCase()));

  return (
    <>
      <CrmSection
        title={title}
        icon={icon}
        actions={
          <Button type="button" variant="outline" size="xs" className="cursor-pointer" onClick={addRow}>
            <Plus className="size-3" aria-hidden />
            Add row
          </Button>
        }
      >
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className={CRM_TABLE_HEAD_ROW}>
                <th className={CRM_TABLE_HEAD_CELL}>
                  {nameLabel}
                  {nameRequired ? " *" : ""}
                </th>
                <th className={CRM_TABLE_HEAD_CELL}>Contact Person</th>
                <th className={CRM_TABLE_HEAD_CELL}>Contact Number</th>
                <th className={CRM_TABLE_HEAD_CELL}>Contact Email</th>
                <th className={cn(CRM_TABLE_HEAD_CELL, "w-12 text-center")}>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const nameInList = optionSet.has(row.name.trim().toLowerCase());
                const selectValue =
                  !row.name.trim()
                    ? ""
                    : nameInList
                      ? nameOptions.find(
                        (option) => option.toLowerCase() === row.name.trim().toLowerCase(),
                      ) ?? row.name
                      : row.name;

                return (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="min-w-[200px] px-3 py-2 align-top">
                      <FinanceSelect
                        value={selectValue}
                        onChange={(event) => {
                          const next = event.target.value;
                          if (next === ADD_DISTRIBUTOR_VALUE) {
                            openAddDistributor(row.id);
                            return;
                          }
                          updateRow(row.id, { name: next });
                        }}
                        aria-label={nameLabel}
                      >
                        <option value="">Select…</option>
                        {nameOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                        {allowCustomName ? (
                          <option value={ADD_DISTRIBUTOR_VALUE}>Add Distributor</option>
                        ) : null}
                      </FinanceSelect>
                    </td>
                    <td className="min-w-[160px] px-3 py-2 align-top">
                      <Input
                        value={row.contact_person}
                        onChange={(event) =>
                          updateRow(row.id, { contact_person: event.target.value })
                        }
                        disabled={!row.name.trim()}
                      />
                    </td>
                    <td className="min-w-[140px] px-3 py-2 align-top">
                      <Input
                        value={row.contact_number}
                        inputMode="tel"
                        autoComplete="tel"
                        onChange={(event) =>
                          updateRow(row.id, { contact_number: event.target.value })
                        }
                        disabled={!row.name.trim()}
                      />
                    </td>
                    <td className="min-w-[180px] px-3 py-2 align-top">
                      <Input
                        type="email"
                        value={row.contact_email}
                        autoComplete="email"
                        onChange={(event) =>
                          updateRow(row.id, { contact_email: event.target.value })
                        }
                        disabled={!row.name.trim()}
                      />
                    </td>
                    <td className="px-2 py-2 align-top text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="cursor-pointer text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${nameLabel.toLowerCase()} row`}
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CrmSection>

      {allowCustomName ? (
        <ConfirmDialog
          open={dialogOpen}
          title="Add Distributor"
          description="Enter contact and vendor details. Add one or more addresses (billing, shipping, GST, and supply per location)."
          confirmLabel="Save distributor"
          cancelLabel="Cancel"
          busy={dialogBusy}
          contentClassName="max-w-2xl max-h-[85vh] overflow-y-auto p-6"
          onConfirm={() => void saveDistributor()}
          onCancel={closeAddDistributor}
        >
          <div className="mt-4 space-y-4">
            {dialogError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
                {dialogError}
              </p>
            ) : null}
            <VendorFormFields
              value={draft}
              onChange={setDraft}
              disabled={dialogBusy}
              vendorNamePlaceholder="Distributor name"
            />
          </div>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
