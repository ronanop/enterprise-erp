import { describe, expect, it } from "vitest";

import {
  salesStageToneFromLabel,
  salesStageToneFromState,
} from "@/lib/crm/sales-blueprint-stages";

describe("salesStageToneFromLabel", () => {
  it("marks pre-PO path including Deal Won as orange band", () => {
    expect(salesStageToneFromLabel("Lead Open")).toBe("pre_po");
    expect(salesStageToneFromLabel("Quote Created")).toBe("pre_po");
    expect(salesStageToneFromLabel("Deal Won")).toBe("pre_po");
    expect(salesStageToneFromLabel("Deal Won · V2")).toBe("pre_po");
    expect(salesStageToneFromLabel("Quote Accepted")).toBe("pre_po");
  });

  it("marks Customer PO / OVF path as green band", () => {
    expect(salesStageToneFromLabel("Customer PO Attached")).toBe("post_po");
    expect(salesStageToneFromLabel("Customer PO Sent for Approval")).toBe("post_po");
    expect(salesStageToneFromLabel("Customer PO Approved")).toBe("post_po");
    expect(salesStageToneFromLabel("OVF Ready")).toBe("post_po");
    expect(salesStageToneFromLabel("OVF Created")).toBe("post_po");
    expect(salesStageToneFromLabel("OVF Shared to SCM")).toBe("post_po");
    expect(salesStageToneFromLabel("PO Received")).toBe("post_po");
  });

  it("marks lost as lost", () => {
    expect(salesStageToneFromLabel("Deal Lost")).toBe("lost");
  });
});

describe("salesStageToneFromState", () => {
  it("classifies raw keys", () => {
    expect(salesStageToneFromState("won")).toBe("pre_po");
    expect(salesStageToneFromState("accepted", "quote")).toBe("pre_po");
    expect(salesStageToneFromState("po_approval")).toBe("post_po");
    expect(salesStageToneFromState("draft", "ovf")).toBe("post_po");
    expect(salesStageToneFromState("lost")).toBe("lost");
  });
});
