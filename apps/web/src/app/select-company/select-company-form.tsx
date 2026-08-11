"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isAuthenticated, redirectToLogin } from "@/lib/auth";
import { setStoredOrgContext } from "@/lib/org-context-storage";
import { ApiClientError, contextService } from "@/services/api-client";
import type { OrgCompanyOption } from "@/types/org-context";

function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

export function SelectCompanyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [companies, setCompanies] = useState<OrgCompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      redirectToLogin();
      return;
    }

    void (async () => {
      try {
        const res = await contextService.listCompanies();
        const rows = Array.isArray(res.data) ? res.data : [];
        const normalized = rows
          .map((row) => ({
            id: String((row as OrgCompanyOption).id ?? ""),
            company_code: String((row as OrgCompanyOption).company_code ?? ""),
            company_name: String((row as OrgCompanyOption).company_name ?? ""),
            legal_name: (row as OrgCompanyOption).legal_name,
            status: (row as OrgCompanyOption).status,
          }))
          .filter((c) => c.id && c.company_name);

        if (normalized.length === 1) {
          const company = normalized[0];
          await contextService.switchContext({ company_id: company.id });
          setStoredOrgContext({
            companyId: company.id,
            companyName: company.company_name,
          });
          router.replace(safeNext(searchParams.get("next")));
          return;
        }

        setCompanies(normalized);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Could not load companies");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, searchParams]);

  async function handleSelect(company: OrgCompanyOption) {
    setSelectingId(company.id);
    setError(null);
    try {
      await contextService.switchContext({ company_id: company.id });
      setStoredOrgContext({
        companyId: company.id,
        companyName: company.company_name,
      });
      router.replace(safeNext(searchParams.get("next")));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not switch company");
      setSelectingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 text-sm text-muted-foreground">
        Loading companies…
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.03_200)_0%,_oklch(0.985_0.004_220)_55%,_oklch(0.97_0.01_240)_100%)]"
      />
      <div className="relative w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Building2 className="size-5" />
          </div>
          <h1 className="text-2xl font-medium tracking-tight">Select company</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choose which legal entity you want to work in for this session.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="space-y-3">
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              disabled={!!selectingId}
              onClick={() => void handleSelect(company)}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div>
                <p className="font-medium">{company.company_name}</p>
                <p className="text-xs text-muted-foreground">{company.company_code}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="pointer-events-none shadow-none"
                disabled={selectingId === company.id}
              >
                {selectingId === company.id ? "Switching…" : "Continue"}
              </Button>
            </button>
          ))}
        </div>

        {!companies.length ? (
          <p className="text-center text-sm text-muted-foreground">
            No companies are assigned to your account. Contact your administrator.
          </p>
        ) : null}
      </div>
    </div>
  );
}
