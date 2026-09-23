/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_USER_TRANSFER_VERIFICATION } from "@/components/assets/user-transfer-verification";
import {
  EMPTY_USER_TRANSFER_ASSIGN,
  EMPTY_USER_TRANSFER_RETURN,
} from "@/components/assets/user-transfer-destination";
import { UserTransferWorkspace } from "@/components/assets/user-transfer-workspace";
import type { UserTransferContext } from "@/services/assets-service";

afterEach(() => cleanup());

const sample: UserTransferContext = {
  asset_id: "a1",
  asset_code: "AST-003",
  asset_name: "Dell Latitude 5440",
  operational_status: "ASSIGNED",
  lifecycle_status: "active",
  current_user: "EMP-01 — Rahul Sharma",
  department_name: "IT",
  location_label: "Noida · CRC-1",
  assignment_id: "asn-1",
  assignment_document_number: "AASN-2026-000001",
  assignment_status: "active",
  components: [],
  company_id: "c1",
  branch_id: "b1",
  version: 1,
};

const withComponents: UserTransferContext = {
  ...sample,
  components: [
    {
      component_id: "c1",
      assignment_component_id: "ac1",
      component_name: "Laptop Charger",
      component_type: "CHARGER",
      serial_number: "CHG-1",
      issue_status: "ISSUED",
    },
    {
      component_id: "c2",
      assignment_component_id: "ac2",
      component_name: "Mouse",
      component_type: "MOUSE",
      issue_status: "ISSUED",
    },
  ],
};

describe("UserTransferWorkspace Step 2", () => {
  it("renders asset and assignment details from backend context", () => {
    render(
      <UserTransferWorkspace
        assetId="a1"
        context={sample}
        loading={false}
        errorMessage={null}
        verification={EMPTY_USER_TRANSFER_VERIFICATION}
        onVerificationChange={vi.fn()}
        stage="verification"
        onContinue={vi.fn()}
        onRetry={vi.fn()}
        onBackToInventory={vi.fn()}
      />,
    );
    expect(screen.getByTestId("user-transfer-asset-summary")).toBeInTheDocument();
    expect(screen.getByTestId("user-transfer-assignment")).toBeInTheDocument();
    expect(screen.getByTestId("user-transfer-verification")).toBeInTheDocument();
    expect(screen.getByText("AST-003")).toBeInTheDocument();
    expect(screen.getAllByText("EMP-01 — Rahul Sharma").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("no-components")).toBeInTheDocument();
  });

  it("keeps Continue disabled until all checks complete (no components)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <UserTransferWorkspace
        assetId="a1"
        context={sample}
        loading={false}
        errorMessage={null}
        verification={EMPTY_USER_TRANSFER_VERIFICATION}
        onVerificationChange={onChange}
        stage="verification"
        onContinue={vi.fn()}
        onRetry={vi.fn()}
        onBackToInventory={vi.fn()}
      />,
    );
    expect(screen.getByTestId("continue-transfer")).toBeDisabled();

    await user.click(screen.getByTestId("check-data-backup"));
    expect(onChange).toHaveBeenCalledWith({ dataBackupVerified: true });

    rerender(
      <UserTransferWorkspace
        assetId="a1"
        context={sample}
        loading={false}
        errorMessage={null}
        verification={{
          ...EMPTY_USER_TRANSFER_VERIFICATION,
          dataBackupVerified: true,
          qcCompleted: true,
          physicalCondition: "good",
        }}
        onVerificationChange={onChange}
        stage="verification"
        onContinue={vi.fn()}
        onRetry={vi.fn()}
        onBackToInventory={vi.fn()}
      />,
    );
    expect(screen.getByTestId("continue-transfer")).not.toBeDisabled();
  });

  it("keeps Continue disabled when components are incomplete", () => {
    render(
      <UserTransferWorkspace
        assetId="a1"
        context={withComponents}
        loading={false}
        errorMessage={null}
        verification={{
          ...EMPTY_USER_TRANSFER_VERIFICATION,
          dataBackupVerified: true,
          qcCompleted: true,
          physicalCondition: "good",
          verifiedComponentIds: ["c1"],
        }}
        onVerificationChange={vi.fn()}
        stage="verification"
        onContinue={vi.fn()}
        onRetry={vi.fn()}
        onBackToInventory={vi.fn()}
      />,
    );
    expect(screen.getByText("Laptop Charger")).toBeInTheDocument();
    expect(screen.getByText("Mouse")).toBeInTheDocument();
    expect(screen.getByTestId("continue-transfer")).toBeDisabled();
  });

  it("enables Continue when all components verified", () => {
    render(
      <UserTransferWorkspace
        assetId="a1"
        context={withComponents}
        loading={false}
        errorMessage={null}
        verification={{
          ...EMPTY_USER_TRANSFER_VERIFICATION,
          dataBackupVerified: true,
          qcCompleted: true,
          physicalCondition: "good",
          verifiedComponentIds: ["c1", "c2"],
        }}
        onVerificationChange={vi.fn()}
        stage="verification"
        onContinue={vi.fn()}
        onRetry={vi.fn()}
        onBackToInventory={vi.fn()}
      />,
    );
    expect(screen.getByTestId("continue-transfer")).not.toBeDisabled();
  });

  it("shows destination decision after verification stage", () => {
    render(
      <UserTransferWorkspace
        assetId="a1"
        context={sample}
        loading={false}
        errorMessage={null}
        verification={{
          ...EMPTY_USER_TRANSFER_VERIFICATION,
          dataBackupVerified: true,
          qcCompleted: true,
          physicalCondition: "good",
        }}
        onVerificationChange={vi.fn()}
        stage="destination"
        verificationResult={{
          verification_id: "v1",
          asset_id: "a1",
          assignment_id: "asn-1",
          data_backup_verified: true,
          qc_completed: true,
          physical_condition: "good",
          verified_component_ids: [],
          verified_at: "2026-09-16T00:00:00Z",
          status: "verified",
        }}
        assignForm={EMPTY_USER_TRANSFER_ASSIGN}
        returnForm={EMPTY_USER_TRANSFER_RETURN}
        onContinue={vi.fn()}
        onRetry={vi.fn()}
        onBackToInventory={vi.fn()}
        onBackToVerification={vi.fn()}
      />,
    );
    expect(screen.getByTestId("user-transfer-destination")).toBeInTheDocument();
    expect(screen.getByTestId("destination-assign-card")).toBeInTheDocument();
    expect(screen.getByTestId("destination-return-card")).toBeInTheDocument();
  });

  it("shows error state when not eligible", () => {
    render(
      <UserTransferWorkspace
        assetId="a1"
        context={null}
        loading={false}
        errorMessage="Only assigned assets can enter the user transfer flow."
        verification={EMPTY_USER_TRANSFER_VERIFICATION}
        onVerificationChange={vi.fn()}
        stage="verification"
        onContinue={vi.fn()}
        onRetry={vi.fn()}
        onBackToInventory={vi.fn()}
      />,
    );
    expect(screen.getByText("Transfer not available")).toBeInTheDocument();
  });
});
