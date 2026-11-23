import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { STANDALONE_KEY, useStandaloneChrome } from "@/hooks/use-standalone-chrome";

describe("useStandaloneChrome", () => {
  it("uses HR workspace chrome on every route", () => {
    const { result } = renderHook(() => useStandaloneChrome());
    expect(result.current).toBe(true);
  });

  it("keeps the legacy standalone storage key", () => {
    expect(STANDALONE_KEY).toBe("erp-standalone");
  });
});
