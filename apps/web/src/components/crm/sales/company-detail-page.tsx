"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, RefreshCw, Target } from "lucide-react";

import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { CompanyFormDialog } from "@/components/crm/sales/company-form-dialog";
import { DealTimeline, type DealStage } from "@/components/crm/sales/deal-timeline";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  fullName,
  getCompany,
  listSalesLeads,
  type Company,
  type SalesLead,
} from "@/services/sales-crm-service";

export function CompanyDetailPage({ companyAccountId }: { companyAccountId: string }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companyRow, allLeads] = await Promise.all([
        getCompany(companyAccountId),
        listSalesLeads().catch(() => [] as SalesLead[]),
      ]);
      setCompany(companyRow);
      setLeads(allLeads.filter((l) => l.company_account_id === companyAccountId));
    } catch (err) {
      setCompany(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load company");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !company) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="space-y-3">
        <Link href="/crm/companies" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary">
          <ArrowLeft className="size-3.5" /> Back to Company
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error ?? "Company not found"}
        </div>
      </div>
    );
  }

  const hasOpenLead = leads.some((l) => l.blueprint_state === "open");
  const activeLead = leads.find((lead) => lead.blueprint_state === "open") ?? leads[0];
  const timelineStage: DealStage = activeLead?.converted_opportunity_id
    ? "opportunity"
    : activeLead
      ? "lead"
      : "company";
  const timelineLinks = {
    company: `/crm/companies/${company.id}`,
    ...(activeLead ? { lead: `/crm/leads/${activeLead.id}` } : {}),
    ...(activeLead?.converted_opportunity_id
      ? { opportunity: `/crm/opportunities/${activeLead.converted_opportunity_id}` }
      : {}),
  };
  const nextStep = activeLead?.converted_opportunity_id
    ? {
        label: "Continue Opportunity",
        description: "Resume BOQ, OEM, Quote, Customer PO, and OVF actions.",
        href: `/crm/opportunities/${activeLead.converted_opportunity_id}`,
      }
    : activeLead
      ? {
          label: "Continue Lead",
          description: "Review this lead and convert it to an opportunity when qualified.",
          href: `/crm/leads/${activeLead.id}`,
        }
      : company.status === "active"
        ? {
            label: "Create Lead",
            description: "Start the sales blueprint from this company account.",
            href: `/crm/companies/${company.id}/leads/new`,
          }
        : undefined;

  return (
    <div className="space-y-4">
      <Link href="/crm/companies" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80">
        <ArrowLeft className="size-3.5" /> Company
      </Link>

      <DealTimeline current={timelineStage} links={timelineLinks} nextStep={nextStep} />
      <ApprovalBanner locked={company.locked} label="This company account" />

      <PageHeader
        title={company.customer_name}
        description={`Account ${company.account_number} · ${company.industry}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
            {hasOpenLead || company.status !== "active" ? (
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                disabled
                title={
                  hasOpenLead
                    ? "This company already has an open lead in progress"
                    : "Company account must be active to create a lead"
                }
              >
                <Plus className="size-3.5" /> Create Lead
              </Button>
            ) : (
              <Link
                href={`/crm/companies/${company.id}/leads/new`}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
              >
                <Plus className="size-3.5" /> Create Lead
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-medium tracking-tight">Account Info</h2>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-1"><FinanceStatusBadge status={company.status} /></dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rating</dt>
              <dd className="mt-1 capitalize">{company.rating ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Account Type</dt>
              <dd className="mt-1 capitalize">{company.account_type ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Source</dt>
              <dd className="mt-1 capitalize">{company.source.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="mt-1">{company.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-1">{company.customer_email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Website</dt>
              <dd className="mt-1">{company.website ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contact</dt>
              <dd className="mt-1">
                {[company.first_name, company.last_name].filter(Boolean).join(" ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Portal ID</dt>
              <dd className="mt-1">{company.portal_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Customer ID</dt>
              <dd className="mt-1">{company.customer_id_ext ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="mt-1">{company.role ?? "—"}</dd>
            </div>
          </dl>

          <h3 className="pt-2 text-sm font-medium tracking-tight">Billing Address</h3>
          <p className="text-xs text-muted-foreground">
            {company.billing_street}, {company.billing_city}, {company.billing_state}{" "}
            {company.billing_code}, {company.billing_country}
          </p>
          {company.shipping_street ? (
            <>
              <h3 className="pt-2 text-sm font-medium tracking-tight">Shipping Address</h3>
              <p className="text-xs text-muted-foreground">
                {company.shipping_street}, {company.shipping_city}, {company.shipping_state}{" "}
                {company.shipping_code}, {company.shipping_country}
              </p>
            </>
          ) : null}
          {company.description ? (
            <>
              <h3 className="pt-2 text-sm font-medium tracking-tight">Description</h3>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{company.description}</p>
            </>
          ) : null}
        </section>

        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <h2 className="text-sm font-medium tracking-tight">Sales Blueprint</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Leads created from this company follow the Company → Lead → Opportunity → Quote → OVF →
            Won blueprint. Only one open lead is allowed at a time.
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-medium tracking-tight">
            <Target className="size-3.5" /> Leads from this company
          </h2>
          <Badge variant="secondary">{leads.length}</Badge>
        </div>
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Lead</th>
                <th className="px-4 py-2.5">Mobile</th>
                <th className="px-4 py-2.5">Blueprint State</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No leads yet — use “Create Lead” above to start the sales process.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <Link href={`/crm/leads/${lead.id}`} className="cursor-pointer hover:underline">
                        {fullName(lead)} · {lead.lead_code}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{lead.mobile}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="capitalize">
                        {lead.blueprint_state.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <FinanceStatusBadge status={lead.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <CompanyFormDialog
        open={editOpen}
        company={company}
        onClose={() => setEditOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}
