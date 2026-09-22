"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { RiskBandBadge } from "@/components/master-data/risk-band-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/lib/master-data/party-registration-format";
import { ApiClientError } from "@/services/api-client";
import {
  listPartyRegistrations,
  type PartyRegistration,
  type PartyType,
  type RegistrationStatus,
} from "@/services/party-registration-service";

const STATUS_OPTIONS: { value: "" | RegistrationStatus; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "converted", label: "Converted" },
];

type Props = {
  partyType: PartyType;
  basePath: string;
};

const COPY: Record<PartyType, { title: string; description: string; newLabel: string }> = {
  customer: {
    title: "Customer Registrations",
    description:
      "Customer Registration Forms (CRF). KYC and a credit assessment are required before a customer reaches the master.",
    newLabel: "New CRF",
  },
  vendor: {
    title: "Vendor Registrations",
    description:
      "Vendor Registration Forms (VRF). KYC and a payment-terms assessment are required before a vendor reaches the master.",
    newLabel: "New VRF",
  },
};

export function PartyRegistrationListPage({ partyType, basePath }: Props) {
  const copy = COPY[partyType];
  const [rows, setRows] = useState<PartyRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | RegistrationStatus>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPartyRegistrations({
        party_type: partyType,
        status: status || undefined,
      });
      setRows(data);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Unable to load registrations",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [partyType, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.registration_code, row.legal_name, row.trade_name, row.tax_number]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [rows, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        backHref="/master-data"
        backLabel="Master Data"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer shadow-none transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </Button>
            <Link
              href={`${basePath}/new`}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary/90"
            >
              <Plus className="size-3.5" aria-hidden />
              {copy.newLabel}
            </Link>
          </div>
        }
      />

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">Registrations</h2>
            <Badge variant="secondary">{filtered.length} shown</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FinanceSelect
              value={status}
              onChange={(e) => setStatus(e.target.value as "" | RegistrationStatus)}
              className="h-9 w-auto min-w-[9rem]"
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </FinanceSelect>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by code, name or GST…"
              className="h-9 max-w-xs shadow-none"
            />
          </div>
        </div>

        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            Loading registrations…
          </p>
        ) : error ? (
          <div className="m-4 space-y-2 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 px-4 py-6 sm:m-5">
            <p className="text-sm font-medium text-destructive">Unable to load registrations</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No registrations yet. Start one with “{copy.newLabel}”.
          </p>
        ) : (
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Legal name</th>
                  <th className="px-5 py-3 font-medium">KYC</th>
                  <th className="px-5 py-3 font-medium text-right">
                    {partyType === "customer" ? "Requested limit" : "Monthly spend"}
                  </th>
                  <th className="px-5 py-3 font-medium text-right">Days</th>
                  <th className="px-5 py-3 font-medium">Risk</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 transition-colors duration-150 hover:bg-muted/30">
                    <td className="px-5 py-2.5 font-mono text-xs">
                      <Link
                        href={`${basePath}/${row.id}`}
                        className="cursor-pointer text-primary transition-colors duration-150 hover:underline"
                      >
                        {row.registration_code}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="font-medium">{row.legal_name}</span>
                      {row.trade_name ? (
                        <span className="block text-xs text-muted-foreground">{row.trade_name}</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-2.5">
                      <FinanceStatusBadge status={row.kyc_status} />
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-xs">
                      {formatAmount(
                        partyType === "customer"
                          ? row.requested_credit_limit
                          : row.expected_monthly_spend,
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-xs">
                      {row.requested_credit_days ?? "—"}
                    </td>
                    <td className="px-5 py-2.5">
                      <RiskBandBadge band={row.risk_band} />
                    </td>
                    <td className="px-5 py-2.5">
                      <FinanceStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
