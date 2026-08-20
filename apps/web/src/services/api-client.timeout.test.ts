import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, apiClient } from "@/services/api-client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiClient request timeout", () => {
  it("surfaces a recoverable timeout when the backend never responds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          if (signal.aborted) {
            reject(new DOMException("The operation was aborted.", "TimeoutError"));
            return;
          }
          signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "TimeoutError"));
          });
        });
      }),
    );

    await expect(apiClient("/assets/assets", { auth: false, timeoutMs: 50 })).rejects.toEqual(
      expect.objectContaining({
        name: "ApiClientError",
        status: 0,
        message: expect.stringMatching(/did not respond in time/i),
      } satisfies Partial<ApiClientError>),
    );
  });
});
