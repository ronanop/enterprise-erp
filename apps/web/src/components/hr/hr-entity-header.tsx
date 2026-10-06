"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

import { getStoredOrgContext, setStoredOrgContext } from "@/lib/org-context-storage";
import { ApiClientError, contextService } from "@/services/api-client";
import type { OrgCompanyOption } from "@/types/org-context";

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

/** Top-right entity switcher for every HRMS screen. */
export function HrEntityHeader() {
  const [companies, setCompanies] = useState<OrgCompanyOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredOrgContext();
    if (stored?.allCompanies) {
      setCompanyId(ALL_ENTITIES);
      setCompanyName("All");
    } else if (stored?.companyId) {
      setCompanyId(stored.companyId);
      setCompanyName(stored.companyName);
    }

    let cancelled = false;
    void (async () => {
      try {
        const [ctxRes, companiesRes] = await Promise.all([
          contextService.getContext().catch(() => null),
          contextService.listCompanies(),
        ]);
        if (cancelled) return;
        const rows = normalizeCompanies(companiesRes.data);
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

  const label = companyName || "Entity";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-end gap-3 border-b border-border bg-card/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="hidden text-sm font-medium text-muted-foreground sm:inline">Entity</span>
        {loading ? (
          <span className="text-sm text-muted-foreground">Loading entities…</span>
        ) : companies.length > 1 ? (
          <select
            aria-label="Entity"
            value={companyId === ALL_ENTITIES || companies.some((company) => company.id === companyId) ? companyId : ""}
            disabled={switching}
            onChange={(event) => void onChange(event.target.value)}
            className="h-9 w-[min(100%,26rem)] min-w-[12rem] cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm font-medium text-foreground outline-none transition-colors duration-200 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value={ALL_ENTITIES}>All</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_name} ({company.company_code})
              </option>
            ))}
          </select>
        ) : (
          <span className="max-w-[16rem] truncate text-sm font-medium text-foreground">
            {companies[0]?.company_name || label}
            {companies[0]?.company_code ? ` (${companies[0].company_code})` : ""}
          </span>
        )}
        {switching ? <span className="text-xs text-muted-foreground">Switching…</span> : null}
      </div>
      {error ? (
        <p className="max-w-[14rem] truncate text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </header>
  );
}
