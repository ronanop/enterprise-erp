"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, FileCheck2, RefreshCw, Send, X } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import {
  FinanceField,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { CreditEvaluationCard } from "@/components/master-data/credit-evaluation-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatAmountShort,
  formatDateTime,
} from "@/lib/master-data/party-registration-format";
import { ApiClientError } from "@/services/api-client";
import {
  approveRegistration,
  evaluateCredit,
  getPartyRegistration,
  rejectRegistration,
  submitRegistration,
  verifyKyc,
  type PartyRegistration,
  type PartyType,
} from "@/services/party-registration-service";

type DialogKind = "approve" | "reject" | null;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <span className="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="block text-sm break-words text-foreground">{value || "—"}</span>
    </div>
  );
}

export function PartyRegistrationDetailPage({
  registrationId,
  partyType,
  basePath,
}: {
  registrationId: string;
  partyType: PartyType;
  basePath: string;
}) {
  const [row, setRow] = useState<PartyRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [reason, setReason] = useState("");
  const [approvedLimit, setApprovedLimit] = useState("");
  const [approvedDays, setApprovedDays] = useState("");
  const [override, setOverride] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRow(await getPartyRegistration(registrationId));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to load registration");
    } finally {
      setLoading(false);
    }
  }, [registrationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (fn: () => Promise<PartyRegistration>, successMessage: string) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        setRow(await fn());
        setNotice(successMessage);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Action failed");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  function openApprove() {
    if (!row) return;
    setApprovedLimit(
      row.assessed_credit_limit !== null && row.assessed_credit_limit !== undefined
        ? String(row.assessed_credit_limit)
        : "",
    );
    setApprovedDays(
      row.assessed_credit_days !== null && row.assessed_credit_days !== undefined
        ? String(row.assessed_credit_days)
        : "",
    );
    setOverride(false);
    setReason("");
    setDialog("approve");
  }

  async function confirmApprove() {
    if (!row) return;
    await run(
      () =>
        approveRegistration(row.id, {
          approved_credit_limit: approvedLimit ? Number(approvedLimit) : null,
          approved_credit_days: approvedDays ? Number(approvedDays) : null,
          reason: reason || undefined,
          override_risk_band: override,
        }),
      partyType === "customer"
        ? "Approved. The customer master record has been created."
        : "Approved. The vendor master record has been created.",
    );
    setDialog(null);
  }

  async function confirmReject() {
    if (!row || !reason.trim()) return;
    await run(() => rejectRegistration(row.id, reason.trim()), "Registration rejected.");
    setDialog(null);
  }

  if (loading) {
    return <p className="px-1 py-12 text-sm text-muted-foreground">Loading registration…</p>;
  }

  if (!row) {
    return (
      <div className="space-y-4">
        <PageHeader title="Registration" backHref={basePath} backLabel="Registrations" />
        <p className="text-sm text-destructive">{error ?? "Registration not found"}</p>
      </div>
    );
  }

  const isDraft = row.status === "draft";
  const isSubmitted = row.status === "submitted";
  const isClosed = row.status === "converted" || row.status === "rejected";
  const kycVerified = row.kyc_status === "verified";
  const evaluated = Boolean(row.evaluation_json);
  const createdPartyId = partyType === "customer" ? row.customer_id : row.vendor_id;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${row.registration_code} · ${row.legal_name}`}
        description={
          partyType === "customer"
            ? "Customer Registration Form"
            : "Vendor Registration Form"
        }
        backHref={basePath}
        backLabel="Registrations"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer shadow-none transition-colors duration-200"
              onClick={() => void load()}
              disabled={busy}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Refresh
            </Button>
            {isDraft ? (
              <Link
                href={`${basePath}/${row.id}/edit`}
                className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
              >
                Edit
              </Link>
            ) : null}
          </div>
        }
      />

      {notice ? (
        <p className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-4 py-2.5 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3.5">
          <h2 className="text-base font-semibold tracking-tight">Party details</h2>
          <div className="flex items-center gap-2">
            <FinanceStatusBadge status={row.kyc_status} />
            <FinanceStatusBadge status={row.status} />
          </div>
        </header>
        <div className="grid grid-cols-2 gap-5 px-5 py-4 sm:grid-cols-3 lg:grid-cols-4">
          <DetailRow label="Legal name" value={row.legal_name} />
          <DetailRow label="Trade name" value={row.trade_name ?? ""} />
          <DetailRow label="Type" value={row.party_subtype ?? ""} />
          <DetailRow label="GST / tax number" value={row.tax_number ?? ""} />
          <DetailRow label="PAN" value={row.pan_number ?? ""} />
          <DetailRow label="CIN" value={row.cin_number ?? ""} />
          <DetailRow label="Contact person" value={row.contact_person ?? ""} />
          <DetailRow label="Email" value={row.email ?? ""} />
          <DetailRow label="Mobile" value={row.mobile ?? ""} />
          <DetailRow label="Currency" value={row.currency_code ?? ""} />
          <DetailRow
            label="Declared turnover"
            value={formatAmountShort(row.declared_annual_turnover)}
          />
          <DetailRow label="KYC verified" value={formatDateTime(row.kyc_verified_at)} />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3.5">
          <h2 className="text-base font-semibold tracking-tight">
            KYC documents ({row.kyc_documents_json.length})
          </h2>
          {!kycVerified && !isClosed ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy || row.kyc_documents_json.length === 0}
                onClick={() =>
                  void run(() => verifyKyc(row.id, true), "KYC marked as verified.")
                }
              >
                <FileCheck2 className="size-3.5" aria-hidden />
                Verify KYC
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy || row.kyc_documents_json.length === 0}
                onClick={() =>
                  void run(() => verifyKyc(row.id, false), "KYC marked as rejected.")
                }
              >
                <X className="size-3.5" aria-hidden />
                Reject KYC
              </Button>
            </div>
          ) : null}
        </header>
        {row.kyc_documents_json.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No KYC documents attached. At least one is required before verification.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {row.kyc_documents_json.map((doc) => (
              <li
                key={`${doc.doc_type}-${doc.file_name}`}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5"
              >
                <span className="text-sm font-medium capitalize">
                  {doc.doc_type.replaceAll("_", " ")}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{doc.file_name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreditEvaluationCard evaluation={row.evaluation_json} riskBand={row.risk_band} />

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card px-5 py-4 shadow-sm">
        {!isClosed ? (
          <Button
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            disabled={busy}
            onClick={() =>
              void run(() => evaluateCredit(row.id), "Assessment refreshed.")
            }
          >
            <RefreshCw className="size-3.5" aria-hidden />
            {evaluated ? "Re-run assessment" : "Run assessment"}
          </Button>
        ) : null}

        {isDraft ? (
          <Button
            className="cursor-pointer transition-colors duration-200"
            disabled={busy || !kycVerified || !evaluated}
            onClick={() =>
              void run(() => submitRegistration(row.id), "Submitted for approval.")
            }
          >
            <Send className="size-3.5" aria-hidden />
            Submit for approval
          </Button>
        ) : null}

        {isSubmitted ? (
          <>
            <Button
              className="cursor-pointer transition-colors duration-200"
              disabled={busy}
              onClick={openApprove}
            >
              <Check className="size-3.5" aria-hidden />
              Approve
            </Button>
            <Button
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              disabled={busy}
              onClick={() => {
                setReason("");
                setDialog("reject");
              }}
            >
              <X className="size-3.5" aria-hidden />
              Reject
            </Button>
          </>
        ) : null}

        {isDraft && (!kycVerified || !evaluated) ? (
          <p className="text-sm text-muted-foreground">
            {!kycVerified && !evaluated
              ? "Verify KYC and run the assessment before submitting."
              : !kycVerified
                ? "Verify KYC before submitting."
                : "Run the assessment before submitting."}
          </p>
        ) : null}

        {createdPartyId ? (
          <p className="text-sm text-muted-foreground">
            Approved on {formatDateTime(row.decided_at)}. Master record created.
          </p>
        ) : null}
        {row.status === "rejected" ? (
          <p className="text-sm text-muted-foreground">
            Rejected on {formatDateTime(row.decided_at)}: {row.decision_reason}
          </p>
        ) : null}
      </section>

      <ConfirmDialog
        open={dialog === "approve"}
        title="Approve registration"
        description={
          partyType === "customer"
            ? "Approving creates the customer master record with the credit terms below."
            : "Approving creates the vendor master record with the payment terms below."
        }
        confirmLabel="Approve"
        busy={busy}
        confirmDisabled={row.risk_band === "unacceptable" && (!override || !reason.trim())}
        onCancel={() => setDialog(null)}
        onConfirm={() => void confirmApprove()}
      >
        <div className="space-y-4">
          {partyType === "customer" ? (
            <FinanceField
              label="Approved credit limit"
              hint="Defaults to the assessed recommendation."
            >
              <Input
                value={approvedLimit}
                inputMode="decimal"
                onChange={(e) => setApprovedLimit(e.target.value)}
                className="h-8 font-mono"
              />
            </FinanceField>
          ) : null}
          <FinanceField label="Approved credit days">
            <Input
              value={approvedDays}
              inputMode="numeric"
              onChange={(e) => setApprovedDays(e.target.value)}
              className="h-8 font-mono"
            />
          </FinanceField>
          {row.risk_band === "unacceptable" ? (
            <div className="space-y-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-3">
              <p className="text-sm text-destructive">
                The requested exposure is well beyond what this party&apos;s declared turnover
                supports. Approving needs an explicit override and a reason.
              </p>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(e) => setOverride(e.target.checked)}
                  className="size-4 cursor-pointer"
                />
                Override the risk assessment
              </label>
            </div>
          ) : null}
          <FinanceField
            label={row.risk_band === "unacceptable" ? "Reason *" : "Reason"}
          >
            <FinanceTextarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being approved on these terms?"
            />
          </FinanceField>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "reject"}
        title="Reject registration"
        description="The party will not be created in the masters."
        confirmLabel="Reject"
        tone="destructive"
        busy={busy}
        confirmDisabled={!reason.trim()}
        onCancel={() => setDialog(null)}
        onConfirm={() => void confirmReject()}
      >
        <FinanceField label="Reason *">
          <FinanceTextarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this registration being rejected?"
          />
        </FinanceField>
      </ConfirmDialog>
    </div>
  );
}
