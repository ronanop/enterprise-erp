"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  CrmErrorBanner,
  CrmPage,
} from "@/components/crm/crm-ui";
import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { BlueprintActions } from "@/components/crm/sales/blueprint-actions";
import { resolveSalesStageLabel } from "@/lib/crm/sales-blueprint-stages";
import { CrmDetailEditLink } from "@/components/crm/sales/crm-detail-edit-link";
import { CrmRecordActionsMenu } from "@/components/crm/sales/crm-record-actions-menu";
import { LeadDetailsCard } from "@/components/crm/sales/lead-details-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { cloneLeadRecord, printLeadPreview } from "@/lib/crm/crm-record-actions";
import { ApiClientError } from "@/services/api-client";
import {
  convertLead,
  deleteLead,
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
  const [banner, setBanner] = useState<{ text: string; tone: "error" } | null>(null);

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

  async function onBlueprintAction(action: string, payload: Record<string, unknown>) {
    if (!lead) return;
    if (action === "convert") {
      const opp = await convertLead(lead.id, {});
      router.push(`/crm/opportunities/${opp.id}`);
      return;
    }
    if (action === "lost") {
      await markLeadLost(lead.id, String(payload.reason ?? payload.remark ?? ""));
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

  const converted = blueprint.state === "converted" && Boolean(lead.converted_opportunity_id);

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

      <ApprovalBanner locked={blueprint.locked} label="This lead" />

      <PageHeader
        title={`${fullName(lead)} · ${lead.lead_code}`}
        description={
          lead.expected_amount
            ? `Expected amount ${formatInr(lead.expected_amount)}`
            : "No expected amount captured"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {lead.company_account_id ? (
              <CrmDetailEditLink
                href={`/crm/companies/${lead.company_account_id}/leads/${lead.id}/edit`}
              />
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
            <CrmRecordActionsMenu
              entityType="lead"
              entityId={lead.id}
              entityLabel="Lead"
              entityName={`${fullName(lead)} · ${lead.lead_code}`}
              shareTitle={`${fullName(lead)} · ${lead.lead_code}`}
              cloneDisabled={!lead.company_account_id}
              onClone={() => cloneLeadRecord(lead, router)}
              onPrintPreview={async () => printLeadPreview(lead, company?.customer_name)}
              onDelete={() => deleteLead(lead.id)}
              onDeleted={() =>
                router.push(lead.company_account_id ? `/crm/companies/${lead.company_account_id}` : "/crm/leads")
              }
            />
          </div>
        }
      />

      {banner ? <CrmErrorBanner>{banner.text}</CrmErrorBanner> : null}

      <BlueprintActions
        allowedActions={blueprint.allowed_actions}
        locked={blueprint.locked}
        currentStageLabel={resolveSalesStageLabel({
          entityType: "lead",
          blueprintState: blueprint.state,
          locked: blueprint.locked,
          lead,
        })}
        onAction={onBlueprintAction}
      />

      <LeadDetailsCard
        lead={lead}
        company={company}
        employees={employees}
        leadSources={leadSources}
      />
    </CrmPage>
  );
}
