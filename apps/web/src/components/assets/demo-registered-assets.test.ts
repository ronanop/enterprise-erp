/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";

import {
  enrichInventoryRowForDemo,
  mapDemoRegisteredToInventoryRows,
  SEED_DEMO_REGISTER_ASSETS,
} from "@/components/assets/demo-registered-assets";
import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";

const blankRow = (): InventoryRowViewModel => ({
  id: "x",
  assetTag: "LT-00023",
  laptopName: "dell",
  manufacturer: "—",
  model: "—",
  configuration: "—",
  currentHolder: "—",
  employeeId: "—",
  department: "—",
  branch: "Head Office",
  operationalStatus: "READY_TO_MOVE",
  lifecycleStatus: "active",
  issueDate: "—",
  location: "mumbai",
  expandable: {
    earlierUsedBy: "—",
    deliveryChallan: "—",
    deliveryReferenceStatus: "—",
    phoneNumber: "—",
    remarks: "—",
    assignmentRemarks: "—",
    returnRemarks: "—",
  },
  assignmentHistory: [],
});

describe("demo register enrichment", () => {
  it("fills manufacturer, model, configuration, department for empty API rows", () => {
    const enriched = enrichInventoryRowForDemo(blankRow());
    expect(enriched.manufacturer).toBe("Dell");
    expect(enriched.model).toMatch(/Latitude/i);
    expect(enriched.configuration).toMatch(/16GB/i);
    expect(enriched.department).toBe("Information Technology");
    expect(enriched.branch).toBe("Head Office");
    expect(enriched.location).toBe("mumbai");
    expect(enriched.expandable.deliveryChallan).toMatch(/DC-/);
  });

  it("maps seed demo assets with every register column populated", () => {
    const rows = mapDemoRegisteredToInventoryRows(SEED_DEMO_REGISTER_ASSETS);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const row of rows) {
      expect(row.assetTag).not.toBe("—");
      expect(row.laptopName).not.toBe("—");
      expect(row.manufacturer).not.toBe("—");
      expect(row.model).not.toBe("—");
      expect(row.configuration).not.toBe("—");
      expect(row.department).not.toBe("—");
      expect(row.branch).not.toBe("—");
      expect(row.operationalStatus).not.toBe("—");
      expect(row.lifecycleStatus).not.toBe("—");
      expect(row.location).not.toBe("—");
    }
  });
});
