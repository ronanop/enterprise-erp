"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

import { getStoredOrgContext, setStoredOrgContext } from "@/lib/org-context-storage";
import { contextService } from "@/services/api-client";
import type { OrgCompanyOption } from "@/types/org-context";

export function CompanyContextBadge() {
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [multiCompany, setMultiCompany] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const stored = getStoredOrgContext();
      if (stored?.companyName) {
        setCompanyName(stored.companyName);
      }

      try {
        const [ctxRes, companiesRes] = await Promise.all([
          contextService.getContext().catch(() => null),
          contextService.listCompanies().catch(() => null),
        ]);

        const rows = Array.isArray(companiesRes?.data) ? companiesRes.data : [];
        const normalized = rows
          .map((row) => ({
            id: String((row as OrgCompanyOption).id ?? ""),
            company_code: String((row as OrgCompanyOption).company_code ?? ""),
            company_name: String((row as OrgCompanyOption).company_name ?? ""),
          }))
          .filter((c) => c.id && c.company_name);

        setMultiCompany(normalized.length > 1);

        const companyId = ctxRes?.data?.company_id;
        if (companyId) {
          const match = normalized.find((c) => c.id === companyId);
          if (match) {
            setCompanyName(match.company_name);
            setStoredOrgContext({ companyId: match.id, companyName: match.company_name });
          }
        } else if (stored?.companyName) {
          setCompanyName(stored.companyName);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading && !companyName) return null;
  if (!companyName) return null;

  const content = (
    <>
      <Building2 className="size-3.5 shrink-0" />
      <span className="max-w-[10rem] truncate font-medium text-foreground">{companyName}</span>
    </>
  );

  if (!multiCompany) {
    return (
      <div className="hidden items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground sm:flex">
        {content}
      </div>
    );
  }

  return (
    <Link
      href="/select-company"
      className="hidden items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/60 sm:flex"
      title="Switch Company"
    >
      {content}
    </Link>
  );
}
