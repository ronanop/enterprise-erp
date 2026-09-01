"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Printer, Share2, Trash2 } from "lucide-react";

import { CompanyShareDialog } from "@/components/crm/sales/company-share-dialog";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canDeleteCrmRecords } from "@/lib/crm/crm-module-access";
import { nextCloneCompanyName } from "@/lib/crm/company-clone-name";
import { exportCompanyPdf } from "@/lib/crm/export-company-pdf";
import { ApiClientError } from "@/services/api-client";
import {
  companyToFormInput,
  createCompany,
  deleteCompany,
  listCompanies,
  listCrmMemberOptions,
  type Company,
} from "@/services/sales-crm-service";

export function CompanyAccountActionsMenu({ company }: { company: Company }) {
  const router = useRouter();
  const { user, adminModuleKeys } = useAuthUser();
  const canDelete = canDeleteCrmRecords(adminModuleKeys, user?.userType);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClone() {
    setMenuOpen(false);
    setBusy(true);
    setError(null);
    try {
      const all = await listCompanies();
      const cloneName = nextCloneCompanyName(company, all);
      const cloned = await createCompany(companyToFormInput(company, cloneName));
      router.push(`/crm/companies/${cloned.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to clone company");
    } finally {
      setBusy(false);
    }
  }

  function onShare() {
    setMenuOpen(false);
    setShareOpen(true);
  }

  async function onPrintPreview() {
    setMenuOpen(false);
    setBusy(true);
    setError(null);
    try {
      const employees = await listCrmMemberOptions().catch(() => []);
      const nameFor = (id: string | null) => {
        if (!id) return "—";
        return employees.find((e) => e.id === id)?.label ?? "—";
      };
      exportCompanyPdf({
        company,
        accountManagerName: nameFor(company.account_owner_id),
        assignedOwnershipName: company.account_ownership_id
          ? nameFor(company.account_ownership_id)
          : "None",
        createdByName: nameFor(company.account_owner_id),
        modifiedByName: nameFor(company.account_owner_id),
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to export PDF");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteConfirm() {
    setBusy(true);
    setError(null);
    try {
      await deleteCompany(company.id);
      setDeleteOpen(false);
      router.push("/crm/companies");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete company");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <RowActionsMenu open={menuOpen} onOpenChange={setMenuOpen} align="end">
        <RowActionsItem onClick={() => void onClone()}>
          <Copy className="size-3.5 text-muted-foreground" />
          Clone
        </RowActionsItem>
        <RowActionsItem onClick={onShare}>
          <Share2 className="size-3.5 text-muted-foreground" />
          Share
        </RowActionsItem>
        <RowActionsItem onClick={() => void onPrintPreview()}>
          <Printer className="size-3.5 text-muted-foreground" />
          Print preview
        </RowActionsItem>
        {canDelete ? (
          <RowActionsItem
            destructive
            onClick={() => {
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </RowActionsItem>
        ) : null}
      </RowActionsMenu>

      <CompanyShareDialog open={shareOpen} company={company} onClose={() => setShareOpen(false)} />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete company"
        description={`Remove ${company.customer_name}? This soft-deletes the sales account.`}
        tone="destructive"
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void onDeleteConfirm()}
      >
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </ConfirmDialog>
    </>
  );
}
