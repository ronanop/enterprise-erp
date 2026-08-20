/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmployeeStep } from "@/components/assets/assignment-wizard/steps/employee-step";
import { AssetStep } from "@/components/assets/assignment-wizard/steps/asset-step";
import { AssignmentReviewStep } from "@/components/assets/assignment-wizard/steps/assignment-review-step";
import { ReturnSummaryStep } from "@/components/assets/assignment-wizard/steps/return-summary-step";
import { ReturnReviewStep } from "@/components/assets/assignment-wizard/steps/return-review-step";
import {
  EMPTY_ASSIGNMENT_WIZARD_STATE,
  EMPTY_RETURN_WIZARD_STATE,
} from "@/components/assets/assignment-wizard/wizard-types";
import { OperationsQuickActions } from "@/components/assets/operations-quick-actions";

afterEach(() => cleanup());

describe("Asset CRUD — no demo placeholders", () => {
  it("EmployeeStep shows empty directory instead of mock employees", () => {
    render(
      <EmployeeStep
        state={EMPTY_ASSIGNMENT_WIZARD_STATE}
        onChange={vi.fn()}
        employees={[]}
      />,
    );
    expect(screen.getByTestId("employee-directory-empty")).toBeInTheDocument();
    expect(screen.queryByText("Priya Sharma")).not.toBeInTheDocument();
  });

  it("EmployeeStep lists real employees when provided", () => {
    render(
      <EmployeeStep
        state={EMPTY_ASSIGNMENT_WIZARD_STATE}
        onChange={vi.fn()}
        employees={[{ id: "e1", label: "Real Emp", name: "Real Emp", employeeCode: "E-1" }]}
      />,
    );
    expect(screen.getByTestId("employee-select")).toBeInTheDocument();
    expect(screen.queryByTestId("employee-directory-empty")).not.toBeInTheDocument();
  });

  it("AssetStep shows empty ready assets instead of mock Dell assets", () => {
    render(
      <AssetStep state={EMPTY_ASSIGNMENT_WIZARD_STATE} onChange={vi.fn()} assets={[]} />,
    );
    expect(screen.getByText("No ready assets")).toBeInTheDocument();
    expect(screen.queryByText("Dell Latitude")).not.toBeInTheDocument();
  });

  it("AssetStep lists API assets", () => {
    render(
      <AssetStep
        state={{ ...EMPTY_ASSIGNMENT_WIZARD_STATE, assetId: "a1" }}
        onChange={vi.fn()}
        assets={[
          {
            id: "a1",
            label: "ThinkPad",
            code: "AST-1",
            operationalStatus: "READY_TO_MOVE",
            branchLabel: "HQ",
            branchId: "b1",
          },
        ]}
      />,
    );
    expect(screen.getByRole("option", { name: /ThinkPad/ })).toBeInTheDocument();
    expect(screen.getAllByText("AST-1").length).toBeGreaterThan(0);
  });

  it("AssignmentReviewStep does not invent demo employee/asset labels", () => {
    render(
      <AssignmentReviewStep
        state={{
          ...EMPTY_ASSIGNMENT_WIZARD_STATE,
          employeeId: "missing",
          assetId: "missing",
        }}
        employees={[]}
        assets={[]}
      />,
    );
    expect(screen.queryByText("Priya Sharma")).not.toBeInTheDocument();
    expect(screen.queryByText("Dell Latitude 7440")).not.toBeInTheDocument();
  });

  it("ReturnSummaryStep shows empty state without demo summary", () => {
    render(<ReturnSummaryStep />);
    expect(screen.getByTestId("return-summary-empty")).toBeInTheDocument();
    expect(screen.queryByText("Demo summary")).not.toBeInTheDocument();
    expect(screen.queryByText("LT-2024-014")).not.toBeInTheDocument();
  });

  it("ReturnSummaryStep renders live summary", () => {
    render(
      <ReturnSummaryStep
        summary={{
          assetCode: "AST-88",
          assetName: "Live Laptop",
          serialNumber: "SN-88",
          operationalStatus: "ASSIGNED",
          documentNumber: "ASN-88",
          assigneeLabel: "Asha",
          allocatedAt: "2026-08-01",
          deliveryReferenceNumber: "DC-1",
        }}
      />,
    );
    expect(screen.getByTestId("return-summary-section")).toHaveTextContent("Live Laptop");
    expect(screen.getByText("ASN-88")).toBeInTheDocument();
  });

  it("ReturnReviewStep shows empty without summary", () => {
    render(<ReturnReviewStep state={EMPTY_RETURN_WIZARD_STATE} />);
    expect(screen.getByTestId("return-review-empty")).toBeInTheDocument();
  });

  it("Operations panel exposes Allocate Asset action", () => {
    const onAllocate = vi.fn();
    render(<OperationsQuickActions onAllocate={onAllocate} />);
    expect(screen.getByText("Allocate Asset")).toBeInTheDocument();
  });
});
