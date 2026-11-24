"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

import { getStoredOrgContext, setStoredOrgContext } from "@/lib/org-context-storage";
import { ApiClientError, contextService } from "@/services/api-client";
import type { OrgCompanyOption } from "@/types/org-context";
import { cn } from "@/lib/utils";

/** Sentinel select value for tenant-wide (all companies) context. */
const ALL_ENTITIES = "all";

function normalizeCompanies(data: unknown): OrgCompanyOption[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? ""),
      company_code: String(row.company_code ?? ""),
      company_name: String(row.company_name ?? row.name ?? ""),
    }))
    .filter((company) => company.id && company.company_name)
    .sort((a, b) => a.company_name.localeCompare(b.company_name));
}

/** Shows active company / entity and lets multi-company users switch. */
export function CompanyContextBadge({ className }: { className?: string }) {
  const [companies, setCompanies] = useState<OrgCompanyOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredOrgContext();
    if (stored?.allCompanies) {
      setCompanyId(ALL_ENTITIES);
      setCompanyName("All");
    } else if (stored?.companyName) {
      setCompanyId(stored.companyId || "");
      setCompanyName(stored.companyName);
    }

    let cancelled = false;
    void (async () => {
      try {
        const [ctxRes, companiesRes] = await Promise.all([
          contextService.getContext().catch(() => null),
          contextService.listCompanies().catch(() => null),
        ]);
        if (cancelled) return;

        const rows = normalizeCompanies(companiesRes?.data);
        setCompanies(rows);

        if (ctxRes?.data?.all_companies) {
          setCompanyId(ALL_ENTITIES);
          setCompanyName("All");
          setStoredOrgContext({
            companyId: "",
            companyName: "All",
            allCompanies: true,
          });
          return;
        }

        const activeId = ctxRes?.data?.company_id
          ? String(ctxRes.data.company_id)
          : (stored?.companyId ?? "");
        const match = rows.find((company) => company.id === activeId);
        if (match) {
          setCompanyId(match.id);
          setCompanyName(match.company_name);
          const current = getStoredOrgContext();
          setStoredOrgContext({
            companyId: match.id,
            companyName: match.company_name,
            branchId: current?.branchId,
            branchName: current?.branchName,
          });
        } else if (stored?.companyId && stored.companyName) {
          // Server lost Redis company scope — re-apply stored company
          try {
            await contextService.switchContext({
              company_id: stored.companyId,
              branch_id: stored.branchId ?? null,
            });
            setCompanyId(stored.companyId);
            setCompanyName(stored.companyName);
          } catch {
            setCompanyName(stored.companyName);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : "Could not load entities");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onChange(nextId: string) {
    if (!nextId || nextId === companyId) return;
    setSwitching(true);
    setError(null);
    try {
      if (nextId === ALL_ENTITIES) {
        await contextService.switchContext({
          all_companies: true,
          company_id: null,
          branch_id: null,
        });
        setStoredOrgContext({
          companyId: "",
          companyName: "All",
          allCompanies: true,
        });
      } else {
        const next = companies.find((company) => company.id === nextId);
        if (!next) {
          setSwitching(false);
          return;
        }
        await contextService.switchContext({
          company_id: next.id,
          branch_id: null,
          all_companies: false,
        });
        setStoredOrgContext({ companyId: next.id, companyName: next.company_name });
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not switch entity");
      setSwitching(false);
    }
  }

  if (loading && !companyName) return null;
  if (!companyName && companies.length === 0) return null;

  const label = companyName || "Entity";

  return (
    <div
      className={cn(
        "hidden min-w-0 items-center gap-1.5 sm:flex",
        className,
      )}
      title={error || "Active entity / company"}
    >
      <Building2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {companies.length > 1 ? (
        <select
          aria-label="Active entity"
          value={
            companyId === ALL_ENTITIES || companies.some((c) => c.id === companyId)
              ? companyId
              : ""
          }
          disabled={switching}
          onChange={(e) => void onChange(e.target.value)}
          className="h-8 max-w-[14rem] cursor-pointer truncate rounded-lg border border-border/70 bg-muted/40 px-2 text-xs font-medium text-foreground outline-none transition-colors duration-200 hover:border-primary/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {companies.length > 1 ? (
            <option value={ALL_ENTITIES}>All assigned entities</option>
          ) : null}
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.company_name}
              {company.company_code ? ` (${company.company_code})` : ""}
            </option>
          ))}
        </select>
      ) : (
        <span className="max-w-[10rem] truncate rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground">
          {companies[0]?.company_name || label}
        </span>
      )}
      {switching ? <span className="text-[10px] text-muted-foreground">…</span> : null}
    </div>
  );
}
