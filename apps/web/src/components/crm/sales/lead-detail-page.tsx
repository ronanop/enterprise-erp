"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, UserPlus } from "lucide-react";

import {
  CrmDetailGrid,
  CrmDetailItem,
  CrmErrorBanner,
  CrmPage,
  CrmSection,
} from "@/components/crm/crm-ui";
import { ApprovalBanner, SyncedBanner } from "@/components/crm/sales/approval-banner";
import { BlueprintActions, BlueprintStateBadge } from "@/components/crm/sales/blueprint-actions";
import { DealTimeline } from "@/components/crm/sales/deal-timeline";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceField, FinanceSelect, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  convertLead,
  formatInr,
  fullName,
  getCompany,
  getLeadBlueprint,
  getSalesLead,
  listEmployeeOptions,
  listPipelineOptions,
  markLeadLost,
  type BlueprintState,
  type Company,
  type Option,
  type SalesLead,
} from "@/services/sales-crm-service";

function textOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
}

export function LeadDetailPage({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [lead, setLead] = useState<SalesLead | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const [convertOpen, setConvertOpen] = useState(false);
  const [pipelines, setPipelines] = useState<Option[]>([]);
  const [convertForm, setConvertForm] = useState({
    pipeline_id: "",
    opportunity_name: "",
    expected_revenue: "",
    remark: "",
  });
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [leadRow, bp, employeeOptions] = await Promise.all([
        getSalesLead(leadId),
        getLeadBlueprint(leadId),
        listEmployeeOptions().catch(() => [] as Option[]),
      ]);
      setLead(leadRow);
      setBlueprint(bp);
      setEmployees(employeeOptions);
      setCompany(
        leadRow.company_account_id
          ? await getCompany(leadRow.company_account_id).catch(() => null)
          : null,
      );
      setConvertForm((form) => ({
        ...form,
        opportunity_name:
          form.opportunity_name || leadRow.project_title || `${fullName(leadRow)} — Opportunity`,
        expected_revenue:
          form.expected_revenue || (leadRow.expected_amount ? String(leadRow.expected_amount) : ""),
      }));
    } catch (err) {
      setLead(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load lead");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function openConvert() {
    setConvertError(null);
    if (pipelines.length === 0) {
      const opts = await listPipelineOptions().catch(() => []);
      setPipelines(opts);
      if (opts[0]) setConvertForm((f) => ({ ...f, pipeline_id: f.pipeline_id || opts[0].id }));
    }
    setConvertOpen(true);
  }

  async function submitConvert() {
    if (!lead) return;
    if (!convertForm.pipeline_id || !convertForm.opportunity_name.trim() || !convertForm.remark.trim()) {
      setConvertError("Pipeline, opportunity name, and remark are required.");
      return;
    }
    setConverting(true);
    setConvertError(null);
    try {
      const opp = await convertLead(lead.id, {
        pipeline_id: convertForm.pipeline_id,
        opportunity_name: convertForm.opportunity_name.trim(),
        expected_revenue: convertForm.expected_revenue ? Number(convertForm.expected_revenue) : 0,
        remark: convertForm.remark.trim(),
      });
      router.push(`/crm/opportunities/${opp.id}`);
    } catch (err) {
      setConvertError(err instanceof ApiClientError ? err.message : "Failed to convert lead");
    } finally {
      setConverting(false);
    }
  }

  async function onBlueprintAction(action: string, payload: Record<string, unknown>) {
    if (!lead) return;
    if (action === "lost") {
      await markLeadLost(lead.id, String(payload.reason ?? payload.remark ?? ""));
      setBanner({ text: "Lead marked lost.", tone: "success" });
      await load();
    }
  }

  if (loading && !lead) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (error || !lead || !blueprint) {
    return (
      <CrmPage className="space-y-3">
        <Link href="/crm/leads" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary">
          <ArrowLeft className="size-3.5" /> Leads
        </Link>
        <CrmErrorBanner>{error ?? "Lead not found"}</CrmErrorBanner>
      </CrmPage>
    );
  }

  const lost = blueprint.state === "lost";
  const canConvert = blueprint.allowed_actions.includes("convert") && !blueprint.locked;
  const converted = blueprint.state === "converted" && Boolean(lead.converted_opportunity_id);
  const employeeName = (id: string | null | undefined) =>
    id ? employees.find((employee) => employee.id === id)?.label ?? id : "—";
  const timelineLinks = {
    ...(lead.company_account_id ? { company: `/crm/companies/${lead.company_account_id}` } : {}),
    lead: `/crm/leads/${lead.id}`,
    ...(lead.converted_opportunity_id
      ? { opportunity: `/crm/opportunities/${lead.converted_opportunity_id}` }
      : {}),
  };

  return (
    <CrmPage>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/crm/leads"
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
        >
          <ArrowLeft className="size-3.5" /> Leads
        </Link>
        <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()}>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      <DealTimeline
        current={converted ? "opportunity" : "lead"}
        lost={lost}
        links={timelineLinks}
        nextStep={
          converted && lead.converted_opportunity_id
            ? {
                label: "Continue Opportunity",
                description: "The lead is converted. Continue the blueprint on its opportunity.",
                href: `/crm/opportunities/${lead.converted_opportunity_id}`,
              }
            : canConvert
              ? {
                  label: "Convert to Opportunity",
                  description: "Use the conversion action on this screen to advance the deal.",
                }
              : undefined
        }
      />
      <ApprovalBanner locked={blueprint.locked} label="This lead" />
      {lead.company_account_id ? (
        <SyncedBanner from="Company" href={`/crm/companies/${lead.company_account_id}`} />
      ) : null}

      <PageHeader
        title={`${fullName(lead)} · ${lead.lead_code}`}
        description={
          lead.expected_amount
            ? `Expected amount ${formatInr(lead.expected_amount)}`
            : "No expected amount captured"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BlueprintStateBadge state={blueprint.state} />
            <FinanceStatusBadge status={lead.status} />
            {canConvert ? (
              <Button type="button" size="sm" className="cursor-pointer" onClick={() => void openConvert()}>
                Convert to Opportunity
              </Button>
            ) : null}
            {converted && lead.converted_opportunity_id ? (
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                onClick={() => router.push(`/crm/opportunities/${lead.converted_opportunity_id}`)}
              >
                Open Opportunity
              </Button>
            ) : null}
          </div>
        }
      />

      {banner ? (
        banner.tone === "error" ? (
          <CrmErrorBanner>{banner.text}</CrmErrorBanner>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-950">
            {banner.text}
          </div>
        )
      ) : null}

      <BlueprintActions
        allowedActions={blueprint.allowed_actions}
        locked={blueprint.locked}
        excludeActions={["convert"]}
        onAction={onBlueprintAction}
      />

      <CrmSection title="Lead Information" subtitle="Contact, ownership, and qualification" icon={UserPlus}>
        <CrmDetailGrid>
          <CrmDetailItem label="Lead Code">{lead.lead_code}</CrmDetailItem>
          <CrmDetailItem label="Blueprint State">
            <BlueprintStateBadge state={blueprint.state} />
          </CrmDetailItem>
          <CrmDetailItem label="Status">
            <FinanceStatusBadge status={lead.status} />
          </CrmDetailItem>
          <CrmDetailItem label="Salutation">{textOrDash(lead.salutation)}</CrmDetailItem>
          <CrmDetailItem label="First Name">{textOrDash(lead.first_name)}</CrmDetailItem>
          <CrmDetailItem label="Last Name">{textOrDash(lead.last_name)}</CrmDetailItem>
          <CrmDetailItem label="Mobile">{textOrDash(lead.mobile)}</CrmDetailItem>
          <CrmDetailItem label="Email">{textOrDash(lead.email)}</CrmDetailItem>
          <CrmDetailItem label="Owner">{employeeName(lead.owner_employee_id)}</CrmDetailItem>
          <CrmDetailItem label="Assign To">{employeeName(lead.assign_to_id)}</CrmDetailItem>
          <CrmDetailItem label="Assigned Date">{textOrDash(lead.assigned_date)}</CrmDetailItem>
          <CrmDetailItem label="Company Account">
            {lead.company_account_id ? (
              <Link
                href={`/crm/companies/${lead.company_account_id}`}
                className="cursor-pointer font-medium text-primary hover:underline"
              >
                {company?.customer_name ?? lead.company_account_id}
              </Link>
            ) : (
              "—"
            )}
          </CrmDetailItem>
          <CrmDetailItem label="Expected Amount">
            {lead.expected_amount != null ? formatInr(lead.expected_amount) : "—"}
          </CrmDetailItem>
          <CrmDetailItem label="Expected Closure">{textOrDash(lead.expected_closure_date)}</CrmDetailItem>
          <CrmDetailItem label="Engagement Score">{textOrDash(lead.engagement_score)}</CrmDetailItem>
          <CrmDetailItem label="Portal Link">{textOrDash(lead.portal_link)}</CrmDetailItem>
        </CrmDetailGrid>

        <h3 className="mt-4 border-t border-border/70 pt-3 text-sm font-medium tracking-tight">
          Opportunity / Product
        </h3>
        <CrmDetailGrid className="mt-3">
          <CrmDetailItem label="Project Title">{textOrDash(lead.project_title)}</CrmDetailItem>
          <CrmDetailItem label="Product Type">{textOrDash(lead.product_type)}</CrmDetailItem>
          <CrmDetailItem label="Sub Product Category">{textOrDash(lead.sub_product_category)}</CrmDetailItem>
          <CrmDetailItem label="Sub Product">{textOrDash(lead.sub_product)}</CrmDetailItem>
          <CrmDetailItem label="Sub Product Other">{textOrDash(lead.sub_product_other)}</CrmDetailItem>
          <CrmDetailItem label="Requirement Type">{textOrDash(lead.requirement_type)}</CrmDetailItem>
          <CrmDetailItem label="Purchase Model">{textOrDash(lead.purchase_model)}</CrmDetailItem>
          <CrmDetailItem label="Deal Type">{textOrDash(lead.deal_type)}</CrmDetailItem>
          <CrmDetailItem label="DR Number">{textOrDash(lead.dr_number)}</CrmDetailItem>
          <CrmDetailItem label="New DR Number">{textOrDash(lead.new_dr_number)}</CrmDetailItem>
          <CrmDetailItem label="Industry">{textOrDash(lead.industry)}</CrmDetailItem>
          <CrmDetailItem label="Territory">{textOrDash(lead.territory)}</CrmDetailItem>
          <CrmDetailItem label="Region">{textOrDash(lead.region)}</CrmDetailItem>
        </CrmDetailGrid>

        <h3 className="mt-4 border-t border-border/70 pt-3 text-sm font-medium tracking-tight">Address</h3>
        <CrmDetailGrid className="mt-3">
          <CrmDetailItem label="Street">{textOrDash(lead.street)}</CrmDetailItem>
          <CrmDetailItem label="City">{textOrDash(lead.city)}</CrmDetailItem>
          <CrmDetailItem label="State">{textOrDash(lead.state)}</CrmDetailItem>
          <CrmDetailItem label="Zip">{textOrDash(lead.zip)}</CrmDetailItem>
          <CrmDetailItem label="Country">{textOrDash(lead.country)}</CrmDetailItem>
        </CrmDetailGrid>

        <h3 className="mt-4 border-t border-border/70 pt-3 text-sm font-medium tracking-tight">OEM</h3>
        <CrmDetailGrid className="mt-3">
          <CrmDetailItem label="OEM Name">{textOrDash(lead.oem_name)}</CrmDetailItem>
          <CrmDetailItem label="OEM Contact Person">{textOrDash(lead.oem_contact_person)}</CrmDetailItem>
          <CrmDetailItem label="OEM Contact Number">{textOrDash(lead.oem_contact_number)}</CrmDetailItem>
          <CrmDetailItem label="OEM Contact Email">{textOrDash(lead.oem_contact_email)}</CrmDetailItem>
        </CrmDetailGrid>

        <h3 className="mt-4 border-t border-border/70 pt-3 text-sm font-medium tracking-tight">
          Distributor
        </h3>
        <CrmDetailGrid className="mt-3">
          <CrmDetailItem label="Distributor Name">{textOrDash(lead.distributor_name)}</CrmDetailItem>
          <CrmDetailItem label="Contact Person">{textOrDash(lead.distributor_contact_person)}</CrmDetailItem>
          <CrmDetailItem label="Contact">{textOrDash(lead.distributor_contact)}</CrmDetailItem>
          <CrmDetailItem label="Contact Email">{textOrDash(lead.distributor_contact_email)}</CrmDetailItem>
          <CrmDetailItem label="Department">{textOrDash(lead.distributor_department)}</CrmDetailItem>
        </CrmDetailGrid>

        <h3 className="mt-4 border-t border-border/70 pt-3 text-sm font-medium tracking-tight">
          End Customer
        </h3>
        <CrmDetailGrid className="mt-3">
          <CrmDetailItem label="End Customer Name">{textOrDash(lead.end_customer_name)}</CrmDetailItem>
          <CrmDetailItem label="End Customer Location">{textOrDash(lead.end_customer_location)}</CrmDetailItem>
        </CrmDetailGrid>

        <h3 className="mt-4 border-t border-border/70 pt-3 text-sm font-medium tracking-tight">Entity</h3>
        <CrmDetailGrid className="mt-3">
          <CrmDetailItem label="Entity Name">{textOrDash(lead.entity_name)}</CrmDetailItem>
          <CrmDetailItem label="Entity Email">{textOrDash(lead.entity_email)}</CrmDetailItem>
          <CrmDetailItem label="Entity Contact">{textOrDash(lead.entity_contact)}</CrmDetailItem>
          <CrmDetailItem label="Entity GST">{textOrDash(lead.entity_gst)}</CrmDetailItem>
          <CrmDetailItem label="Entity Address">
            <span className="whitespace-pre-wrap">{textOrDash(lead.entity_address)}</span>
          </CrmDetailItem>
        </CrmDetailGrid>

        <h3 className="mt-4 border-t border-border/70 pt-3 text-sm font-medium tracking-tight">Notes</h3>
        <CrmDetailGrid className="mt-3 grid-cols-1 lg:grid-cols-1">
          <CrmDetailItem label="Notes">
            <span className="whitespace-pre-wrap">{textOrDash(lead.notes)}</span>
          </CrmDetailItem>
          <CrmDetailItem label="Convert Remark">
            <span className="whitespace-pre-wrap">{textOrDash(lead.convert_remark)}</span>
          </CrmDetailItem>
          <CrmDetailItem label="Lost Reason">{textOrDash(lead.lost_reason)}</CrmDetailItem>
          {lead.converted_opportunity_id ? (
            <CrmDetailItem label="Converted Opportunity">
              <Link
                href={`/crm/opportunities/${lead.converted_opportunity_id}`}
                className="cursor-pointer font-medium text-primary hover:underline"
              >
                Open Opportunity
              </Link>
            </CrmDetailItem>
          ) : null}
        </CrmDetailGrid>
      </CrmSection>

      <ConfirmDialog
        open={convertOpen}
        title="Convert to Opportunity"
        description="A remark is required to convert this lead."
        confirmLabel={converting ? "Converting…" : "Convert"}
        busy={converting}
        onCancel={() => !converting && setConvertOpen(false)}
        onConfirm={() => void submitConvert()}
      >
        <div className="mt-3 space-y-3">
          <FinanceField label="Pipeline *">
            <FinanceSelect
              value={convertForm.pipeline_id}
              onChange={(e) => setConvertForm((f) => ({ ...f, pipeline_id: e.target.value }))}
            >
              <option value="">Select pipeline</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Opportunity Name *">
            <Input
              value={convertForm.opportunity_name}
              onChange={(e) => setConvertForm((f) => ({ ...f, opportunity_name: e.target.value }))}
            />
          </FinanceField>
          <FinanceField label="Expected Revenue (₹)">
            <Input
              type="number"
              min={0}
              value={convertForm.expected_revenue}
              onChange={(e) => setConvertForm((f) => ({ ...f, expected_revenue: e.target.value }))}
            />
          </FinanceField>
          <FinanceField label="Remark *">
            <FinanceTextarea
              value={convertForm.remark}
              onChange={(e) => setConvertForm((f) => ({ ...f, remark: e.target.value }))}
            />
          </FinanceField>
          {convertError ? <p className="text-xs text-destructive">{convertError}</p> : null}
        </div>
      </ConfirmDialog>
    </CrmPage>
  );
}
