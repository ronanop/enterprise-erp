"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  CrmErrorBanner,
  CrmPage,
} from "@/components/crm/crm-ui";
import { ApprovalBanner, SyncedBanner } from "@/components/crm/sales/approval-banner";
import { BlueprintActions } from "@/components/crm/sales/blueprint-actions";
import { DealTimeline, DealTimelineStatusBadge } from "@/components/crm/sales/deal-timeline";
import { LeadDetailsCard } from "@/components/crm/sales/lead-details-card";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceField, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
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
  listCrmMemberOptions,
  listLeadSourceOptions,
  markLeadLost,
  type BlueprintState,
  type Company,
  type Option,
  type SalesLead,
} from "@/services/sales-crm-service";

export function LeadDetailPage({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [lead, setLead] = useState<SalesLead | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [leadSources, setLeadSources] = useState<Option[]>([]);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const [convertOpen, setConvertOpen] = useState(false);
  const [convertForm, setConvertForm] = useState({
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
      const [leadRow, bp, employeeOptions, leadSourceOptions] = await Promise.all([
        getSalesLead(leadId),
        getLeadBlueprint(leadId),
        listCrmMemberOptions().catch(() => [] as Option[]),
        listLeadSourceOptions().catch(() => [] as Option[]),
      ]);
      setLead(leadRow);
      setBlueprint(bp);
      setEmployees(employeeOptions);
      setLeadSources(leadSourceOptions);
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

  function openConvert() {
    setConvertError(null);
    setConvertOpen(true);
  }

  async function submitConvert() {
    if (!lead) return;
    if (!convertForm.opportunity_name.trim() || !convertForm.remark.trim()) {
      setConvertError("Opportunity name and remark are required.");
      return;
    }
    setConverting(true);
    setConvertError(null);
    try {
      const opp = await convertLead(lead.id, {
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
  const timelineLinks = {
    ...(lead.company_account_id ? { company: `/crm/companies/${lead.company_account_id}` } : {}),
    lead: `/crm/leads/${lead.id}`,
    ...(lead.converted_opportunity_id
      ? { opportunity: `/crm/opportunities/${lead.converted_opportunity_id}` }
      : {}),
  };

  return (
    <CrmPage>
      <div>
        <Link
          href="/crm/leads"
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
        >
          <ArrowLeft className="size-3.5" /> Leads
        </Link>
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
            <DealTimelineStatusBadge stage={converted ? "opportunity" : "lead"} lost={lost} />
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

      <LeadDetailsCard
        lead={lead}
        company={company}
        employees={employees}
        leadSources={leadSources}
      />

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
