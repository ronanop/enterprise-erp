import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  pathname: "/assets",
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { STANDALONE_KEY, useStandaloneChrome } from "@/hooks/use-standalone-chrome";

describe("useStandaloneChrome", () => {
  beforeEach(() => {
    sessionStorage.clear();
    nav.pathname = "/assets";
    nav.search = "";
  });

  it("forces module chrome on /assets without standalone query", () => {
    nav.pathname = "/assets";
    nav.search = "";
    const { result } = renderHook(() => useStandaloneChrome());
    expect(result.current).toBe(true);
  });

  it("forces module chrome on Asset Management sub-routes", () => {
    for (const path of [
      "/assets/assets",
      "/assets/asset-assignments",
      "/assets/asset-transfers",
      "/assets/asset-disposals",
      "/assets/asset-maintenances",
      "/assets/incoming-assets",
    ]) {
      nav.pathname = path;
      nav.search = "";
      const { result } = renderHook(() => useStandaloneChrome());
      expect(result.current).toBe(true);
    }
  });

  it("keeps module chrome when standalone=1 is present", () => {
    nav.pathname = "/assets";
    nav.search = "standalone=1";
    const { result } = renderHook(() => useStandaloneChrome());
    expect(result.current).toBe(true);
    expect(sessionStorage.getItem(STANDALONE_KEY)).toBe("1");
  });

  it("does not force module chrome on unrelated routes without flag", () => {
    nav.pathname = "/crm";
    nav.search = "";
    const { result } = renderHook(() => useStandaloneChrome());
    expect(result.current).toBe(false);
  });

  it("honors sessionStorage standalone for non-assets routes", () => {
    sessionStorage.setItem(STANDALONE_KEY, "1");
    nav.pathname = "/crm";
    nav.search = "";
    const { result } = renderHook(() => useStandaloneChrome());
    expect(result.current).toBe(true);
  });
});
