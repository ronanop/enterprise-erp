/**
 * Parse backend pending-transfer validation messages into UI-friendly details.
 * Backend still returns: "Asset has a pending transfer (ATRF-…)" /
 * "Asset already has a pending transfer (ATRF-…)".
 */

export type PendingTransferErrorDetails = {
  documentNumber: string;
  /** Raw backend message (unchanged). */
  rawMessage: string;
};

const PENDING_TRANSFER_RE =
  /pending transfer\s*\(([^)]+)\)/i;

export function parsePendingTransferError(
  message: string | null | undefined,
): PendingTransferErrorDetails | null {
  const text = String(message ?? "").trim();
  if (!text) return null;
  const match = text.match(PENDING_TRANSFER_RE);
  if (!match?.[1]) return null;
  const documentNumber = match[1].trim();
  if (!documentNumber) return null;
  return { documentNumber, rawMessage: text };
}

export function pendingTransferRegisterHref(documentNumber: string): string {
  const q = encodeURIComponent(documentNumber.trim());
  return `/assets/asset-transfers?document=${q}`;
}

export function formatPendingTransferHeadline(): string {
  return "This asset already has an open transfer.";
}

export function formatPendingTransferStatusLabel(status: string | null | undefined): string {
  const key = String(status ?? "").trim().toLowerCase();
  if (!key) return "Open";
  return key.charAt(0).toUpperCase() + key.slice(1);
}
