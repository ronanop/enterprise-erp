"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Factory,
  FileText,
  Loader2,
  Package,
  Receipt,
  Search,
  Target,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import { CRM_NAV } from "@/components/crm/crm-workspace-nav";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fullName,
  listCompanies,
  listContacts,
  listOems,
  listOpportunities,
  listOvfs,
  listProducts,
  listQuotes,
  listSalesLeads,
  type Company,
  type Contact,
  type Oem,
  type Opportunity,
  type Ovf,
  type Product,
  type Quote,
  type SalesLead,
} from "@/services/sales-crm-service";

type CrmSearchKind =
  | "pane"
  | "company"
  | "lead"
  | "opportunity"
  | "quote"
  | "ovf"
  | "contact"
  | "product"
  | "oem";

type CrmSearchHit = {
  id: string;
  kind: CrmSearchKind;
  title: string;
  subtitle: string;
  href: string;
};

type CrmSearchIndex = {
  companies: Company[];
  leads: SalesLead[];
  opportunities: Opportunity[];
  quotes: Quote[];
  ovfs: Ovf[];
  contacts: Contact[];
  products: Product[];
  oems: Oem[];
};

const KIND_META: Record<CrmSearchKind, { label: string; icon: LucideIcon }> = {
  pane: { label: "Workspace", icon: Search },
  company: { label: "Companies", icon: Building2 },
  lead: { label: "Leads", icon: UserPlus },
  opportunity: { label: "Opportunities", icon: Target },
  quote: { label: "Quotes", icon: FileText },
  ovf: { label: "OVF", icon: Receipt },
  contact: { label: "Contacts", icon: Users },
  product: { label: "Products", icon: Package },
  oem: { label: "OEM", icon: Factory },
};

const KIND_ORDER: CrmSearchKind[] = [
  "pane",
  "company",
  "lead",
  "opportunity",
  "quote",
  "ovf",
  "contact",
  "product",
  "oem",
];

const PER_KIND = 5;
const MAX_TOTAL = 24;

let cachedIndex: CrmSearchIndex | null = null;
let cacheInFlight: Promise<CrmSearchIndex> | null = null;

async function loadCrmSearchIndex(): Promise<CrmSearchIndex> {
  if (cachedIndex) return cachedIndex;
  if (!cacheInFlight) {
    cacheInFlight = Promise.all([
      listCompanies().catch(() => [] as Company[]),
      listSalesLeads().catch(() => [] as SalesLead[]),
      listOpportunities().catch(() => [] as Opportunity[]),
      listQuotes().catch(() => [] as Quote[]),
      listOvfs().catch(() => [] as Ovf[]),
      listContacts().catch(() => [] as Contact[]),
      listProducts().catch(() => [] as Product[]),
      listOems().catch(() => [] as Oem[]),
    ]).then(([companies, leads, opportunities, quotes, ovfs, contacts, products, oems]) => {
      cachedIndex = {
        companies,
        leads,
        opportunities,
        quotes,
        ovfs,
        contacts,
        products,
        oems,
      };
      return cachedIndex;
    });
  }
  try {
    return await cacheInFlight;
  } finally {
    cacheInFlight = null;
  }
}

function haystack(...parts: Array<string | null | undefined>): string {
  return parts
    .filter((p): p is string => Boolean(p && String(p).trim()))
    .join(" ")
    .toLowerCase();
}

function matches(q: string, ...parts: Array<string | null | undefined>): boolean {
  return haystack(...parts).includes(q);
}

function buildHits(index: CrmSearchIndex, rawQuery: string): CrmSearchHit[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];

  const buckets: Record<CrmSearchKind, CrmSearchHit[]> = {
    pane: [],
    company: [],
    lead: [],
    opportunity: [],
    quote: [],
    ovf: [],
    contact: [],
    product: [],
    oem: [],
  };

  for (const pane of CRM_NAV) {
    if (!matches(q, pane.title, pane.href)) continue;
    buckets.pane.push({
      id: `pane-${pane.href}`,
      kind: "pane",
      title: pane.title,
      subtitle: "CRM workspace",
      href: pane.href,
    });
  }

  for (const row of index.companies) {
    if (
      !matches(
        q,
        row.customer_name,
        row.account_number,
        row.customer_email,
        row.phone,
        row.billing_city,
        row.industry,
      )
    ) {
      continue;
    }
    buckets.company.push({
      id: row.id,
      kind: "company",
      title: row.customer_name,
      subtitle: [row.account_number, row.industry].filter(Boolean).join(" · ") || "Company",
      href: `/crm/companies/${row.id}`,
    });
  }

  for (const row of index.leads) {
    const name = fullName(row);
    if (
      !matches(
        q,
        name,
        row.lead_code,
        row.mobile,
        row.email,
        row.project_title,
        row.entity_name,
        row.end_customer_name,
      )
    ) {
      continue;
    }
    buckets.lead.push({
      id: row.id,
      kind: "lead",
      title: name || row.lead_code,
      subtitle: [row.lead_code, row.mobile].filter(Boolean).join(" · "),
      href: `/crm/leads/${row.id}`,
    });
  }

  for (const row of index.opportunities) {
    if (
      !matches(
        q,
        row.opportunity_name,
        row.opportunity_code,
        row.project_title,
        row.current_stage,
        row.status,
      )
    ) {
      continue;
    }
    buckets.opportunity.push({
      id: row.id,
      kind: "opportunity",
      title: row.opportunity_name,
      subtitle: [row.opportunity_code, row.current_stage.replaceAll("_", " ")].filter(Boolean).join(" · "),
      href: `/crm/opportunities/${row.id}`,
    });
  }

  for (const row of index.quotes) {
    if (!matches(q, row.quote_no, row.subject, row.account_name, row.project_title, row.entity_name)) {
      continue;
    }
    buckets.quote.push({
      id: row.id,
      kind: "quote",
      title: row.quote_no,
      subtitle: [row.subject, row.account_name].filter(Boolean).join(" · ") || row.quote_stage,
      href: `/crm/quotes/${row.id}`,
    });
  }

  for (const row of index.ovfs) {
    if (!matches(q, row.ovf_no, row.po_number, row.customer_name, row.quote_name)) continue;
    buckets.ovf.push({
      id: row.id,
      kind: "ovf",
      title: row.ovf_no,
      subtitle: [row.po_number, row.customer_name].filter(Boolean).join(" · ") || "OVF",
      href: `/crm/ovf/${row.id}`,
    });
  }

  for (const row of index.contacts) {
    const name = fullName(row);
    if (!matches(q, name, row.email, row.phone, row.mobile, row.title)) continue;
    buckets.contact.push({
      id: row.id,
      kind: "contact",
      title: name,
      subtitle: [row.email, row.phone].filter(Boolean).join(" · ") || "Contact",
      href: row.company_account_id
        ? `/crm/companies/${row.company_account_id}/contacts`
        : "/crm/contacts",
    });
  }

  for (const row of index.products) {
    if (!matches(q, row.product_name, row.product_code, row.product_type, row.hsn_sac)) continue;
    buckets.product.push({
      id: row.id,
      kind: "product",
      title: row.product_name,
      subtitle: [row.product_code, row.product_type].filter(Boolean).join(" · "),
      href: "/crm/products",
    });
  }

  for (const row of index.oems) {
    if (!matches(q, row.oem_name, row.oem_code, row.contact_person, row.contact_email)) continue;
    buckets.oem.push({
      id: row.id,
      kind: "oem",
      title: row.oem_name,
      subtitle: [row.oem_code, row.contact_person].filter(Boolean).join(" · ") || "OEM",
      href: "/crm/oem",
    });
  }

  const out: CrmSearchHit[] = [];
  for (const kind of KIND_ORDER) {
    for (const hit of buckets[kind].slice(0, PER_KIND)) {
      out.push(hit);
      if (out.length >= MAX_TOTAL) return out;
    }
  }
  return out;
}

export function CrmGlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<CrmSearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [indexReady, setIndexReady] = useState(Boolean(cachedIndex));

  const ensureIndex = useCallback(async () => {
    if (cachedIndex) {
      setIndexReady(true);
      return cachedIndex;
    }
    setLoading(true);
    try {
      const index = await loadCrmSearchIndex();
      setIndexReady(true);
      return index;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const index = await ensureIndex();
        if (cancelled) return;
        setHits(buildHits(index, q));
        setActiveIndex(0);
        setOpen(true);
      })();
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, ensureIndex]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<CrmSearchKind, CrmSearchHit[]>();
    for (const hit of hits) {
      const list = map.get(hit.kind) ?? [];
      list.push(hit);
      map.set(hit.kind, list);
    }
    return KIND_ORDER.filter((kind) => (map.get(kind)?.length ?? 0) > 0).map((kind) => ({
      kind,
      hits: map.get(kind)!,
    }));
  }, [hits]);

  const flatHits = useMemo(() => grouped.flatMap((g) => g.hits), [grouped]);

  function goTo(hit: CrmSearchHit) {
    setOpen(false);
    setQuery("");
    setHits([]);
    router.push(hit.href);
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className={cn("relative min-w-0 flex-1", className)}>
      <div className="relative mx-auto w-full max-w-xl">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (!indexReady) void ensureIndex();
          }}
          onKeyDown={(e) => {
            if (!showPanel || flatHits.length === 0) {
              if (e.key === "Escape") setOpen(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % flatHits.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => (i - 1 + flatHits.length) % flatHits.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              const hit = flatHits[activeIndex];
              if (hit) goTo(hit);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search CRM…"
          aria-label="Search CRM"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel}
          className="h-9 border-border/80 bg-background pl-8 pr-9 transition-colors duration-200"
        />
        {loading ? (
          <Loader2
            className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          className="absolute top-[calc(100%+6px)] left-1/2 z-50 w-[min(100vw-2rem,36rem)] -translate-x-1/2 overflow-hidden rounded-xl border border-border/80 bg-card shadow-lg"
        >
          {flatHits.length === 0 && !loading ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No CRM matches for “{query.trim()}”.
            </p>
          ) : (
            <div className="erp-scroll max-h-[min(70vh,28rem)] overflow-y-auto py-1">
              {grouped.map((group) => {
                const meta = KIND_META[group.kind];
                const Icon = meta.icon;
                return (
                  <div key={group.kind} className="border-b border-border/50 last:border-0">
                    <p className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      <Icon className="size-3" aria-hidden />
                      {meta.label}
                    </p>
                    <ul>
                      {group.hits.map((hit) => {
                        const flatIndex = flatHits.findIndex((h) => h.id === hit.id && h.kind === hit.kind);
                        const active = flatIndex === activeIndex;
                        return (
                          <li key={`${hit.kind}-${hit.id}`} role="option" aria-selected={active}>
                            <Link
                              href={hit.href}
                              className={cn(
                                "flex cursor-pointer flex-col gap-0.5 px-3 py-2 transition-colors duration-150",
                                active ? "bg-muted/70" : "hover:bg-muted/50",
                              )}
                              onMouseEnter={() => setActiveIndex(flatIndex)}
                              onClick={(e) => {
                                e.preventDefault();
                                goTo(hit);
                              }}
                            >
                              <span className="truncate text-sm font-medium text-foreground">
                                {hit.title}
                              </span>
                              <span className="truncate text-[11px] text-muted-foreground">
                                {hit.subtitle}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
