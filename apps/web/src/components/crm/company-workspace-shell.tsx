"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { CrmErrorBanner, CrmPage } from "@/components/crm/crm-ui";
import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { CompanyAccountActionsMenu } from "@/components/crm/sales/company-account-actions-menu";
import { CompanyWorkspaceNav } from "@/components/crm/company-workspace-nav";
import { PageHeader } from "@/components/layout/page-header";
import {
  getCrmOpportunityContext,
  getCrmSidebarFocus,
  isCompanyWorkspaceSectionPath,
  setCrmOpportunityContext,
  setCrmSidebarFocus,
} from "@/lib/crm-sidebar-focus";
import { ApiClientError } from "@/services/api-client";
import { getCompany, type Company } from "@/services/sales-crm-service";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromOpportunityId, setFromOpportunityId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return getCrmSidebarFocus() === "opportunities" ? getCrmOpportunityContext() : null;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const companyRow = await getCompany(companyAccountId);
      setCompany(companyRow);
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
  }, [load]);

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
              <div className="mt-3">
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
                      <Link
                        href={`/crm/companies/${company.id}/edit`}
                        className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors duration-200 hover:bg-muted/60"
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Link>
                      <CompanyAccountActionsMenu company={company} />
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
