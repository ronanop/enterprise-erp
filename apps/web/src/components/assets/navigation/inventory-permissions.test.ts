import { describe, expect, it } from "vitest";

import {
  applyOperationalGatesToInventoryPermissions,
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

  it("enables edit and delete with asset.asset:update", () => {
    const perms = buildInventoryActionPermissions((p) => p === "asset.asset:update");
    expect(perms.edit).toBe(true);
    expect(perms.delete).toBe(true);
    expect(perms.viewDetails).toBe(false);
  });

  it("disables edit and delete without asset.asset:update", () => {
    const perms = buildInventoryActionPermissions((p) => p === "asset.asset:read");
    expect(perms.edit).toBe(false);
    expect(perms.delete).toBe(false);
  });
});

describe("applyOperationalGatesToInventoryPermissions edit/delete", () => {
  const allTrue = buildInventoryActionPermissions(() => true);

  it("does not gate edit/delete by operational status", () => {
    const gated = applyOperationalGatesToInventoryPermissions(allTrue, "ASSIGNED");
    expect(gated.edit).toBe(true);
    expect(gated.delete).toBe(true);
  });
});

describe("applyOperationalGatesToInventoryPermissions", () => {
  const allTrue = buildInventoryActionPermissions(() => true);

  it("READY_TO_MOVE: assign yes, transfer no", () => {
    const gated = applyOperationalGatesToInventoryPermissions(allTrue, "READY_TO_MOVE");
    expect(gated.assign).toBe(true);
    expect(gated.transfer).toBe(false);
    expect(gated.return).toBe(false);
  });

  it("ASSIGNED: transfer and return yes, assign no", () => {
    const gated = applyOperationalGatesToInventoryPermissions(allTrue, "ASSIGNED");
    expect(gated.assign).toBe(false);
    expect(gated.transfer).toBe(true);
    expect(gated.return).toBe(true);
  });
});

describe("buildInventoryQuickLinkPermissions", () => {
  it("exposes portal and qr only (history/discovery consolidated into portal)", () => {
    const links = buildInventoryQuickLinkPermissions(() => true);
    expect(links.portal).toBe(true);
    expect(links.qr).toBe(true);
    expect(links.discovery).toBe(false);
    expect(links.history).toBe(false);
  });

  it("gates quick links on asset read", () => {
    const links = buildInventoryQuickLinkPermissions(() => false);
    expect(links.portal).toBe(false);
    expect(links.qr).toBe(false);
    expect(links.history).toBe(false);
  });
});
