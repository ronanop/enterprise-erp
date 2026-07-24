"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Users } from "lucide-react";

import { CrmErrorBanner, CrmListPanel, CrmPage } from "@/components/crm/crm-ui";
import { FinanceField, FinanceSelect } from "@/components/finance/journals/finance-form-field";
import {
  RequiredFieldsDialog,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  createContact,
  listCompanies,
  listContacts,
  type Company,
  type Contact,
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

type SortKey = "name" | "company" | "title" | "email" | "mobile" | "status";

export function ContactsListPage({
  companyAccountId,
  embedded,
}: {
  companyAccountId?: string;
  embedded?: boolean;
} = {}) {
  const [rows, setRows] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("name");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ContactFormInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");

  const hideCompanyPicker = Boolean(embedded && companyAccountId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contactRows, companyRows] = await Promise.all([
        listContacts(companyAccountId),
        listCompanies(),
      ]);
      setRows(contactRows);
      setCompanies(companyRows);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  function companyName(id: string): string {
    return companies.find((c) => c.id === id)?.customer_name ?? "—";
  }

  function openCreate() {
    const scoped = companyAccountId
      ? companies.find((c) => c.id === companyAccountId)
      : undefined;
    setForm(
      scoped
        ? {
            ...EMPTY,
            company_account_id: scoped.id,
            branch_id: scoped.branch_id,
          }
        : EMPTY,
    );
    setFormError(null);
    setDialogOpen(true);
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
      setDialogOpen(false);
      await load();
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        `${r.first_name} ${r.last_name ?? ""}`.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.mobile ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortBy, sortDir, {
        name: (r) => `${r.first_name} ${r.last_name ?? ""}`.trim(),
        company: (r) => companyName(r.company_account_id),
        title: (r) => r.title,
        email: (r) => r.email,
        mobile: (r) => r.mobile,
        status: (r) => r.status,
      }),
    // companyName depends on companies list
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, sortBy, sortDir, companies],
  );

  const actions = (
    <div className="flex shrink-0 flex-nowrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()} disabled={loading}>
        <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        Refresh
      </Button>
      <Button type="button" size="sm" className="cursor-pointer" onClick={openCreate}>
        <Plus className="size-3.5" /> New Contact
      </Button>
    </div>
  );

  return (
    <CrmPage>
      {!embedded ? (
        <PageHeader
          title="Contacts"
          description="Company contact persons for the sales blueprint."
          actions={actions}
        />
      ) : null}

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Contacts"
          subtitle="Company contact persons"
          icon={Users}
          count={sorted.length}
          actions={embedded ? actions : null}
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search contacts…",
          }}
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <CrmSortableTh label="Name" sortKey="name" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Company" sortKey="company" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Title" sortKey="title" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Email" sortKey="email" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Mobile" sortKey="mobile" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Status" sortKey="status" activeKey={sortBy} dir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Loading contacts…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No contacts yet. Use “New Contact” to add one.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {row.first_name} {row.last_name ?? ""}
                      {row.is_primary ? <Badge variant="secondary" className="ml-1.5">Primary</Badge> : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{companyName(row.company_account_id)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.title ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.mobile ?? row.phone ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <FinanceStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CrmListPanel>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="presentation"
          onClick={() => setDialogOpen(false)}
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
              {!hideCompanyPicker ? (
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
                  <span className="font-medium text-foreground">
                    {companyName(form.company_account_id)}
                  </span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <FinanceField label="First Name *">
                  <Input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
                </FinanceField>
                <FinanceField label="Last Name">
                  <Input value={form.last_name ?? ""} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
                </FinanceField>
              </div>
              <FinanceField label="Title">
                <Input value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </FinanceField>
              <div className="grid grid-cols-2 gap-2">
                <FinanceField label="Email">
                  <Input type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
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
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" className="cursor-pointer" onClick={() => void onSave()} disabled={saving}>
                {saving ? "Saving…" : "Create Contact"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        onClose={() => setMandateOpen(false)}
      />
    </CrmPage>
  );
}
