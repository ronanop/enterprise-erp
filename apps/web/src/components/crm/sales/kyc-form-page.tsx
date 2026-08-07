"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Cloud,
  Cpu,
  Network,
  Plus,
  Shield,
  UserRound,
  Wrench,
} from "lucide-react";

import { CrmErrorBanner, CrmPage, CrmSection, CRM_TABLE_HEAD_CELL, CRM_TABLE_HEAD_ROW } from "@/components/crm/crm-ui";
import { KycContactDesignationField } from "@/components/crm/sales/kyc-contact-designation-field";
import { KycTableProductField } from "@/components/crm/sales/kyc-table-product-field";
import {
  RequiredFieldsDialog,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  emptyKycFormData,
  emptyKycContactRow,
  emptyKycGridRow,
  KYC_CLOUD_PRODUCT_OPTIONS,
  KYC_HARDWARE_PRODUCT_OPTIONS,
  KYC_SECURITY_PRODUCT_OPTIONS,
  type CrmKycFormData,
  type KycContactRow,
  type KycGridRow,
} from "@/lib/crm/kyc-form-data";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  createKycRecord,
  getCompany,
  getKycRecord,
  listEmployeeOptions,
  updateKycRecord,
  type Company,
  type Option,
} from "@/services/sales-crm-service";

type KycFormPageProps = {
  companyAccountId?: string;
  kycId?: string;
};

type SaveMode = "save" | "saveAndNew";

function parseKycFormData(raw: Record<string, unknown>, fallback: CrmKycFormData): CrmKycFormData {
  const merged = { ...fallback, ...(raw as Partial<CrmKycFormData>) };

  const profiles = raw.network_profiles;
  if (Array.isArray(profiles) && profiles.length > 0) {
    merged.network_profiles = profiles.map((row, index) => {
      const item = row as Partial<KycGridRow>;
      return {
        id: item.id ?? `row-${index}`,
        network_profile: String(item.network_profile ?? ""),
        numbers: String(item.numbers ?? ""),
        oem: String(item.oem ?? ""),
        major_partner: String(item.major_partner ?? ""),
      };
    });
  } else if (!merged.network_profiles?.length) {
    merged.network_profiles = [emptyKycGridRow()];
  }

  const cloudRows = raw.cloud_rows;
  if (Array.isArray(cloudRows) && cloudRows.length > 0) {
    merged.cloud_rows = cloudRows.map((row, index) => {
      const item = row as Partial<KycGridRow>;
      return {
        id: item.id ?? `row-${index}`,
        network_profile: String(item.network_profile ?? ""),
        numbers: String(item.numbers ?? ""),
        oem: String(item.oem ?? ""),
        major_partner: String(item.major_partner ?? ""),
      };
    });
  } else if (!merged.cloud_rows?.length) {
    merged.cloud_rows = [emptyKycGridRow()];
  }

  const securityRows = raw.security_rows;
  if (Array.isArray(securityRows) && securityRows.length > 0) {
    merged.security_rows = securityRows.map((row, index) => {
      const item = row as Partial<KycGridRow>;
      return {
        id: item.id ?? `row-${index}`,
        network_profile: String(item.network_profile ?? ""),
        numbers: String(item.numbers ?? ""),
        oem: String(item.oem ?? ""),
        major_partner: String(item.major_partner ?? ""),
      };
    });
  } else if (!merged.security_rows?.length) {
    merged.security_rows = [emptyKycGridRow()];
  }

  const contacts = raw.contact_rows;
  if (Array.isArray(contacts) && contacts.length > 0) {
    merged.contact_rows = contacts.map((row, index) => {
      const item = row as Partial<KycContactRow>;
      return {
        id: item.id ?? `row-${index}`,
        designation: String(item.designation ?? ""),
        name: String(item.name ?? ""),
        mobile: String(item.mobile ?? ""),
        email: String(item.email ?? ""),
      };
    });
  } else if (!merged.contact_rows?.length) {
    merged.contact_rows = [emptyKycContactRow()];
  }

  return merged;
}

export function KycFormPage({ companyAccountId, kycId }: KycFormPageProps) {
  const router = useRouter();
  const isEdit = Boolean(kycId);

  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<CrmKycFormData>(() => emptyKycFormData());
  const [ownerEmployeeId, setOwnerEmployeeId] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [companyAccountIdState, setCompanyAccountIdState] = useState(companyAccountId ?? "");

  const [employees, setEmployees] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");

  const backHref = companyAccountIdState
    ? `/crm/companies/${companyAccountIdState}/kyc-account-mapping`
    : "/crm/kyc-account-mapping";
  const backLabel = company?.customer_name ?? "KYC - Account Mapping";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companyRow, kycRow, employeeOptions] = await Promise.all([
        companyAccountId ? getCompany(companyAccountId) : Promise.resolve(null),
        kycId ? getKycRecord(kycId) : Promise.resolve(null),
        listEmployeeOptions(),
      ]);

      setEmployees(employeeOptions);

      let accountId = companyAccountId ?? kycRow?.company_account_id ?? "";
      let branch = "";
      let owner = "";
      let selectedQuoteId = "";
      let formBase = emptyKycFormData();

      if (companyRow) {
        setCompany(companyRow);
        accountId = companyRow.id;
        branch = companyRow.branch_id;
        owner = companyRow.account_owner_id ?? "";
        formBase = emptyKycFormData(
          companyRow.customer_name,
          `${companyRow.customer_name} (${companyRow.account_number})`,
        );
      } else if (kycRow && accountId) {
        const account = await getCompany(accountId).catch(() => null);
        setCompany(account);
        if (account) {
          formBase = emptyKycFormData(
            account.customer_name,
            `${account.customer_name} (${account.account_number})`,
          );
        }
      } else {
        setCompany(null);
      }

      if (kycRow) {
        branch = kycRow.branch_id;
        owner = kycRow.owner_employee_id;
        selectedQuoteId = kycRow.quote_id ?? "";
        accountId = kycRow.company_account_id;
        formBase = parseKycFormData(kycRow.form_data, formBase);
      }

      setCompanyAccountIdState(accountId);
      setBranchId(branch);
      setOwnerEmployeeId(owner);
      setQuoteId(selectedQuoteId);

      setForm(formBase);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load KYC form");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId, kycId]);

  useEffect(() => {
    void load();
  }, [load]);

  function setField<K extends keyof CrmKycFormData>(key: K, value: CrmKycFormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateNetworkRow(id: string, patch: Partial<KycGridRow>) {
    setForm((current) => ({
      ...current,
      network_profiles: current.network_profiles.map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      ),
    }));
  }

  function updateCloudRow(id: string, patch: Partial<KycGridRow>) {
    setForm((current) => ({
      ...current,
      cloud_rows: current.cloud_rows.map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      ),
    }));
  }

  function updateSecurityRow(id: string, patch: Partial<KycGridRow>) {
    setForm((current) => ({
      ...current,
      security_rows: current.security_rows.map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      ),
    }));
  }

  function updateContactRow(id: string, patch: Partial<KycContactRow>) {
    setForm((current) => ({
      ...current,
      contact_rows: current.contact_rows.map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      ),
    }));
  }

  function resetForSaveAndNew() {
    const prefill = emptyKycFormData(form.company_name, form.company_account_label);
    setForm(prefill);
    setQuoteId("");
  }

  function validateRequired(): boolean {
    const missing: string[] = [];
    if (!form.company_name.trim()) missing.push("Company Name");
    if (!companyAccountIdState) missing.push("Company Account");
    if (!ownerEmployeeId) missing.push("KYC Owner");
    if (!branchId) missing.push("Branch");
    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return false;
    }
    return true;
  }

  async function persist(mode: SaveMode) {
    if (!validateRequired()) return;

    setSaving(true);
    setError(null);
    try {
      const body = {
        branch_id: branchId,
        company_account_id: companyAccountIdState,
        owner_employee_id: ownerEmployeeId,
        quote_id: quoteId || null,
        form_data: { ...form } as Record<string, unknown>,
      };

      if (isEdit && kycId) {
        await updateKycRecord(kycId, body);
      } else {
        await createKycRecord(body);
      }

      if (mode === "saveAndNew") {
        resetForSaveAndNew();
        return;
      }

      router.push(backHref);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : "Failed to save KYC",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return (
    <CrmPage>
      <Link
        href={backHref}
        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
      >
        <ArrowLeft className="size-3.5" /> {backLabel}
      </Link>

      <PageHeader
        title={isEdit ? "Edit KYC" : "Create KYC"}
        description="Capture company KYC profile, contacts, infrastructure, and security footprint."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => router.push(backHref)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => void persist("saveAndNew")}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save and New"}
            </Button>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              onClick={() => void persist("save")}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmSection title="Company Profile" icon={Building2}>
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-x-10">
          <FinanceField label="Company Name *">
            <Input
              value={form.company_name}
              onChange={(e) => setField("company_name", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="Number of Entity">
            <Input
              value={form.number_of_locations}
              onChange={(e) => setField("number_of_locations", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="GST No.">
            <Input value={form.gst_no} onChange={(e) => setField("gst_no", e.target.value)} />
          </FinanceField>
          <FinanceField label="PAN Number">
            <Input value={form.pan} onChange={(e) => setField("pan", e.target.value)} />
          </FinanceField>
          <FinanceField label="Corporate HQ">
            <Input
              value={form.corporate_hq}
              onChange={(e) => setField("corporate_hq", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="IT Budget (Per Year)">
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ₹
              </span>
              <Input
                className="pl-7"
                value={form.it_budget_per_year}
                onChange={(e) => setField("it_budget_per_year", e.target.value)}
              />
            </div>
          </FinanceField>
          <FinanceField label="KYC Owner *">
            <FinanceSelect
              value={ownerEmployeeId}
              onChange={(e) => setOwnerEmployeeId(e.target.value)}
            >
              <option value="">Select owner</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="TAN">
            <Input value={form.tan} onChange={(e) => setField("tan", e.target.value)} />
          </FinanceField>
        </div>
      </CrmSection>

      <CrmSection
        title="Contact"
        icon={UserRound}
        actions={
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="cursor-pointer"
            onClick={() =>
              setForm((current) => ({
                ...current,
                contact_rows: [...current.contact_rows, emptyKycContactRow()],
              }))
            }
          >
            <Plus className="size-3" aria-hidden="true" />
            Add row
          </Button>
        }
      >
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={CRM_TABLE_HEAD_ROW}>
                <th className={CRM_TABLE_HEAD_CELL}>Designation</th>
                <th className={CRM_TABLE_HEAD_CELL}>Name</th>
                <th className={CRM_TABLE_HEAD_CELL}>Mobile</th>
                <th className={CRM_TABLE_HEAD_CELL}>Email</th>
              </tr>
            </thead>
            <tbody>
              {form.contact_rows.map((row) => (
                <tr key={row.id} className={cn("border-b border-border/60")}>
                  <td className="min-w-[220px] px-4 py-2 align-top">
                    <KycContactDesignationField
                      value={row.designation}
                      onChange={(designation) => updateContactRow(row.id, { designation })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={row.name}
                      onChange={(e) => updateContactRow(row.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={row.mobile}
                      onChange={(e) => updateContactRow(row.id, { mobile: e.target.value })}
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="email"
                      value={row.email}
                      onChange={(e) => updateContactRow(row.id, { email: e.target.value })}
                      autoComplete="email"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CrmSection>

      <CrmSection title="Profile" icon={Cpu}>
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-x-10">
          <FinanceField label="Number of Employees">
            <Input
              value={form.number_of_employees}
              onChange={(e) => setField("number_of_employees", e.target.value)}
              inputMode="numeric"
            />
          </FinanceField>
          <FinanceField label="User's Major Partner">
            <Input
              value={form.users_major_partner}
              onChange={(e) => setField("users_major_partner", e.target.value)}
            />
          </FinanceField>
        </div>
      </CrmSection>

      <CrmSection
        title="Hardware/Network Infrastructure"
        icon={Network}
        actions={
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="cursor-pointer"
            onClick={() =>
              setForm((current) => ({
                ...current,
                network_profiles: [...current.network_profiles, emptyKycGridRow()],
              }))
            }
          >
            <Plus className="size-3" aria-hidden="true" />
            Add row
          </Button>
        }
      >
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={CRM_TABLE_HEAD_ROW}>
                <th className={CRM_TABLE_HEAD_CELL}>Product Category</th>
                <th className={CRM_TABLE_HEAD_CELL}>Numbers</th>
                <th className={CRM_TABLE_HEAD_CELL}>OEM</th>
                <th className={CRM_TABLE_HEAD_CELL}>Major Partner</th>
              </tr>
            </thead>
            <tbody>
              {form.network_profiles.map((row) => (
                <tr key={row.id} className={cn("border-b border-border/60")}>
                  <td className="min-w-[200px] px-4 py-2 align-top">
                    <KycTableProductField
                      options={KYC_HARDWARE_PRODUCT_OPTIONS}
                      value={row.network_profile}
                      onChange={(network_profile) =>
                        updateNetworkRow(row.id, { network_profile })
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={row.numbers}
                      onChange={(e) => updateNetworkRow(row.id, { numbers: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={row.oem}
                      onChange={(e) => updateNetworkRow(row.id, { oem: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={row.major_partner}
                      onChange={(e) =>
                        updateNetworkRow(row.id, { major_partner: e.target.value })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CrmSection>

      <CrmSection
        title="Cloud Information"
        icon={Cloud}
        actions={
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="cursor-pointer"
            onClick={() =>
              setForm((current) => ({
                ...current,
                cloud_rows: [...current.cloud_rows, emptyKycGridRow()],
              }))
            }
          >
            <Plus className="size-3" aria-hidden="true" />
            Add row
          </Button>
        }
      >
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={CRM_TABLE_HEAD_ROW}>
                <th className={CRM_TABLE_HEAD_CELL}>Product Category</th>
                <th className={CRM_TABLE_HEAD_CELL}>Numbers</th>
                <th className={CRM_TABLE_HEAD_CELL}>OEM</th>
                <th className={CRM_TABLE_HEAD_CELL}>Major Partner</th>
              </tr>
            </thead>
            <tbody>
              {form.cloud_rows.map((row) => (
                <tr key={row.id} className={cn("border-b border-border/60")}>
                  <td className="min-w-[200px] px-4 py-2 align-top">
                    <KycTableProductField
                      options={KYC_CLOUD_PRODUCT_OPTIONS}
                      value={row.network_profile}
                      onChange={(network_profile) =>
                        updateCloudRow(row.id, { network_profile })
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={row.numbers}
                      onChange={(e) => updateCloudRow(row.id, { numbers: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={row.oem}
                      onChange={(e) => updateCloudRow(row.id, { oem: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={row.major_partner}
                      onChange={(e) =>
                        updateCloudRow(row.id, { major_partner: e.target.value })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CrmSection>

      <CrmSection
        title="Security Users Profile"
        icon={Shield}
        actions={
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="cursor-pointer"
            onClick={() =>
              setForm((current) => ({
                ...current,
                security_rows: [...current.security_rows, emptyKycGridRow()],
              }))
            }
          >
            <Plus className="size-3" aria-hidden="true" />
            Add row
          </Button>
        }
      >
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={CRM_TABLE_HEAD_ROW}>
                <th className={CRM_TABLE_HEAD_CELL}>Product Category</th>
                <th className={CRM_TABLE_HEAD_CELL}>Numbers</th>
                <th className={CRM_TABLE_HEAD_CELL}>OEM</th>
                <th className={CRM_TABLE_HEAD_CELL}>Major Partner</th>
              </tr>
            </thead>
            <tbody>
              {form.security_rows.map((row) => (
                <tr key={row.id} className={cn("border-b border-border/60")}>
                  <td className="min-w-[200px] px-4 py-2 align-top">
                    <KycTableProductField
                      options={KYC_SECURITY_PRODUCT_OPTIONS}
                      value={row.network_profile}
                      onChange={(network_profile) =>
                        updateSecurityRow(row.id, { network_profile })
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={row.numbers}
                      onChange={(e) => updateSecurityRow(row.id, { numbers: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={row.oem}
                      onChange={(e) => updateSecurityRow(row.id, { oem: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={row.major_partner}
                      onChange={(e) =>
                        updateSecurityRow(row.id, { major_partner: e.target.value })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CrmSection>

      <CrmSection title="FMS Information" icon={Wrench}>
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-x-10">
          <FinanceField label="RE's">
            <Input value={form.res} onChange={(e) => setField("res", e.target.value)} />
          </FinanceField>
          <FinanceField label="RE's No Of Engineer">
            <Input
              value={form.res_no_of_engineer}
              onChange={(e) => setField("res_no_of_engineer", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="RE's Expiry Date">
            <Input
              type="date"
              value={form.res_expiry_date}
              onChange={(e) => setField("res_expiry_date", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="AMC's">
            <Input value={form.amcs} onChange={(e) => setField("amcs", e.target.value)} />
          </FinanceField>
          <FinanceField label="AMC's No Of Engineer">
            <Input
              value={form.amcs_no_of_engineer}
              onChange={(e) => setField("amcs_no_of_engineer", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="AMC's Expiry Date">
            <Input
              type="date"
              value={form.amcs_expiry_date}
              onChange={(e) => setField("amcs_expiry_date", e.target.value)}
            />
          </FinanceField>
        </div>
      </CrmSection>

      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        onClose={() => setMandateOpen(false)}
      />
    </CrmPage>
  );
}
