import { describe, expect, it } from "vitest";

import {
  buildInventoryActionPermissions,
  buildInventoryQuickLinkPermissions,
} from "@/components/assets/navigation/inventory-permissions";

describe("buildInventoryActionPermissions", () => {
  it("enables assign when assignment create permission granted", () => {
    const perms = buildInventoryActionPermissions((p) => p === "asset.assignment:create");
    expect(perms.assign).toBe(true);
    expect(perms.return).toBe(false);
  });

  it("disables assign without create permission", () => {
    const perms = buildInventoryActionPermissions((p) => p === "asset.asset:read");
    expect(perms.viewDetails).toBe(true);
    expect(perms.assign).toBe(false);
    expect(perms.portal).toBe(true);
  });

  it("enables return with assignment return permission", () => {
    const perms = buildInventoryActionPermissions((p) => p === "asset.assignment:return");
    expect(perms.return).toBe(true);
    expect(perms.viewDetails).toBe(false);
  });

  it("enables startDisposal with disposal create permission", () => {
    const perms = buildInventoryActionPermissions((p) => p === "asset.disposal:create");
    expect(perms.startDisposal).toBe(true);
  });
});

describe("buildInventoryQuickLinkPermissions", () => {
  it("gates quick links on asset read", () => {
    const links = buildInventoryQuickLinkPermissions(() => false);
    expect(links.portal).toBe(false);
    expect(links.history).toBe(false);
  });
});
