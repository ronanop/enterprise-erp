"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { History, Plus } from "lucide-react";

import { FollowupFormDialog } from "@/components/crm/sales/followup-form-dialog";
import { MeetingFormDialog } from "@/components/crm/sales/meeting-form-dialog";
import { OpportunityAttachmentsPanel } from "@/components/crm/sales/opportunity-attachments-panel";
import { OpportunityTimelinePanel } from "@/components/crm/sales/opportunity-timeline-panel";
import { TaskAssignmentFormDialog } from "@/components/crm/sales/task-assignment-form-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getCompany,
  listAttachments,
  listAttachmentsByCategory,
  listContacts,
  listFollowups,
  listMeetings,
  listOpportunities,
  listOvfs,
  listProducts,
  listQuotes,
  listSalesLeads,
  listTasks,
  type Attachment,
  type Company,
  type Opportunity,
  type SalesLead,
} from "@/services/sales-crm-service";
import { setCrmOpportunityContext, setCrmSidebarFocus } from "@/lib/crm-sidebar-focus";

type QuickCreateKind = "task" | "followup" | "lead" | "meeting" | "attachment";

type NavItem = {
  title: string;
  segment: string;
  /** Shown only on the company account sidebar (hidden on opportunity sidebar). */
  companyOnly?: boolean;
  /** Shown only on the opportunity sidebar (hidden on company sidebar). */
  opportunityOnly?: boolean;
  /** Hover "+" opens create form/page. */
  quickCreate?: QuickCreateKind;
};

/** Same CRM panes as the workspace nav, scoped to one company account. */
export const COMPANY_WORKSPACE_NAV: readonly NavItem[] = [
  { title: "Overview", segment: "" },
  { title: "Leads", segment: "leads", quickCreate: "lead" },
  { title: "Opportunities", segment: "opportunities" },
  {
    title: "Task Assignment",
    segment: "task-assignment",
    opportunityOnly: true,
    quickCreate: "task",
  },
  {
    title: "Attachments",
    segment: "attachments",
    opportunityOnly: true,
    quickCreate: "attachment",
  },
  { title: "OEM Quote", segment: "oem-quotes" },
  { title: "Quotes", segment: "quotes" },
  { title: "Purchase Order", segment: "purchase-orders" },
  { title: "OVF", segment: "ovf" },
  { title: "Contacts", segment: "contacts", companyOnly: true },
  { title: "Products", segment: "products" },
  { title: "Meetings", segment: "meetings", companyOnly: true, quickCreate: "meeting" },
  { title: "Customer Follow Ups", segment: "customer-followups", quickCreate: "followup" },
  { title: "KYC - Account Mapping", segment: "kyc-account-mapping", companyOnly: true },
  { title: "OEM", segment: "oem" },
  { title: "Distributor", segment: "distributors" },
  { title: "BOQ", segment: "boq" },
  { title: "SOW", segment: "sow" },
  { title: "Entity", segment: "entities" },
  { title: "End Customer", segment: "end-customers" },
] as const;

export type CompanyWorkspaceSegment = (typeof COMPANY_WORKSPACE_NAV)[number]["segment"];

export type CompanyWorkspaceNavScope = "company" | "opportunity";

const NAV_WIDTH = 220;

type CountMap = Partial<Record<string, number>>;

function countLeadField(
  leads: SalesLead[],
  pick: (lead: SalesLead) => string | null | undefined,
): number {
  return leads.filter((lead) => Boolean(pick(lead)?.trim())).length;
}

function scopedAttachmentCount(
  files: Attachment[],
  oppIds: Set<string>,
  flaggedOpps: Opportunity[],
  flag: keyof Opportunity,
): number {
  const fromFiles = files.filter(
    (file) => file.entity_type === "opportunity" && oppIds.has(file.entity_id),
  ).length;
  if (fromFiles > 0) return fromFiles;
  return flaggedOpps.filter((opp) => Boolean(opp[flag])).length;
}

async function loadCompanyNavCounts(
  companyAccountId: string,
  opportunityId?: string,
): Promise<CountMap> {
  const [
    leads,
    opportunities,
    quotes,
    ovfs,
    products,
    followups,
    contacts,
    meetings,
    oemQuotes,
    purchaseOrders,
    boqs,
    sows,
    tasks,
    opportunityAttachments,
  ] = await Promise.all([
    listSalesLeads(companyAccountId).catch(() => [] as SalesLead[]),
    listOpportunities({ company_account_id: companyAccountId }).catch(() => [] as Opportunity[]),
    listQuotes({ company_account_id: companyAccountId }).catch(() => []),
    listOvfs({ company_account_id: companyAccountId }).catch(() => []),
    listProducts().catch(() => []),
    listFollowups(companyAccountId).catch(() => []),
    listContacts(companyAccountId).catch(() => []),
    listMeetings(companyAccountId).catch(() => []),
    listAttachmentsByCategory("oem_quote").catch(() => [] as Attachment[]),
    listAttachmentsByCategory("customer_po").catch(() => [] as Attachment[]),
    listAttachmentsByCategory("boq").catch(() => [] as Attachment[]),
    listAttachmentsByCategory("sow").catch(() => [] as Attachment[]),
    opportunityId
      ? listTasks({ opportunity_id: opportunityId }).catch(() => [])
      : Promise.resolve([]),
    opportunityId
      ? listAttachments("opportunity", opportunityId).catch(() => [] as Attachment[])
      : Promise.resolve([] as Attachment[]),
  ]);

  const oppIds = new Set(opportunities.map((opp) => opp.id));

  return {
    leads: leads.length,
    opportunities: opportunities.length,
    "task-assignment": tasks.length,
    attachments: opportunityAttachments.length,
    quotes: quotes.length,
    ovf: ovfs.length,
    products: products.length,
    "customer-followups": followups.length,
    contacts: contacts.length,
    meetings: meetings.length,
    "kyc-account-mapping": 1,
    "oem-quotes": scopedAttachmentCount(oemQuotes, oppIds, opportunities, "oem_quote_attached"),
    "purchase-orders": scopedAttachmentCount(
      purchaseOrders,
      oppIds,
      opportunities,
      "customer_po_attached",
    ),
    boq: scopedAttachmentCount(boqs, oppIds, opportunities, "boq_attached"),
    sow: scopedAttachmentCount(sows, oppIds, opportunities, "sow_attached"),
    oem: countLeadField(leads, (l) => l.oem_name),
    distributors: countLeadField(leads, (l) => l.distributor_name),
    entities: countLeadField(leads, (l) => l.entity_name),
    "end-customers": countLeadField(leads, (l) => l.end_customer_name),
  };
}

/** Internal company/opportunity sidebar — fixed, vertically centered, docked to primary sidebar. */
export function CompanyWorkspaceNav({
  companyAccountId,
  scope = "company",
  opportunityId,
  opportunity,
  company: companyProp,
}: {
  companyAccountId: string;
  /** `company` includes Contacts / Meetings / KYC; `opportunity` hides those. */
  scope?: CompanyWorkspaceNavScope;
  /** When set with `scope="opportunity"`, shows Timeline history for this deal. */
  opportunityId?: string;
  /** Prefill task/follow-up forms from the open opportunity page. */
  opportunity?: Opportunity | null;
  company?: Company | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const base = `/crm/companies/${companyAccountId}`;
  const spacerRef = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [counts, setCounts] = useState<CountMap>({});
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [company, setCompany] = useState<Company | null>(companyProp ?? null);
  const items = COMPANY_WORKSPACE_NAV.filter((item) => {
    if (scope === "company") return !item.opportunityOnly;
    return !item.companyOnly;
  });
  const showTimeline = scope === "opportunity" && Boolean(opportunityId);
  const isOpportunityScope = scope === "opportunity" && Boolean(opportunityId);
  const isCompanyScope = scope === "company";
  const overviewHref =
    isOpportunityScope && opportunityId
      ? `/crm/opportunities/${opportunityId}`
      : base;

  function rememberOpportunityContext() {
    if (!opportunityId) return;
    setCrmSidebarFocus("opportunities");
    setCrmOpportunityContext(opportunityId);
  }

  function canQuickCreate(kind: QuickCreateKind | undefined): boolean {
    if (!kind) return false;
    if (kind === "task" || kind === "attachment") return isOpportunityScope;
    if (kind === "lead" || kind === "meeting") return isCompanyScope;
    if (kind === "followup") return isCompanyScope || isOpportunityScope;
    return false;
  }

  useLayoutEffect(() => {
    const spacer = spacerRef.current;

    const sync = () => {
      const primary = document.querySelector<HTMLElement>("[data-erp-primary-sidebar]");
      if (primary) {
        // Dock flush to the primary sidebar (no gap).
        setLeft(Math.round(primary.getBoundingClientRect().right));
        return;
      }
      // Fallback when primary sidebar is absent (should be rare on CRM pages).
      if (spacer) setLeft(Math.round(spacer.getBoundingClientRect().left));
    };

    sync();
    // Re-run after paint in case primary sidebar mounts slightly later.
    const raf = window.requestAnimationFrame(sync);
    const observer = new ResizeObserver(sync);
    const primary = document.querySelector<HTMLElement>("[data-erp-primary-sidebar]");
    if (primary) observer.observe(primary);
    if (spacer) observer.observe(spacer);
    window.addEventListener("resize", sync);

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    if (companyProp) {
      setCompany(companyProp);
      return;
    }
    let cancelled = false;
    void getCompany(companyAccountId)
      .then((row) => {
        if (!cancelled) setCompany(row);
      })
      .catch(() => {
        if (!cancelled) setCompany(null);
      });
    return () => {
      cancelled = true;
    };
  }, [companyAccountId, companyProp]);

  useEffect(() => {
    let cancelled = false;
    void loadCompanyNavCounts(companyAccountId, opportunityId).then((next) => {
      if (!cancelled) setCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [companyAccountId, opportunityId, pathname, taskOpen, attachmentsOpen, followupOpen, meetingOpen]);

  function onQuickCreate(kind: QuickCreateKind) {
    if (kind === "task") {
      setTaskOpen(true);
      return;
    }
    if (kind === "attachment") {
      setAttachmentsOpen(true);
      return;
    }
    if (kind === "followup") {
      setFollowupOpen(true);
      return;
    }
    if (kind === "meeting") {
      setMeetingOpen(true);
      return;
    }
    if (kind === "lead") {
      router.push(`${base}/leads/new`);
    }
  }
  function isActive(segment: string): boolean {
    if (segment === "task-assignment") return taskOpen;
    if (segment === "attachments") return attachmentsOpen;
    if (!segment) {
      if (isOpportunityScope && opportunityId) {
        return (
          pathname === `/crm/opportunities/${opportunityId}` ||
          pathname.startsWith(`/crm/opportunities/${opportunityId}/`)
        );
      }
      return pathname === base || pathname === `${base}/`;
    }
    const href = `${base}/${segment}`;
    if (pathname === href || pathname.startsWith(`${href}/`)) return true;
    // Highlight company panes while viewing related global detail routes.
    if (segment === "opportunities" && pathname.startsWith("/crm/opportunities/")) return true;
    if (segment === "quotes" && pathname.includes("/quotes")) return true;
    if (segment === "ovf" && pathname.includes("/ovf")) return true;
    if (segment === "leads" && pathname.startsWith("/crm/leads/")) return true;
    return false;
  }

  return (
    <>
      {/*
        Reserves horizontal space for the fixed nav. Negative margin cancels
        AppShell main padding so the slot starts at the primary sidebar edge
        (same left as the docked fixed aside) — removes the white gap.
      */}
      <div
        ref={spacerRef}
        className="w-[220px] shrink-0 -ml-4 sm:-ml-6 lg:-ml-8"
        aria-hidden
      />

      <aside
        className="fixed z-30 flex w-[220px] flex-col overflow-hidden rounded-none border-y border-r border-border/80 bg-card"
        style={{
          top: "50%",
          transform: "translateY(-50%)",
          left: left ?? -9999,
          visibility: left === null ? "hidden" : "visible",
        }}
      >
        <div className="shrink-0 border-b border-border/70 px-3 py-2.5">
          <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {isOpportunityScope ? "Opportunity" : "Company"}
          </p>
          {showTimeline ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 w-full cursor-pointer justify-start gap-1.5 px-2 text-[11px] font-medium transition-colors duration-200"
              onClick={() => setTimelineOpen(true)}
            >
              <History className="size-3.5 shrink-0" aria-hidden />
              Timeline
            </Button>
          ) : null}
        </div>
        <nav
          aria-label={isOpportunityScope ? "Opportunity workspace" : "Company workspace"}
          className="px-1.5 py-2"
        >
          <ul className="space-y-0.5">
            {items.map((item) => {
              const href = item.segment ? `${base}/${item.segment}` : overviewHref;
              const active = isActive(item.segment);
              const count = counts[item.segment];
              const showQuickCreate = canQuickCreate(item.quickCreate);
              const isPanelItem =
                item.segment === "task-assignment" || item.segment === "attachments";
              return (
                <li key={item.segment || "overview"}>
                  <div
                    className={cn(
                      "group/nav relative flex items-center gap-1 rounded-lg py-0.5 pr-1 transition-colors duration-200",
                      active
                        ? "bg-muted text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {active ? (
                      <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary" />
                    ) : null}
                    {isPanelItem ? (
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg py-1 pl-2.5 text-left text-[12px] font-medium"
                        onClick={() => {
                          rememberOpportunityContext();
                          if (item.segment === "task-assignment") setTaskOpen(true);
                          if (item.segment === "attachments") setAttachmentsOpen(true);
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      </button>
                    ) : (
                      <Link
                        href={href}
                        onClick={() => {
                          if (isOpportunityScope) rememberOpportunityContext();
                          else {
                            setCrmSidebarFocus("company");
                            setCrmOpportunityContext(null);
                          }
                        }}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg py-1 pl-2.5 text-[12px] font-medium"
                      >
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      </Link>
                    )}
                    {item.segment ? (
                      <span className="relative z-10 mr-1 flex size-5 shrink-0 items-center justify-center">
                        <span
                          className={cn(
                            "pointer-events-none font-mono text-[10px] tabular-nums transition-opacity duration-150",
                            showQuickCreate && "group-hover/nav:opacity-0",
                            active
                              ? "text-foreground"
                              : "rounded-md bg-muted/80 px-1.5 py-0.5 text-muted-foreground",
                            typeof count !== "number" && "text-muted-foreground/50",
                          )}
                        >
                          {typeof count === "number" ? count : "—"}
                        </span>
                        {showQuickCreate ? (
                          <button
                            type="button"
                            title={`Add ${item.title}`}
                            aria-label={`Add ${item.title}`}
                            className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onQuickCreate(item.quickCreate!);
                            }}
                          >
                            <Plus className="size-3.5" aria-hidden />
                          </button>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {showTimeline && opportunityId ? (
        <OpportunityTimelinePanel
          opportunityId={opportunityId}
          open={timelineOpen}
          onClose={() => setTimelineOpen(false)}
        />
      ) : null}

      {isOpportunityScope && opportunityId ? (
        <>
          <TaskAssignmentFormDialog
            open={taskOpen}
            opportunityId={opportunityId}
            companyAccountId={companyAccountId}
            opportunity={opportunity ?? null}
            company={company}
            onClose={() => setTaskOpen(false)}
            onSaved={() => {
              setTaskOpen(false);
              void loadCompanyNavCounts(companyAccountId, opportunityId).then(setCounts);
            }}
          />
          <OpportunityAttachmentsPanel
            open={attachmentsOpen}
            opportunityId={opportunityId}
            opportunity={opportunity ?? null}
            onClose={() => {
              setAttachmentsOpen(false);
              void loadCompanyNavCounts(companyAccountId, opportunityId).then(setCounts);
            }}
          />
        </>
      ) : null}

      {isCompanyScope || isOpportunityScope ? (
        <FollowupFormDialog
          open={followupOpen}
          companyAccount={company}
          opportunityId={isOpportunityScope ? opportunityId : null}
          onClose={() => setFollowupOpen(false)}
          onSaved={() => {
            setFollowupOpen(false);
            void loadCompanyNavCounts(companyAccountId, opportunityId).then(setCounts);
          }}
        />
      ) : null}

      {isCompanyScope ? (
        <MeetingFormDialog
          open={meetingOpen}
          companyAccount={company}
          onClose={() => setMeetingOpen(false)}
          onSaved={() => {
            setMeetingOpen(false);
            void loadCompanyNavCounts(companyAccountId, opportunityId).then(setCounts);
          }}
        />
      ) : null}
    </>
  );
}
