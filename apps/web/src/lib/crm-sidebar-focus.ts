"use client";

/** Per-tab CRM left-sidebar highlight context (e.g. stay on Opportunities while browsing company docs). */
const CRM_SIDEBAR_FOCUS_KEY = "crm-sidebar-focus";
const CRM_OPPORTUNITY_CONTEXT_KEY = "crm-opportunity-context";

export type CrmSidebarFocus = "opportunities" | "company" | "leads" | "dashboard";

export function setCrmSidebarFocus(focus: CrmSidebarFocus | null) {
  if (typeof window === "undefined") return;
  if (!focus) {
    sessionStorage.removeItem(CRM_SIDEBAR_FOCUS_KEY);
    return;
  }
  sessionStorage.setItem(CRM_SIDEBAR_FOCUS_KEY, focus);
}

export function getCrmSidebarFocus(): CrmSidebarFocus | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(CRM_SIDEBAR_FOCUS_KEY);
  if (
    value === "opportunities" ||
    value === "company" ||
    value === "leads" ||
    value === "dashboard"
  ) {
    return value;
  }
  return null;
}

/** Opportunity id to return to when browsing company deal docs from an opportunity. */
export function setCrmOpportunityContext(opportunityId: string | null) {
  if (typeof window === "undefined") return;
  if (!opportunityId) {
    sessionStorage.removeItem(CRM_OPPORTUNITY_CONTEXT_KEY);
    return;
  }
  sessionStorage.setItem(CRM_OPPORTUNITY_CONTEXT_KEY, opportunityId);
}

export function getCrmOpportunityContext(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(CRM_OPPORTUNITY_CONTEXT_KEY);
}

/** Company workspace section paths that belong to the deal/opportunity workflow. */
export function isCompanyDealWorkspacePath(pathname: string): boolean {
  return /^\/crm\/companies\/[^/]+\/(opportunities|quotes|oem-quotes|purchase-orders|ovf|boq|sow)(\/|$)/.test(
    pathname,
  );
}

export function isCompanyWorkspacePath(pathname: string): boolean {
  return /^\/crm\/companies\/[^/]+/.test(pathname);
}

/** True for /crm/companies/{id}/… section routes (not the account overview). */
export function isCompanyWorkspaceSectionPath(pathname: string): boolean {
  return /^\/crm\/companies\/[^/]+\/[^/]+/.test(pathname);
}
