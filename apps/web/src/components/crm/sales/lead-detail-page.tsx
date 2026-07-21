"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";

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
  getLeadBlueprint,
  getSalesLead,
  listPipelineOptions,
  markLeadLost,
  type BlueprintState,
  type Option,
  type SalesLead,
} from "@/services/sales-crm-service";

export function LeadDetailPage({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [lead, setLead] = useState<SalesLead | null>(null);
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
      const [leadRow, bp] = await Promise.all([getSalesLead(leadId), getLeadBlueprint(leadId)]);
      setLead(leadRow);
      setBlueprint(bp);
      setConvertForm((f) => ({ ...f, opportunity_name: f.opportunity_name || `${fullName(leadRow)} — Opportunity` }));
    } catch (err) {
      setLead(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load lead");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
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
      return;
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
      <div className="space-y-3">
        <Link href="/crm/leads" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary">
          <ArrowLeft className="size-3.5" /> Leads
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error ?? "Lead not found"}
        </div>
      </div>
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/crm/leads" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80">
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
        description={lead.expected_amount ? `Expected amount ${formatInr(lead.expected_amount)}` : "No expected amount captured"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BlueprintStateBadge state={blueprint.state} />
            {canConvert ? (
              <Button type="button" size="sm" className="cursor-pointer" onClick={() => void openConvert()}>
                Convert to Opportunity
              </Button>
            ) : null}
          </div>
        }
      />

      {banner ? (
        <div
          className={`rounded-xl px-4 py-2.5 text-sm ${
            banner.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <BlueprintActions
        allowedActions={blueprint.allowed_actions}
        locked={blueprint.locked}
        excludeActions={["convert"]}
        onAction={onBlueprintAction}
      />

      <section className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Mobile</dt>
          <dd className="text-sm">{lead.mobile}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Email</dt>
          <dd className="text-sm">{lead.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd className="mt-0.5"><FinanceStatusBadge status={lead.status} /></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Expected Closure</dt>
          <dd className="text-sm">{lead.expected_closure_date ?? "—"}</dd>
        </div>
      </section>

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
    </div>
  );
}
