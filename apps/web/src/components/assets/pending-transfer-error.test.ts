import { describe, expect, it } from "vitest";

import {
  formatPendingTransferHeadline,
  formatPendingTransferStatusLabel,
  parsePendingTransferError,
  pendingTransferRegisterHref,
} from "@/components/assets/pending-transfer-error";

describe("parsePendingTransferError", () => {
  it("parses assignment pending-transfer message", () => {
    const parsed = parsePendingTransferError(
      "Asset has a pending transfer (ATRF-2026-000005)",
    );
    expect(parsed).toEqual({
      documentNumber: "ATRF-2026-000005",
      rawMessage: "Asset has a pending transfer (ATRF-2026-000005)",
    });
  });

  it("parses transfer-validator wording", () => {
    const parsed = parsePendingTransferError(
      "Asset already has a pending transfer (ATRF-2026-000007)",
    );
    expect(parsed?.documentNumber).toBe("ATRF-2026-000007");
  });

  it("returns null for unrelated errors", () => {
    expect(parsePendingTransferError("Only active assets can be assigned")).toBeNull();
    expect(parsePendingTransferError("")).toBeNull();
  });
});

describe("pending transfer helpers", () => {
  it("builds register href with document query", () => {
    expect(pendingTransferRegisterHref("ATRF-2026-000005")).toBe(
      "/assets/asset-transfers?document=ATRF-2026-000005",
    );
  });

  it("formats headline and status labels", () => {
    expect(formatPendingTransferHeadline()).toBe(
      "This asset already has an open transfer.",
    );
    expect(formatPendingTransferStatusLabel("draft")).toBe("Draft");
    expect(formatPendingTransferStatusLabel(null)).toBe("Open");
  });
});
