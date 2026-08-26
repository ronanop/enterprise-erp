"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  Loader2,
  MapPin,
  Search,
  type LucideIcon,
} from "lucide-react";

import { PROJECTS_NAV } from "@/components/projects/projects-workspace-nav";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  listProjectCompletedJobs,
  listProjectMyJobs,
  listProjectPoQueue,
  listProjects,
  listSiteInstallations,
  type Project,
  type ProjectMyJob,
  type ProjectPoQueueItem,
  type SiteInstallation,
} from "@/services/projects-portal-service";

type ProjectsSearchKind =
  | "pane"
  | "project"
  | "site"
  | "my_job"
  | "completed_job"
  | "po_queue";

type ProjectsSearchHit = {
  id: string;
  kind: ProjectsSearchKind;
  title: string;
  subtitle: string;
  href: string;
};

type ProjectsSearchIndex = {
  projects: Project[];
  sites: SiteInstallation[];
  myJobs: ProjectMyJob[];
  completedJobs: ProjectMyJob[];
  poQueue: ProjectPoQueueItem[];
};

const KIND_META: Record<ProjectsSearchKind, { label: string; icon: LucideIcon }> = {
  pane: { label: "Workspace", icon: Search },
  project: { label: "Projects", icon: FolderKanban },
  site: { label: "Sites", icon: MapPin },
  my_job: { label: "My Jobs", icon: Briefcase },
  completed_job: { label: "Completed Jobs", icon: CheckCircle2 },
  po_queue: { label: "PO Queue", icon: ClipboardList },
};

const KIND_ORDER: ProjectsSearchKind[] = [
  "pane",
  "project",
  "site",
  "my_job",
  "completed_job",
  "po_queue",
];

const PER_KIND = 5;
const MAX_TOTAL = 24;

const EXTRA_PANES = [{ title: "Users", href: "/projects/users" }] as const;

let cachedIndex: ProjectsSearchIndex | null = null;
let cacheInFlight: Promise<ProjectsSearchIndex> | null = null;

async function loadProjectsSearchIndex(): Promise<ProjectsSearchIndex> {
  if (cachedIndex) return cachedIndex;
  if (!cacheInFlight) {
    cacheInFlight = Promise.all([
      listProjects().catch(() => [] as Project[]),
      listSiteInstallations().catch(() => [] as SiteInstallation[]),
      listProjectMyJobs().catch(() => [] as ProjectMyJob[]),
      listProjectCompletedJobs().catch(() => [] as ProjectMyJob[]),
      listProjectPoQueue().catch(() => [] as ProjectPoQueueItem[]),
    ]).then(([projects, sites, myJobs, completedJobs, poQueue]) => {
      cachedIndex = { projects, sites, myJobs, completedJobs, poQueue };
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

function buildHits(index: ProjectsSearchIndex, rawQuery: string): ProjectsSearchHit[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];

  const buckets: Record<ProjectsSearchKind, ProjectsSearchHit[]> = {
    pane: [],
    project: [],
    site: [],
    my_job: [],
    completed_job: [],
    po_queue: [],
  };

  const panes = [...PROJECTS_NAV, ...EXTRA_PANES];
  for (const pane of panes) {
    if (!matches(q, pane.title, pane.href)) continue;
    buckets.pane.push({
      id: `pane-${pane.href}`,
      kind: "pane",
      title: pane.title,
      subtitle: "Projects workspace",
      href: pane.href,
    });
  }

  for (const row of index.projects) {
    if (
      !matches(
        q,
        row.project_name,
        row.project_code,
        row.project_type,
        row.description,
        row.health_status,
        row.workflow_status,
      )
    ) {
      continue;
    }
    buckets.project.push({
      id: row.id,
      kind: "project",
      title: row.project_name,
      subtitle:
        [row.project_code, row.project_type, row.workflow_status?.replaceAll("_", " ")]
          .filter(Boolean)
          .join(" · ") || "Project",
      href: `/projects/projects/${row.id}`,
    });
  }

  for (const row of index.sites) {
    if (
      !matches(
        q,
        row.document_number,
        row.site_name,
        row.circle,
        row.cloud_name,
        row.requestor_name,
        row.workflow_stage,
        row.delivery_type,
        row.rfai_number,
      )
    ) {
      continue;
    }
    buckets.site.push({
      id: row.id,
      kind: "site",
      title: row.site_name?.trim() || row.document_number,
      subtitle:
        [row.document_number, row.circle, row.workflow_stage.replaceAll("_", " ")]
          .filter(Boolean)
          .join(" · ") || "Site installation",
      href: `/projects/projects/${row.project_id}`,
    });
  }

  for (const row of index.myJobs) {
    if (
      !matches(
        q,
        row.project_name,
        row.document_number,
        row.site_name,
        row.stage_label,
        row.assigned_stage,
        row.workflow_stage,
      )
    ) {
      continue;
    }
    buckets.my_job.push({
      id: `${row.site_installation_id}-${row.assigned_stage}`,
      kind: "my_job",
      title: row.project_name,
      subtitle:
        [row.stage_label, row.site_name, row.document_number].filter(Boolean).join(" · ") ||
        "My job",
      href: row.form_path || `/projects/projects/${row.project_id}`,
    });
  }

  for (const row of index.completedJobs) {
    if (
      !matches(
        q,
        row.project_name,
        row.document_number,
        row.site_name,
        row.stage_label,
        row.assigned_stage,
        row.workflow_stage,
      )
    ) {
      continue;
    }
    buckets.completed_job.push({
      id: `done-${row.site_installation_id}-${row.assigned_stage}`,
      kind: "completed_job",
      title: row.project_name,
      subtitle:
        [row.stage_label, row.site_name, row.document_number].filter(Boolean).join(" · ") ||
        "Completed job",
      href: row.form_path || `/projects/projects/${row.project_id}`,
    });
  }

  for (const row of index.poQueue) {
    if (
      !matches(
        q,
        row.document_number,
        row.company_po_number,
        row.customer_po_number,
        row.customer_name,
        row.status,
      )
    ) {
      continue;
    }
    buckets.po_queue.push({
      id: row.order_id,
      kind: "po_queue",
      title: row.company_po_number || row.document_number,
      subtitle:
        [row.customer_name, row.customer_po_number, row.status].filter(Boolean).join(" · ") ||
        "PO queue",
      href: `/projects/projects/new?po_id=${row.order_id}`,
    });
  }

  const out: ProjectsSearchHit[] = [];
  for (const kind of KIND_ORDER) {
    for (const hit of buckets[kind].slice(0, PER_KIND)) {
      out.push(hit);
      if (out.length >= MAX_TOTAL) return out;
    }
  }
  return out;
}

export function ProjectsGlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<ProjectsSearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [indexReady, setIndexReady] = useState(Boolean(cachedIndex));

  const ensureIndex = useCallback(async () => {
    if (cachedIndex) {
      setIndexReady(true);
      return cachedIndex;
    }
    setLoading(true);
    try {
      const index = await loadProjectsSearchIndex();
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
    const map = new Map<ProjectsSearchKind, ProjectsSearchHit[]>();
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

  function goTo(hit: ProjectsSearchHit) {
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
          placeholder="Search Projects…"
          aria-label="Search Projects"
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
              No Projects matches for “{query.trim()}”.
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
                        const flatIndex = flatHits.findIndex(
                          (h) => h.id === hit.id && h.kind === hit.kind,
                        );
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
