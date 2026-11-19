"use client";

import { useEffect, useState } from "react";

import {
  RequiredFieldsDialog,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
import { FinanceField, FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  createContact,
  listCompanies,
  type Company,
  type ContactFormInput,
} from "@/services/sales-crm-service";

const EMPTY: ContactFormInput = {
  company_account_id: "",
  branch_id: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  mobile: "",
  title: "",
  is_primary: false,
};

export function ContactFormDialog({
  open,
  companyAccount,
  onClose,
  onSaved,
}: {
  open: boolean;
  companyAccount: Company | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<ContactFormInput>(EMPTY);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");

  const scopedCompanyId = companyAccount?.id;

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (companyAccount) {
      setForm({
        ...EMPTY,
        company_account_id: companyAccount.id,
        branch_id: companyAccount.branch_id,
      });
      return;
    }
    setForm(EMPTY);
    void listCompanies()
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, [open, companyAccount]);

  function companyName(id: string): string {
    if (companyAccount?.id === id) return companyAccount.customer_name;
    return companies.find((c) => c.id === id)?.customer_name ?? "—";
  }

  function onSelectCompany(nextCompanyAccountId: string) {
    const company = companies.find((c) => c.id === nextCompanyAccountId);
    setForm((f) => ({
      ...f,
      company_account_id: nextCompanyAccountId,
      branch_id: company?.branch_id ?? f.branch_id,
    }));
  }

  async function onSave() {
    const missing: string[] = [];
    if (!form.company_account_id) missing.push("Company");
    if (!form.branch_id) missing.push("Branch");
    if (!form.first_name.trim()) missing.push("First Name");
    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await createContact(form);
      onClose();
      onSaved?.();
    } catch (err) {
      setFormError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : "Failed to save contact",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
        role="presentation"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-lg rounded-xl border border-border/80 bg-card p-5 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-sm font-medium tracking-tight">New Contact</h2>

          {formError ? (
            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {formError}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {!scopedCompanyId ? (
              <FinanceField label="Company *">
                <FinanceSelect value={form.company_account_id} onChange={(e) => onSelectCompany(e.target.value)}>
                  <option value="">Select company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name}
                    </option>
                  ))}
                </FinanceSelect>
              </FinanceField>
            ) : (
              <p className="text-xs text-muted-foreground">
                Company:{" "}
                <span className="font-medium text-foreground">{companyName(form.company_account_id)}</span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <FinanceField label="First Name *">
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </FinanceField>
              <FinanceField label="Last Name">
                <Input
                  value={form.last_name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </FinanceField>
            </div>
            <FinanceField label="Designation">
              <Input value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </FinanceField>
            <div className="grid grid-cols-2 gap-2">
              <FinanceField label="Email">
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </FinanceField>
              <FinanceField label="Mobile">
                <Input value={form.mobile ?? ""} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} />
              </FinanceField>
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={Boolean(form.is_primary)}
                onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
              />
              Primary contact for this company
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" className="cursor-pointer" onClick={() => void onSave()} disabled={saving}>
              {saving ? "Saving…" : "Create Contact"}
            </Button>
          </div>
        </div>
      </div>

      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        onClose={() => setMandateOpen(false)}
      />
    </>
  );
}
