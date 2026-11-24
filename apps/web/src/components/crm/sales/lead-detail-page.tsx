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
import { leadPresalesCallReady } from "@/components/crm/sales/lead-presales-call-section";
import { PageHeader } from "@/components/layout/page-header";
import { cloneLeadRecord, downloadLeadExport, printLeadPreview } from "@/lib/crm/crm-record-actions";
import { formatCrmCode } from "@/lib/crm/format-crm-code";
import { ApiClientError } from "@/services/api-client";
import { listCompanyGst } from "@/services/crm-deal-controls-service";
import {
  deleteLead,
  fullName,
  getCompany,
  getLeadBlueprint,
  getSalesLead,
  listCrmMemberOptions,
  listLeadSourceOptions,
  listMarketingEventOptions,
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
  const [companyGstin, setCompanyGstin] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [leadSources, setLeadSources] = useState<Option[]>([]);
  const [marketingEvents, setMarketingEvents] = useState<Option[]>([]);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Blueprint GET may auto-convert once BOQ/SOW are attached — run it first, then
      // reload the lead so we can open the opportunity Transitions (OEM next, …).
      const bp = await getLeadBlueprint(leadId);
      const leadRow = await getSalesLead(leadId);
      const [employeeOptions, leadSourceOptions, marketingEventOptions] = await Promise.all([
        listCrmMemberOptions().catch(() => [] as Option[]),
        listLeadSourceOptions(leadRow.company_id).catch(() => [] as Option[]),
        listMarketingEventOptions().catch(() => [] as Option[]),
      ]);

      const opportunityId = leadRow.converted_opportunity_id;
      if (
        opportunityId &&
        (leadRow.blueprint_state === "converted" || bp.state === "converted")
      ) {
        router.replace(`/crm/opportunities/${opportunityId}`);
        return;
      }

      setLead(leadRow);
      setBlueprint(bp);
      setEmployees(employeeOptions);
      setLeadSources(leadSourceOptions);
      setMarketingEvents(marketingEventOptions);
      setCompany(
        leadRow.company_account_id
          ? await getCompany(leadRow.company_account_id).catch(() => null)
          : null,
      );
      if (leadRow.company_account_id) {
        const gstRows = await listCompanyGst(leadRow.company_account_id).catch(() => []);
        setCompanyGstin(
          (gstRows.find((row) => row.is_head_office) ?? gstRows[0])?.gstin?.trim() ?? null,
        );
      } else {
        setCompanyGstin(null);
      }
    } catch (err) {
      setLead(null);
      setCompanyGstin(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load lead");
    } finally {
      setLoading(false);
    }
  }, [leadId, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function onBlueprintAction(action: string, payload: Record<string, unknown>) {
    if (!lead) return;
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

      <ApprovalBanner
        locked={blueprint.locked || !leadPresalesCallReady(lead)}
        label="This lead"
        reason={
          !leadPresalesCallReady(lead)
            ? "waiting for PreSales call alignment (Yes + contact person) before BOQ / SOW can be attached."
            : (lead.requires_boq && !lead.boq_attached) || (lead.requires_sow && !lead.sow_attached)
              ? `waiting for ${[
                lead.requires_boq && !lead.boq_attached ? "BOQ" : null,
                lead.requires_sow && !lead.sow_attached ? "SOW" : null,
              ]
                .filter(Boolean)
                .join(" and ")} attachment in My Jobs — converts to an opportunity automatically when complete.`
              : null
        }
      />

      <PageHeader
        title={`${fullName(lead)} · ${formatCrmCode(lead.lead_code)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {lead.company_account_id ? (
              <CrmDetailEditLink
                href={`/crm/companies/${lead.company_account_id}/edit-lead/${lead.id}`}
              />
            ) : null}
            <CrmRecordActionsMenu
              entityType="lead"
              entityId={lead.id}
              entityLabel="Lead"
              entityName={`${fullName(lead)} · ${formatCrmCode(lead.lead_code)}`}
              shareTitle={`${fullName(lead)} · ${formatCrmCode(lead.lead_code)}`}
              cloneDisabled={!lead.company_account_id}
              onClone={() => cloneLeadRecord(lead, router)}
              onPrintPreview={async () => printLeadPreview(lead, company?.customer_name)}
              onExport={async () => downloadLeadExport(lead, company?.customer_name)}
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
        excludeActions={["convert"]}
        onAction={onBlueprintAction}
      />

      <LeadDetailsCard
        lead={lead}
        company={company}
        companyGstin={companyGstin}
        employees={employees}
        leadSources={leadSources}
        marketingEvents={marketingEvents}
        showPresalesCallGate
        onLeadUpdated={() => {
          void load();
        }}
      />
    </CrmPage>
  );
}
