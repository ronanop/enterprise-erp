"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ExternalLink, Loader2, XCircle } from "lucide-react";

import {
  formatPendingTransferHeadline,
  formatPendingTransferStatusLabel,
  parsePendingTransferError,
  pendingTransferRegisterHref,
} from "@/components/assets/pending-transfer-error";
import { Button } from "@/components/ui/button";
import { ApiClientError, resourceService } from "@/services/api-client";

type TransferLookupRow = {
  id: string;
  document_number: string;
  status: string;
  version: number;
};

type ListPayload<T> = {
  items: T[];
  total: number;
};

export type PendingTransferErrorBannerProps = {
  message: string;
  onDismiss?: () => void;
  onCancelled?: () => void;
};

function parseItems(data: unknown): TransferLookupRow[] {
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as ListPayload<TransferLookupRow>).items;
    return Array.isArray(items) ? items : [];
  }
  if (Array.isArray(data)) return data as TransferLookupRow[];
  return [];
}

export function PendingTransferErrorBanner({
  message,
  onDismiss,
  onCancelled,
}: PendingTransferErrorBannerProps) {
  const router = useRouter();
  const parsed = parsePendingTransferError(message);
  const [status, setStatus] = useState<string | null>(null);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(Boolean(parsed));
  const [cancelLoading, setCancelLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const lookup = useCallback(async (documentNumber: string) => {
    setLookupLoading(true);
    setActionError(null);
    try {
      const query = new URLSearchParams({
        page: "1",
        page_size: "25",
        q: documentNumber,
      });
      const res = await resourceService.list<ListPayload<TransferLookupRow>>(
        `/assets/asset-transfers?${query.toString()}`,
      );
      const items = parseItems(res.data);
      const match =
        items.find((row) => row.document_number === documentNumber) ?? items[0] ?? null;
      setStatus(match?.status ?? null);
      setTransferId(match?.id ?? null);
    } catch {
      setStatus(null);
      setTransferId(null);
    } finally {
      setLookupLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!parsed?.documentNumber) return;
    const documentNumber = parsed.documentNumber;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      await lookup(documentNumber);
    });
    return () => {
      cancelled = true;
    };
  }, [parsed?.documentNumber, lookup]);

  if (!parsed) {
    return null;
  }

  const canCancelDraft = status === "draft" && Boolean(transferId);

  async function cancelDraft() {
    if (!transferId || status !== "draft") return;
    setCancelLoading(true);
    setActionError(null);
    try {
      await resourceService.action("/assets/asset-transfers", transferId, "cancel");
      onCancelled?.();
      onDismiss?.();
    } catch (err) {
      setActionError(
        err instanceof ApiClientError ? err.message : "Unable to cancel this draft transfer.",
      );
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3"
      role="alert"
      data-testid="pending-transfer-error-banner"
    >
      <div className="flex gap-2 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{formatPendingTransferHeadline()}</p>
          <p className="text-destructive/90">
            Transfer: <span className="font-mono">{parsed.documentNumber}</span>
          </p>
          <p className="text-destructive/90">
            Status:{" "}
            {lookupLoading
              ? "Loading…"
              : formatPendingTransferStatusLabel(status)}
          </p>
          {actionError ? <p className="text-xs">{actionError}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer transition-colors duration-200"
          data-testid="pending-transfer-open"
          onClick={() => router.push(pendingTransferRegisterHref(parsed.documentNumber))}
        >
          <ExternalLink className="mr-1 size-3.5" aria-hidden />
          Open Transfer
        </Button>
        {canCancelDraft ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            data-testid="pending-transfer-cancel"
            disabled={cancelLoading}
            onClick={() => void cancelDraft()}
          >
            {cancelLoading ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
            ) : (
              <XCircle className="mr-1 size-3.5" aria-hidden />
            )}
            Cancel Transfer
          </Button>
        ) : null}
        {onDismiss ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={onDismiss}
          >
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}
