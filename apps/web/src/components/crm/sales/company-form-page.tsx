"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, FileText, MapPin } from "lucide-react";

import { CrmErrorBanner, CrmPage, CrmSection } from "@/components/crm/crm-ui";
import { CrmSessionEmployeeField } from "@/components/crm/sales/crm-session-employee-field";
import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import {
  RequiredFieldsDialog,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthUser } from "@/hooks/use-auth-user";
import {
  resolveSessionEmployeeId,
  resolveSessionEmployeeLabel,
} from "@/lib/crm/session-employee";
import {
  COMPANY_LEAD_SOURCES,
  companyLeadSourceLabel,
  normalizeCompanyLeadSource,
} from "@/lib/crm/company-lead-sources";
import { ApiClientError } from "@/services/api-client";
import {
  createCompany,
  getCompany,
  listBranchOptions,
  listCrmMemberOptions,
  listMarketingEventOptions,
  peekNextCompanyAccountNumber,
  updateCompany,
  type Company,
  type CompanyFormInput,
  type Option,
} from "@/services/sales-crm-service";

const INDUSTRIES = [
  "IT & Technology",
  "Manufacturing",
  "Healthcare",
  "BFSI",
  "Retail",
  "Government",
  "Education",
  "Telecom",
  "Others",
];

/** Host from a website URL/value, without protocol/www/path. */
function websiteHost(website: string): string | null {
  const raw = website.trim().toLowerCase();
  if (!raw) return null;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const host = new URL(withProto).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    const host = raw
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      ?.replace(/^www\./, "");
    return host || null;
  }
}

function emailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 0) return null;
  const domain = trimmed.slice(at + 1).replace(/\.$/, "");
  return domain.includes(".") ? domain : null;
}

/** Soft check only — mismatch must not block save. */
function emailMatchesWebsite(email: string, website: string): boolean {
  const domain = emailDomain(email);
  const host = websiteHost(website);
  if (!domain || !host) return true;
  return domain === host || domain.endsWith(`.${host}`);
}

const EMPTY_FORM: CompanyFormInput = {
  branch_id: "",
  customer_name: "",
  account_owner_id: "",
  account_type: "customer",
  industry: "",
  other_industries: "",
  portal_id: "",
  source: "",
  partner_names: "",
  marketing_event_id: "",
  rating: "",
  first_name: "",
  last_name: "",
  customer_email: "",
  phone: "",
  website: "",
  account_ownership_id: "",
  customer_id_ext: "",
  role: "User",
  billing_street: "",
  billing_city: "",
  billing_state: "",
  billing_code: "",
  billing_country: "India",
  shipping_street: "",
  shipping_city: "",
  shipping_state: "",
  shipping_code: "",
  shipping_country: "",
  description: "",
};

export function CompanyFormPage({ companyId }: { companyId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(companyId);
  const { user } = useAuthUser();
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyFormInput>(EMPTY_FORM);
  const [otherSource, setOtherSource] = useState("");
  const [employees, setEmployees] = useState<Option[]>([]);
  const [marketingEvents, setMarketingEvents] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");
  const [nextAccountNumber, setNextAccountNumber] = useState("");
  const [sameAsBilling, setSameAsBilling] = useState(false);

  const backHref = isEdit && companyId ? `/crm/companies/${companyId}` : "/crm/companies";
  const backLabel = isEdit ? (company?.customer_name ?? "Company") : "Companies";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [branches, emps, events, companyRow] = await Promise.all([
        listBranchOptions(),
        listCrmMemberOptions(),
        listMarketingEventOptions().catch(() => [] as Option[]),
        companyId ? getCompany(companyId) : Promise.resolve(null),
      ]);
      setEmployees(emps);
      setMarketingEvents(events);
      if (companyRow) {
        const normalizedSource = normalizeCompanyLeadSource(companyRow.source);
        const knownSource = (COMPANY_LEAD_SOURCES as readonly string[]).includes(normalizedSource);
        setCompany(companyRow);
        setForm({
          branch_id: companyRow.branch_id,
          customer_name: companyRow.customer_name,
          account_owner_id: companyRow.account_owner_id ?? "",
          account_type: companyRow.account_type || "customer",
          industry: companyRow.industry,
          other_industries: companyRow.other_industries ?? "",
          portal_id: companyRow.portal_id ?? "",
          source: knownSource ? normalizedSource : "other",
          partner_names: companyRow.partner_names ?? "",
          marketing_event_id: companyRow.marketing_event_id ?? "",
          rating: companyRow.rating ?? "",
          first_name: companyRow.first_name ?? "",
          last_name: companyRow.last_name ?? "",
          customer_email: companyRow.customer_email ?? "",
          phone: companyRow.phone ?? "",
          website: companyRow.website ?? "",
          account_ownership_id: companyRow.account_ownership_id ?? "",
          customer_id_ext: companyRow.customer_id_ext ?? "",
          role: companyRow.role ?? "User",
          billing_street: companyRow.billing_street,
          billing_city: companyRow.billing_city,
          billing_state: companyRow.billing_state,
          billing_code: companyRow.billing_code,
          billing_country: companyRow.billing_country,
          shipping_street: companyRow.shipping_street ?? "",
          shipping_city: companyRow.shipping_city ?? "",
          shipping_state: companyRow.shipping_state ?? "",
          shipping_code: companyRow.shipping_code ?? "",
          shipping_country: companyRow.shipping_country ?? "",
          description: companyRow.description ?? "",
        });
        setOtherSource(knownSource ? "" : companyRow.source);
        setSameAsBilling(
          Boolean(companyRow.billing_street?.trim()) &&
            (companyRow.shipping_street ?? "") === companyRow.billing_street &&
            (companyRow.shipping_city ?? "") === companyRow.billing_city &&
            (companyRow.shipping_state ?? "") === companyRow.billing_state &&
            (companyRow.shipping_code ?? "") === companyRow.billing_code &&
            (companyRow.shipping_country ?? "") === companyRow.billing_country,
        );
      } else {
        setCompany(null);
        const sessionOwnerId = resolveSessionEmployeeId(emps, user);
        setForm({
          ...EMPTY_FORM,
          branch_id: branches[0]?.id ?? "",
          account_owner_id: sessionOwnerId,
        });
        setOtherSource("");
        setSameAsBilling(false);
        const nextNo = await peekNextCompanyAccountNumber().catch(() => "");
        setNextAccountNumber(nextNo);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load company form");
    } finally {
      setLoading(false);
    }
  }, [companyId, user]);

  const accountManagerLabel = useMemo(() => {
    if (form.account_owner_id) {
      const fromList = employees.find((e) => e.id === form.account_owner_id)?.label;
      if (fromList) return fromList;
    }
    return resolveSessionEmployeeLabel(employees, user);
  }, [employees, form.account_owner_id, user]);

  const emailDomainMismatch = useMemo(() => {
    const email = form.customer_email?.trim() ?? "";
    const site = form.website?.trim() ?? "";
    if (!email || !site) return false;
    return !emailMatchesWebsite(email, site);
  }, [form.customer_email, form.website]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof CompanyFormInput>(key: K, value: CompanyFormInput[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (
        sameAsBilling &&
        (key === "billing_street" ||
          key === "billing_city" ||
          key === "billing_state" ||
          key === "billing_code" ||
          key === "billing_country")
      ) {
        next.shipping_street = next.billing_street;
        next.shipping_city = next.billing_city;
        next.shipping_state = next.billing_state;
        next.shipping_code = next.billing_code;
        next.shipping_country = next.billing_country;
      }
      return next;
    });
  }

  function onSameAsBillingChange(checked: boolean) {
    setSameAsBilling(checked);
    if (checked) {
      setForm((f) => ({
        ...f,
        shipping_street: f.billing_street,
        shipping_city: f.billing_city,
        shipping_state: f.billing_state,
        shipping_code: f.billing_code,
        shipping_country: f.billing_country,
      }));
    }
  }

  async function save() {
    const missing: string[] = [];
    if (!form.customer_name.trim()) missing.push("Company Name");
    if (!form.industry) missing.push("Industry");
    if (!form.source) missing.push("Source");
    if (form.source === "other" && !otherSource.trim()) missing.push("Other Source");
    if (form.source === "multi_tier" && !form.partner_names?.trim()) missing.push("Partner Names");
    if (form.source === "event" && !form.marketing_event_id) missing.push("Event");
    if (!form.first_name?.trim()) missing.push("First Name");
    if (!form.last_name?.trim()) missing.push("Last Name");
    if (!form.customer_email?.trim()) missing.push("Customer Email");
    if (!form.phone?.trim()) missing.push("Phone");
    if (!form.website?.trim()) missing.push("Website");
    if (!isEdit && !form.branch_id) missing.push("Branch");
    if (!form.billing_street.trim()) missing.push("Billing Street");
    if (!form.billing_city.trim()) missing.push("Billing City");
    if (!form.billing_state.trim()) missing.push("Billing State");
    if (!form.billing_code.trim()) missing.push("Billing Code");
    if (!form.billing_country.trim()) missing.push("Billing Country");
    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: CompanyFormInput = {
        ...form,
        account_type: "customer",
        source: form.source === "other" ? otherSource.trim() : form.source,
        partner_names:
          form.source === "multi_tier" ? form.partner_names?.trim() || null : null,
        marketing_event_id: form.source === "event" ? form.marketing_event_id || null : null,
        account_owner_id: form.account_owner_id || null,
        account_ownership_id: form.account_ownership_id || null,
      };
      const saved = isEdit && companyId
        ? await updateCompany(companyId, payload)
        : await createCompany(payload);
      router.push(`/crm/companies/${saved.id}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : "Failed to save company",
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
        title={isEdit ? `Edit ${company?.customer_name ?? "Company"}` : "Create Company"}
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
              size="sm"
              className="cursor-pointer"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Save Company"}
            </Button>
          </>
        }
      />

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmSection title="Account Information" icon={Building2}>
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-x-10">
          <div className="space-y-3">
            <CrmSessionEmployeeField
              label="Account Manager Owner"
              value={accountManagerLabel}
            />
            <FinanceField label="Company Name *">
              <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
            </FinanceField>
            <FinanceField label="Company ID">
              <Input
                value={
                  isEdit
                    ? (company?.account_number ?? "")
                    : nextAccountNumber || "Assigning…"
                }
                disabled
                aria-readonly="true"
                className="font-mono text-sm"
              />
            </FinanceField>
            <FinanceField label="Industry *">
              <FinanceSelect value={form.industry} onChange={(e) => set("industry", e.target.value)}>
                <option value="">None</option>
                {INDUSTRIES.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </FinanceSelect>
            </FinanceField>
            <FinanceField label="Other Industries">
              <Input
                value={form.other_industries ?? ""}
                onChange={(e) => set("other_industries", e.target.value)}
              />
            </FinanceField>
            <FinanceField label="Source *">
              <FinanceSelect
                value={form.source}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((f) => ({
                    ...f,
                    source: value,
                    partner_names: value === "multi_tier" ? f.partner_names : "",
                    marketing_event_id: value === "event" ? f.marketing_event_id : "",
                  }));
                  if (value !== "other") setOtherSource("");
                }}
              >
                <option value="">None</option>
                {COMPANY_LEAD_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {companyLeadSourceLabel(source)}
                  </option>
                ))}
              </FinanceSelect>
            </FinanceField>
            {form.source === "multi_tier" ? (
              <FinanceField label="Partner Names *">
                <Input
                  value={form.partner_names ?? ""}
                  onChange={(e) => set("partner_names", e.target.value)}
                  placeholder="Enter partner company names"
                />
              </FinanceField>
            ) : null}
            {form.source === "event" ? (
              <FinanceField label="Event *">
                <FinanceSelect
                  value={form.marketing_event_id ?? ""}
                  onChange={(e) => set("marketing_event_id", e.target.value)}
                >
                  <option value="">
                    {marketingEvents.length > 0 ? "None" : "No marketing events found"}
                  </option>
                  {marketingEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.label}
                    </option>
                  ))}
                </FinanceSelect>
              </FinanceField>
            ) : null}
            {form.source === "other" ? (
              <FinanceField label="Other Source *">
                <Input
                  value={otherSource}
                  onChange={(e) => setOtherSource(e.target.value)}
                  placeholder="Enter source"
                />
              </FinanceField>
            ) : null}
          </div>

          <div className="space-y-3">
            <FinanceField label="First Name *">
              <Input value={form.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} />
            </FinanceField>
            <FinanceField label="Last Name *">
              <Input value={form.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} />
            </FinanceField>
            <FinanceField
              label="Customer Email *"
              error={
                emailDomainMismatch ? "Email domain does not match website" : undefined
              }
            >
              <Input
                type="email"
                value={form.customer_email ?? ""}
                onChange={(e) => set("customer_email", e.target.value)}
                aria-invalid={emailDomainMismatch || undefined}
                className={
                  emailDomainMismatch
                    ? "border-destructive/70 text-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                    : undefined
                }
              />
            </FinanceField>
            <FinanceField label="Phone *">
              <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            </FinanceField>
            <FinanceField label="Website *">
              <Input value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} />
            </FinanceField>
            <FinanceField label="Assigned Ownership">
              <FinanceSelect
                value={form.account_ownership_id ?? ""}
                onChange={(e) => set("account_ownership_id", e.target.value)}
              >
                <option value="">None</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.label}
                  </option>
                ))}
              </FinanceSelect>
            </FinanceField>
          </div>
        </div>
      </CrmSection>

      <CrmSection title="Address Information" icon={MapPin}>
        <div className="grid min-w-0 gap-y-6">
          <div className="grid min-w-0 max-w-xl grid-cols-1 gap-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Billing Address
            </p>
            <FinanceField label="Street *">
              <Input value={form.billing_street} onChange={(e) => set("billing_street", e.target.value)} />
            </FinanceField>
            <FinanceField label="City *">
              <Input value={form.billing_city} onChange={(e) => set("billing_city", e.target.value)} />
            </FinanceField>
            <FinanceField label="State *">
              <Input value={form.billing_state} onChange={(e) => set("billing_state", e.target.value)} />
            </FinanceField>
            <FinanceField label="Code *">
              <Input value={form.billing_code} onChange={(e) => set("billing_code", e.target.value)} />
            </FinanceField>
            <FinanceField label="Country *">
              <Input
                value={form.billing_country}
                onChange={(e) => set("billing_country", e.target.value)}
              />
            </FinanceField>
          </div>

          <div className="grid min-w-0 max-w-xl grid-cols-1 gap-y-3 border-t border-border/60 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Shipping Address
              </p>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={sameAsBilling}
                  onChange={(e) => onSameAsBillingChange(e.target.checked)}
                  className="size-4 cursor-pointer rounded border-input accent-primary transition-colors duration-150"
                />
                Same as Billing
              </label>
            </div>

            {sameAsBilling ? (
              <>
                <FinanceField label="Street">
                  <Input
                    value={form.shipping_street ?? ""}
                    disabled
                    className="cursor-not-allowed opacity-70"
                  />
                </FinanceField>
                <FinanceField label="City">
                  <Input
                    value={form.shipping_city ?? ""}
                    disabled
                    className="cursor-not-allowed opacity-70"
                  />
                </FinanceField>
                <FinanceField label="State">
                  <Input
                    value={form.shipping_state ?? ""}
                    disabled
                    className="cursor-not-allowed opacity-70"
                  />
                </FinanceField>
                <FinanceField label="Code">
                  <Input
                    value={form.shipping_code ?? ""}
                    disabled
                    className="cursor-not-allowed opacity-70"
                  />
                </FinanceField>
                <FinanceField label="Country">
                  <Input
                    value={form.shipping_country ?? ""}
                    disabled
                    className="cursor-not-allowed opacity-70"
                  />
                </FinanceField>
              </>
            ) : (
              <>
                <FinanceField label="Street">
                  <Input
                    value={form.shipping_street ?? ""}
                    onChange={(e) => set("shipping_street", e.target.value)}
                  />
                </FinanceField>
                <FinanceField label="City">
                  <Input
                    value={form.shipping_city ?? ""}
                    onChange={(e) => set("shipping_city", e.target.value)}
                  />
                </FinanceField>
                <FinanceField label="State">
                  <Input
                    value={form.shipping_state ?? ""}
                    onChange={(e) => set("shipping_state", e.target.value)}
                  />
                </FinanceField>
                <FinanceField label="Code">
                  <Input
                    value={form.shipping_code ?? ""}
                    onChange={(e) => set("shipping_code", e.target.value)}
                  />
                </FinanceField>
                <FinanceField label="Country">
                  <Input
                    value={form.shipping_country ?? ""}
                    onChange={(e) => set("shipping_country", e.target.value)}
                  />
                </FinanceField>
              </>
            )}
          </div>
        </div>
      </CrmSection>

      <CrmSection title="Description Information" icon={FileText}>
        <FinanceField label="Description">
          <FinanceTextarea
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
          />
        </FinanceField>
      </CrmSection>

      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        onClose={() => setMandateOpen(false)}
      />
    </CrmPage>
  );
}
