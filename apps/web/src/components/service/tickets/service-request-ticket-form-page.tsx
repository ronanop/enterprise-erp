"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ApiClientError,
  createServiceRequestTicket,
  getServiceRequestTicket,
  loadTicketFormLookups,
  type LookupOption,
  updateServiceRequestTicket,
} from "@/services/service-request-ticket-service";

type Option = LookupOption;

function SelectField({
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
  required?: boolean;
}) {
  return (
    <select
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-foreground uppercase">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const emptyForm = (): Record<string, string> => ({
  mode_of_action: "remote_support",
  service_type: "managed_services",
  subject: "",
  contact_name: "",
  status: "ticket_registered",
  priority: "p3",
  channel: "portal",
  ticket_category: "hardware",
  sla_status: "within_sla",
  category_id: "",
  customer_id: "",
  branch_id: "",
  email: "",
  alternate_email: "",
  mobile: "",
  owner_employee_id: "",
  product_id: "",
  asset_name: "",
  serial_number: "",
  warranty_start_date: "",
  warranty_end_date: "",
  amc_end_date: "",
  asset_status: "existing_asset",
  amc_mail_sent: "false",
  software_version: "",
  issue_description: "",
  reference_sr_number: "",
  customer_reference: "",
  lsi: "",
  end_customer_name: "",
  end_customer_email: "",
  coordinator_name: "",
  coordinator_phone: "",
  end_customer_street: "",
  end_customer_state: "",
  end_customer_city: "",
  end_customer_city_type: "",
  end_customer_other_city: "",
  end_customer_gst: "",
  end_customer_postal_code: "",
  start_work_date: "",
  due_at: "",
  classification: "incident",
  escalation_reason: "",
  next_plan: "",
  additional_description: "",
  oem_support_enabled: "false",
  fe_engineer_name: "",
  fe_engineer_contact: "",
  fe_distance: "",
  fe_visits_count: "",
  fe_carrying_spares: "false",
  fe_visit_date: "",
  fe_hw_replacement: "",
  fe_transport_mode: "",
  fe_movement_charges: "",
  fe_visit_charges: "",
  fe_total_charges: "",
  fe_remarks: "",
  fe_payment_approval: "",
  oem_name: "",
  oem_ticket_number: "",
  oem_customer_reference: "",
  oem_ticket_type: "",
  oem_engineer_contact: "",
  oem_tac_response_summary: "",
  oem_tac_resolution: "",
  oem_status: "open",
  oem_last_checked_at: "",
});

export function ServiceRequestTicketFormPage({ ticketId }: { ticketId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(ticketId);
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState<Option[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (name: string, value: string) => setForm((f) => ({ ...f, [name]: value }));

  useEffect(() => {
    void (async () => {
      setLookupsLoading(true);
      setLookupError(null);
      try {
        const lookups = await loadTicketFormLookups();
        setCategories(lookups.categories);
        setCustomers(lookups.customers);
        setBranches(lookups.branches);
        setEmployees(lookups.employees);
        setProducts(lookups.products);
        if (lookups.errors.length > 0) {
          setLookupError(lookups.errors.join("; "));
        }
      } catch (err) {
        setLookupError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load form lookups. Refresh the page or sign in again.",
        );
      } finally {
        setLookupsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!ticketId) return;
    void (async () => {
      setLoading(true);
      try {
        const t = await getServiceRequestTicket(ticketId);
        setForm({
          ...emptyForm(),
          mode_of_action: t.mode_of_action ?? "remote_support",
          service_type: t.service_type ?? "managed_services",
          subject: t.subject,
          contact_name: t.contact_name ?? "",
          status: t.status,
          priority: t.priority,
          channel: t.channel ?? "portal",
          ticket_category: t.ticket_category ?? "hardware",
          sla_status: t.sla_status ?? "within_sla",
          category_id: t.category_id ?? "",
          customer_id: t.customer_id,
          branch_id: t.branch_id,
          email: t.email ?? "",
          alternate_email: t.alternate_email ?? "",
          mobile: t.mobile ?? "",
          owner_employee_id: t.owner_employee_id ?? "",
          product_id: t.product_id ?? "",
          asset_name: t.asset_name ?? "",
          serial_number: t.serial_number ?? "",
          warranty_start_date: t.warranty_start_date?.slice(0, 10) ?? "",
          warranty_end_date: t.warranty_end_date?.slice(0, 10) ?? "",
          amc_end_date: t.amc_end_date?.slice(0, 10) ?? "",
          asset_status: t.asset_status ?? "",
          amc_mail_sent: String(t.amc_mail_sent ?? false),
          software_version: t.software_version ?? "",
          issue_description: t.issue_description ?? "",
          reference_sr_number: t.reference_sr_number ?? "",
          customer_reference: t.customer_reference ?? "",
          lsi: t.lsi ?? "",
          end_customer_name: t.end_customer_name ?? "",
          end_customer_email: t.end_customer_email ?? "",
          coordinator_name: t.coordinator_name ?? "",
          coordinator_phone: t.coordinator_phone ?? "",
          end_customer_street: t.end_customer_street ?? "",
          end_customer_state: t.end_customer_state ?? "",
          end_customer_city: t.end_customer_city ?? "",
          end_customer_city_type: t.end_customer_city_type ?? "",
          end_customer_other_city: t.end_customer_other_city ?? "",
          end_customer_gst: t.end_customer_gst ?? "",
          end_customer_postal_code: t.end_customer_postal_code ?? "",
          start_work_date: t.start_work_date?.slice(0, 16) ?? "",
          due_at: t.due_at?.slice(0, 16) ?? "",
          classification: t.classification ?? "",
          escalation_reason: t.escalation_reason ?? "",
          next_plan: t.next_plan ?? "",
          additional_description: t.additional_description ?? "",
          oem_support_enabled: String(t.oem_support_enabled ?? false),
          fe_engineer_name: t.field_engineer?.engineer_name ?? "",
          fe_engineer_contact: t.field_engineer?.engineer_contact ?? "",
          fe_distance: t.field_engineer?.distance ?? "",
          fe_visits_count: t.field_engineer?.visits_count != null ? String(t.field_engineer.visits_count) : "",
          fe_carrying_spares: String(t.field_engineer?.carrying_spares ?? false),
          fe_visit_date: t.field_engineer?.visit_date?.slice(0, 10) ?? "",
          fe_hw_replacement: t.field_engineer?.hw_replacement ?? "",
          fe_transport_mode: t.field_engineer?.transport_mode ?? "",
          fe_movement_charges: t.field_engineer?.movement_charges != null ? String(t.field_engineer.movement_charges) : "",
          fe_visit_charges: t.field_engineer?.visit_charges != null ? String(t.field_engineer.visit_charges) : "",
          fe_total_charges: t.field_engineer?.total_charges != null ? String(t.field_engineer.total_charges) : "",
          fe_remarks: t.field_engineer?.remarks ?? "",
          fe_payment_approval: t.field_engineer?.payment_approval ?? "",
          oem_name: t.oem_support?.oem_name ?? "",
          oem_ticket_number: t.oem_support?.oem_ticket_number ?? "",
          oem_customer_reference: t.oem_support?.customer_reference ?? "",
          oem_ticket_type: t.oem_support?.ticket_type ?? "",
          oem_engineer_contact: t.oem_support?.oem_engineer_contact ?? "",
          oem_tac_response_summary: t.oem_support?.tac_response_summary ?? "",
          oem_tac_resolution: t.oem_support?.tac_resolution ?? "",
          oem_status: t.oem_support?.oem_status ?? "",
          oem_last_checked_at: t.oem_support?.last_checked_at?.slice(0, 16) ?? "",
        });
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load ticket");
      } finally {
        setLoading(false);
      }
    })();
  }, [ticketId]);

  const showFe = form.mode_of_action === "onsite_support";
  const showOem = form.oem_support_enabled === "true";

  const buildPayload = useCallback(() => {
    const nullIfEmpty = (v: string) => (v.trim() === "" ? undefined : v.trim());
    const payload: Record<string, unknown> = {
      branch_id: form.branch_id,
      category_id: form.category_id,
      customer_id: form.customer_id,
      mode_of_action: form.mode_of_action,
      service_type: form.service_type,
      subject: form.subject.trim(),
      contact_name: form.contact_name.trim(),
      status: form.status,
      priority: form.priority,
      channel: form.channel,
      ticket_category: form.ticket_category,
      sla_status: form.sla_status,
      email: nullIfEmpty(form.email),
      alternate_email: nullIfEmpty(form.alternate_email),
      mobile: nullIfEmpty(form.mobile),
      software_version: nullIfEmpty(form.software_version),
      issue_description: nullIfEmpty(form.issue_description),
      reference_sr_number: nullIfEmpty(form.reference_sr_number),
      customer_reference: nullIfEmpty(form.customer_reference),
      lsi: nullIfEmpty(form.lsi),
      end_customer_name: nullIfEmpty(form.end_customer_name),
      end_customer_email: nullIfEmpty(form.end_customer_email),
      coordinator_name: nullIfEmpty(form.coordinator_name),
      coordinator_phone: nullIfEmpty(form.coordinator_phone),
      end_customer_street: nullIfEmpty(form.end_customer_street),
      end_customer_state: nullIfEmpty(form.end_customer_state),
      end_customer_city: nullIfEmpty(form.end_customer_city),
      end_customer_city_type: nullIfEmpty(form.end_customer_city_type),
      end_customer_other_city: nullIfEmpty(form.end_customer_other_city),
      end_customer_gst: nullIfEmpty(form.end_customer_gst),
      end_customer_postal_code: nullIfEmpty(form.end_customer_postal_code),
      start_work_date: nullIfEmpty(form.start_work_date),
      due_at: nullIfEmpty(form.due_at),
      classification: nullIfEmpty(form.classification),
      escalation_reason: nullIfEmpty(form.escalation_reason),
      next_plan: nullIfEmpty(form.next_plan),
      additional_description: nullIfEmpty(form.additional_description),
      oem_support_enabled: form.oem_support_enabled === "true",
      asset_name: nullIfEmpty(form.asset_name),
      serial_number: nullIfEmpty(form.serial_number),
      warranty_start_date: nullIfEmpty(form.warranty_start_date),
      warranty_end_date: nullIfEmpty(form.warranty_end_date),
      amc_end_date: nullIfEmpty(form.amc_end_date),
      asset_status: nullIfEmpty(form.asset_status),
      amc_mail_sent: form.amc_mail_sent === "true",
    };
    const ownerId = nullIfEmpty(form.owner_employee_id);
    const productId = nullIfEmpty(form.product_id);
    if (ownerId) payload.owner_employee_id = ownerId;
    if (productId) payload.product_id = productId;
    if (showFe) {
      payload.field_engineer = {
        engineer_name: nullIfEmpty(form.fe_engineer_name),
        engineer_contact: nullIfEmpty(form.fe_engineer_contact),
        distance: nullIfEmpty(form.fe_distance),
        visits_count: form.fe_visits_count ? Number(form.fe_visits_count) : null,
        carrying_spares: form.fe_carrying_spares === "true",
        visit_date: nullIfEmpty(form.fe_visit_date),
        hw_replacement: nullIfEmpty(form.fe_hw_replacement),
        transport_mode: nullIfEmpty(form.fe_transport_mode),
        movement_charges: form.fe_movement_charges ? Number(form.fe_movement_charges) : null,
        visit_charges: form.fe_visit_charges ? Number(form.fe_visit_charges) : null,
        total_charges: form.fe_total_charges ? Number(form.fe_total_charges) : null,
        remarks: nullIfEmpty(form.fe_remarks),
        payment_approval: nullIfEmpty(form.fe_payment_approval),
      };
    }
    if (showOem) {
      payload.oem_support = {
        oem_name: nullIfEmpty(form.oem_name),
        oem_ticket_number: nullIfEmpty(form.oem_ticket_number),
        customer_reference: nullIfEmpty(form.oem_customer_reference),
        ticket_type: nullIfEmpty(form.oem_ticket_type),
        oem_engineer_contact: nullIfEmpty(form.oem_engineer_contact),
        tac_response_summary: nullIfEmpty(form.oem_tac_response_summary),
        tac_resolution: nullIfEmpty(form.oem_tac_resolution),
        oem_status: nullIfEmpty(form.oem_status),
        last_checked_at: nullIfEmpty(form.oem_last_checked_at),
      };
    }
    return payload;
  }, [form, showFe, showOem]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (!payload.branch_id || !payload.category_id || !payload.customer_id) {
        setError("Branch, category, and customer are required. Wait for dropdowns to load or refresh the page.");
        setSaving(false);
        return;
      }
      if (!payload.subject || !payload.contact_name || !payload.priority || !payload.channel || !payload.ticket_category || !payload.sla_status || !payload.issue_description) {
        setError("Please fill all mandatory fields (subject, contact, priority, channel, category, SLA, issue description).");
        setSaving(false);
        return;
      }
      if (isEdit && ticketId) {
        await updateServiceRequestTicket(ticketId, payload);
        router.push(`/service/service-request-tickets/${ticketId}`);
      } else {
        const saved = await createServiceRequestTicket(payload);
        router.push(`/service/service-request-tickets/${saved.id}`);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        const detail = err.errors.length > 0 ? err.errors.join("; ") : err.message;
        setError(detail);
      } else {
        setError("Failed to save ticket");
      }
    } finally {
      setSaving(false);
    }
  };

  const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

  if (loading || lookupsLoading) {
    return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={isEdit ? "Edit Service Request Ticket" : "Create Service Request Ticket"}
        description="Complete all sections per the SOP before submitting."
        actions={
          <div className="flex gap-2">
            <Link
              href={isEdit && ticketId ? `/service/service-request-tickets/${ticketId}` : "/service/service-request-tickets"}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Link>
            <Button type="button" size="sm" onClick={() => void onSave()} disabled={saving}>
              <Save className="size-3.5" />
              {saving ? "Saving…" : "Submit"}
            </Button>
          </div>
        }
      />

      {lookupError ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {lookupError}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      ) : null}

      <div className="space-y-4">
        <Section title="Section 1 — Basic Information">
          <Field label="Mode of Action" required>
            <select className={selectCls} value={form.mode_of_action} onChange={(e) => set("mode_of_action", e.target.value)}>
              <option value="remote_support">Remote Support</option>
              <option value="onsite_support">Onsite Support</option>
            </select>
          </Field>
          <Field label="Service Request Type" required>
            <select className={selectCls} value={form.service_type} onChange={(e) => set("service_type", e.target.value)}>
              <option value="managed_services">Managed Services</option>
              <option value="corrective">Corrective</option>
              <option value="breakdown">Breakdown</option>
              <option value="installation">Installation</option>
            </select>
          </Field>
          <Field label="Subject" required><Input value={form.subject} onChange={(e) => set("subject", e.target.value)} /></Field>
          <Field label="Contact Name" required><Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} /></Field>
          <Field label="Status" required>
            <select className={selectCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="ticket_registered">Ticket Registered</option>
              <option value="assigned">Assigned</option>
            </select>
          </Field>
          <Field label="Priority" required>
            <select className={selectCls} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              {["p1", "p2", "p3", "p4"].map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>
          </Field>
          <Field label="Account (Customer)" required>
            <SelectField
              value={form.customer_id}
              onChange={(v) => set("customer_id", v)}
              options={customers}
              placeholder="Select customer…"
              required
            />
          </Field>
          <Field label="Branch" required>
            <SelectField
              value={form.branch_id}
              onChange={(v) => set("branch_id", v)}
              options={branches}
              placeholder="Select branch…"
              required
            />
          </Field>
          <Field label="Ticket Owner">
            <SelectField
              value={form.owner_employee_id}
              onChange={(v) => set("owner_employee_id", v)}
              options={employees}
              placeholder="Select owner (optional)…"
            />
          </Field>
          <Field label="Product">
            <SelectField
              value={form.product_id}
              onChange={(v) => set("product_id", v)}
              options={products}
              placeholder="Select product (optional)…"
            />
          </Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Alternate Email"><Input type="email" value={form.alternate_email} onChange={(e) => set("alternate_email", e.target.value)} /></Field>
          <Field label="Mobile"><Input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} /></Field>
          <Field label="Category" required>
            <SelectField
              value={form.category_id}
              onChange={(v) => set("category_id", v)}
              options={categories}
              placeholder="Select category…"
              required
            />
          </Field>
        </Section>

        <Section title="Section 3 — Asset Details">
          <Field label="Asset Name"><Input value={form.asset_name} onChange={(e) => set("asset_name", e.target.value)} /></Field>
          <Field label="Serial Number"><Input value={form.serial_number} onChange={(e) => set("serial_number", e.target.value)} /></Field>
          <Field label="Warranty Start"><Input type="date" value={form.warranty_start_date} onChange={(e) => set("warranty_start_date", e.target.value)} /></Field>
          <Field label="Warranty End"><Input type="date" value={form.warranty_end_date} onChange={(e) => set("warranty_end_date", e.target.value)} /></Field>
          <Field label="AMC End"><Input type="date" value={form.amc_end_date} onChange={(e) => set("amc_end_date", e.target.value)} /></Field>
          <Field label="Asset Status">
            <select className={selectCls} value={form.asset_status} onChange={(e) => set("asset_status", e.target.value)}>
              <option value="new_asset">New Asset</option>
              <option value="existing_asset">Existing Asset</option>
            </select>
          </Field>
        </Section>

        <Section title="Section 4 — Ticket Information">
          <Field label="Category of Ticket" required>
            <select className={selectCls} value={form.ticket_category} onChange={(e) => set("ticket_category", e.target.value)}>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="network">Network</option>
            </select>
          </Field>
          <Field label="SLA Status" required>
            <select className={selectCls} value={form.sla_status} onChange={(e) => set("sla_status", e.target.value)}>
              <option value="within_sla">Within SLA</option>
              <option value="at_risk">At Risk</option>
              <option value="breached">Breached</option>
            </select>
          </Field>
          <Field label="Software Version"><Input value={form.software_version} onChange={(e) => set("software_version", e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Issue Description" required>
              <textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.issue_description} onChange={(e) => set("issue_description", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Section 5 — Reference Information">
          <Field label="Service Request Number"><Input value={form.reference_sr_number} onChange={(e) => set("reference_sr_number", e.target.value)} /></Field>
          <Field label="Customer Reference / LSI"><Input value={form.lsi} onChange={(e) => set("lsi", e.target.value)} /></Field>
        </Section>

        <Section title="Section 6 — End Customer Details">
          <Field label="Customer Name"><Input value={form.end_customer_name} onChange={(e) => set("end_customer_name", e.target.value)} /></Field>
          <Field label="Email"><Input value={form.end_customer_email} onChange={(e) => set("end_customer_email", e.target.value)} /></Field>
          <Field label="Coordinator"><Input value={form.coordinator_name} onChange={(e) => set("coordinator_name", e.target.value)} /></Field>
          <Field label="Phone"><Input value={form.coordinator_phone} onChange={(e) => set("coordinator_phone", e.target.value)} /></Field>
          <Field label="Street"><Input value={form.end_customer_street} onChange={(e) => set("end_customer_street", e.target.value)} /></Field>
          <Field label="State"><Input value={form.end_customer_state} onChange={(e) => set("end_customer_state", e.target.value)} /></Field>
          <Field label="City"><Input value={form.end_customer_city} onChange={(e) => set("end_customer_city", e.target.value)} /></Field>
          <Field label="GST"><Input value={form.end_customer_gst} onChange={(e) => set("end_customer_gst", e.target.value)} /></Field>
          <Field label="Postal Code"><Input value={form.end_customer_postal_code} onChange={(e) => set("end_customer_postal_code", e.target.value)} /></Field>
        </Section>

        <Section title="Section 7 — Additional Information">
          <Field label="Start Work Date"><Input type="datetime-local" value={form.start_work_date} onChange={(e) => set("start_work_date", e.target.value)} /></Field>
          <Field label="Due Date"><Input type="datetime-local" value={form.due_at} onChange={(e) => set("due_at", e.target.value)} /></Field>
          <Field label="Channel" required>
            <select className={selectCls} value={form.channel} onChange={(e) => set("channel", e.target.value)}>
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="portal">Portal</option>
            </select>
          </Field>
          <Field label="Classification">
            <select className={selectCls} value={form.classification} onChange={(e) => set("classification", e.target.value)}>
              <option value="question">Question</option>
              <option value="incident">Incident</option>
              <option value="service_request">Service Request</option>
            </select>
          </Field>
          <Field label="Escalation Reason"><Input value={form.escalation_reason} onChange={(e) => set("escalation_reason", e.target.value)} /></Field>
          <Field label="Next Plan"><Input value={form.next_plan} onChange={(e) => set("next_plan", e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.additional_description} onChange={(e) => set("additional_description", e.target.value)} />
            </Field>
          </div>
          <Field label="OEM Support Enabled">
            <select className={selectCls} value={form.oem_support_enabled} onChange={(e) => set("oem_support_enabled", e.target.value)}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </Field>
        </Section>

        {showFe ? (
          <Section title="Section 9 — Field Engineer Visit">
            <Field label="Engineer Name"><Input value={form.fe_engineer_name} onChange={(e) => set("fe_engineer_name", e.target.value)} /></Field>
            <Field label="Engineer Contact"><Input value={form.fe_engineer_contact} onChange={(e) => set("fe_engineer_contact", e.target.value)} /></Field>
            <Field label="Distance"><Input value={form.fe_distance} onChange={(e) => set("fe_distance", e.target.value)} /></Field>
            <Field label="Number of Visits"><Input type="number" value={form.fe_visits_count} onChange={(e) => set("fe_visits_count", e.target.value)} /></Field>
            <Field label="Visit Date"><Input type="date" value={form.fe_visit_date} onChange={(e) => set("fe_visit_date", e.target.value)} /></Field>
            <Field label="Total Charges"><Input type="number" value={form.fe_total_charges} onChange={(e) => set("fe_total_charges", e.target.value)} /></Field>
            <div className="sm:col-span-2">
              <Field label="Remarks"><textarea className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.fe_remarks} onChange={(e) => set("fe_remarks", e.target.value)} /></Field>
            </div>
          </Section>
        ) : null}

        {showOem ? (
          <Section title="Section 10 — OEM Support">
            <Field label="OEM Name"><Input value={form.oem_name} onChange={(e) => set("oem_name", e.target.value)} /></Field>
            <Field label="OEM Ticket Number"><Input value={form.oem_ticket_number} onChange={(e) => set("oem_ticket_number", e.target.value)} /></Field>
            <Field label="Ticket Type">
              <select className={selectCls} value={form.oem_ticket_type} onChange={(e) => set("oem_ticket_type", e.target.value)}>
                <option value="technical">Technical</option>
                <option value="rma">RMA</option>
                <option value="configuration">Configuration</option>
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
              </select>
            </Field>
            <Field label="OEM Engineer Contact"><Input value={form.oem_engineer_contact} onChange={(e) => set("oem_engineer_contact", e.target.value)} /></Field>
            <div className="sm:col-span-2">
              <Field label="OEM TAC Response Summary">
                <textarea className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.oem_tac_response_summary} onChange={(e) => set("oem_tac_response_summary", e.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="OEM TAC Resolution">
                <textarea className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.oem_tac_resolution} onChange={(e) => set("oem_tac_resolution", e.target.value)} />
              </Field>
            </div>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
