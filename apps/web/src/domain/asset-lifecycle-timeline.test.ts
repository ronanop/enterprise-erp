/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  buildAssignmentTimeline,
  buildMaintenanceTimeline,
  mapApiLifecycleEvents,
} from "@/domain/asset-lifecycle-timeline";

describe("asset lifecycle timeline mappers", () => {
  it("maps assignment cycles with user and assign/return dates", () => {
    const events = buildAssignmentTimeline([
      {
        id: "a1",
        documentNumber: "ASN-1",
        status: "returned",
        assigneeLabel: "E001 — Ada",
        allocatedAt: "Sep 1, 2026",
        returnedAt: "Sep 10, 2026",
        allocatedAtRaw: "2026-09-01T10:00:00.000Z",
        returnedAtRaw: "2026-09-10T16:00:00.000Z",
        assignmentRemarks: "Issued for project",
        returnRemarks: "Returned OK",
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("returned");
    expect(events[0].title).toContain("Ada");
    expect(events[0].meta?.find((m) => m.label === "Assigned")?.value).toBe("Sep 1, 2026");
    expect(events[0].meta?.find((m) => m.label === "De-assigned")?.value).toBe("Sep 10, 2026");
  });

  it("maps maintenance cycles with entered and completed timestamps", () => {
    const events = buildMaintenanceTimeline([
      {
        id: "m1",
        document_number: "AMNT-1",
        status: "completed",
        maintenance_type: "corrective",
        reason: "Screen",
        created_at: "2026-09-12T08:00:00.000Z",
        completed_date: "2026-09-14",
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("maintenance_completed");
    expect(events[0].maintenanceId).toBe("m1");
    expect(events[0].meta?.find((m) => m.label === "Entered maintenance")?.value).not.toBe("—");
    expect(events[0].meta?.find((m) => m.label === "Completed")?.value).not.toBe("—");
  });

  it("maps API lifecycle events for activity logs", () => {
    const events = mapApiLifecycleEvents([
      {
        id: "1",
        kind: "created",
        stage: "Created",
        title: "Asset added to register",
        occurred_at: "2026-09-01T10:00:00.000Z",
        reference_label: "AST-1",
      },
    ]);
    expect(events[0].kind).toBe("created");
    expect(events[0].occurredAt).toBe("2026-09-01T10:00:00.000Z");
  });
});
