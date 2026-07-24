"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Pencil, Plus, RefreshCw } from "lucide-react";

import { CrmErrorBanner, CrmPage } from "@/components/crm/crm-ui";
import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { CompanyWorkspaceNav } from "@/components/crm/company-workspace-nav";
import { DealTimeline, type DealStage } from "@/components/crm/sales/deal-timeline";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  getCrmOpportunityContext,
  getCrmSidebarFocus,
  isCompanyWorkspaceSectionPath,
  setCrmOpportunityContext,
  setCrmSidebarFocus,
} from "@/lib/crm-sidebar-focus";
import { ApiClientError } from "@/services/api-client";
import {
  getCompany,
  listSalesLeads,
  type Company,
  type SalesLead,
} from "@/services/sales-crm-service";

export function CompanyWorkspaceShell({
  companyAccountId,
  children,
  onCompanyChange,
}: {
  companyAccountId: string;
  children: ReactNode;
  onCompanyChange?: (company: Company | null) => void;
}) {
  const pathname = usePathname();
  const [company, setCompany] = useState<Company | null>(null);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [fromOpportunityId, setFromOpportunityId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return getCrmSidebarFocus() === "opportunities" ? getCrmOpportunityContext() : null;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companyRow, leadRows] = await Promise.all([
        getCompany(companyAccountId),
        listSalesLeads(companyAccountId).catch(() => [] as SalesLead[]),
      ]);
      setCompany(companyRow);
      setLeads(leadRows);
      onCompanyChange?.(companyRow);
    } catch (err) {
      setCompany(null);
      onCompanyChange?.(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load company");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId, onCompanyChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, refreshKey]);

  useEffect(() => {
    // Don't steal Opportunities focus when browsing deal docs from an opportunity.
    if (getCrmSidebarFocus() === "opportunities") {
      setFromOpportunityId(getCrmOpportunityContext());
      return;
    }
    setCrmSidebarFocus("company");
    setCrmOpportunityContext(null);
    setFromOpportunityId(null);
  }, [companyAccountId, pathname]);

  const isSection = isCompanyWorkspaceSectionPath(pathname);
  const hideWorkspaceNav = /\/leads\/new\/?$/.test(pathname);
  const backToOpportunity = Boolean(fromOpportunityId);
  const backHref = backToOpportunity
    ? `/crm/opportunities/${fromOpportunityId}`
    : isSection && company
      ? `/crm/companies/${company.id}`
      : "/crm/companies";
  const backLabel = backToOpportunity
    ? "Opportunity"
    : isSection && company
      ? company.customer_name
      : "Companies";

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
      <CrmPage className="space-y-3">
        <Link
          href={backHref}
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary"
        >
          <ArrowLeft className="size-3.5" /> Back to {backLabel}
        </Link>
        <CrmErrorBanner>{error ?? "Company not found"}</CrmErrorBanner>
      </CrmPage>
    );
  }

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
    <div className="flex min-w-0 items-start gap-0">
      {hideWorkspaceNav ? null : (
        <CompanyWorkspaceNav
          companyAccountId={company.id}
          scope={backToOpportunity ? "opportunity" : "company"}
          opportunityId={fromOpportunityId ?? undefined}
        />
      )}

      <div
        className={
          hideWorkspaceNav
            ? "min-w-0 flex-1 overflow-x-clip"
            : "min-w-0 flex-1 overflow-x-clip pl-4 sm:pl-6 lg:pl-8"
        }
      >
        <CrmPage>
          <div className="rounded-xl border border-border/80 bg-card/60 px-4 py-3 shadow-sm">
            <Link
              href={backHref}
              className="inline-flex max-w-full cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              <ArrowLeft className="size-3.5 shrink-0" />
              <span className="truncate">{backLabel}</span>
            </Link>

            {hideWorkspaceNav ? null : (
              <div className="mt-3 space-y-3">
                <DealTimeline current={timelineStage} links={timelineLinks} nextStep={nextStep} />
                <ApprovalBanner locked={company.locked} label="This company account" />
              </div>
            )}

            <div className="mt-3">
              <PageHeader
                title={hideWorkspaceNav ? "Create Lead" : company.customer_name}
                description={
                  hideWorkspaceNav
                    ? "The only supported entry point for a sales-process lead is from its parent company."
                    : `Account ${company.account_number} · ${company.industry}`
                }
                actions={
                  hideWorkspaceNav ? undefined : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => setRefreshKey((value) => value + 1)}
                      >
                        <RefreshCw className="size-3.5" /> Refresh
                      </Button>
                      <Link
                        href={`/crm/companies/${company.id}/edit`}
                        className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors duration-200 hover:bg-muted/60"
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Link>
                      {company.status !== "active" ? (
                        <Button
                          type="button"
                          size="sm"
                          className="cursor-pointer"
                          disabled
                          title="Company account must be active to create a lead"
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
                  )
                }
              />
            </div>
          </div>

          <div className="min-w-0">{children}</div>
        </CrmPage>
      </div>
    </div>
  );
}
