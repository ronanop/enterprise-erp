/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  AssignmentWizard,
  ReturnWizard,
  WizardFooter,
  WizardProgressBar,
  WizardStepper,
  ASSIGNMENT_WIZARD_STEPS,
  RETURN_WIZARD_STEPS,
  EMPTY_ASSIGNMENT_WIZARD_STATE,
} from "@/components/assets/assignment-wizard";
import { validateAssignmentStep, validateReturnStep, listMissingAssignmentFields } from "@/components/assets/assignment-wizard/wizard-validation";
import { AssetStep } from "@/components/assets/assignment-wizard/steps/asset-step";
import { IssuedItemsStep } from "@/components/assets/assignment-wizard/steps/issued-items-step";
import { ReturnConditionStep } from "@/components/assets/assignment-wizard/steps/return-condition-step";
import { WizardShell } from "@/components/assets/assignment-wizard/wizard-shell";

describe("validateReturnStep", () => {
  it("returns null for known steps", () => {
    expect(validateReturnStep(0)).toBeNull();
    expect(validateReturnStep(3)).toBeNull();
  });
});

describe("validateAssignmentStep issued step", () => {
  it("allows empty issued items on step 2", () => {
    expect(validateAssignmentStep(2, EMPTY_ASSIGNMENT_WIZARD_STATE)).toBeNull();
  });
});

describe("Delivery validation issued", () => {
  it("requires number for received status", () => {
    expect(
      validateAssignmentStep(3, {
        ...EMPTY_ASSIGNMENT_WIZARD_STATE,
        deliveryReferenceStatus: "received",
        deliveryReferenceNumber: "  ",
      }),
    ).toMatch(/required/i);
  });
});

describe("WizardStepper disabled future steps", () => {
  it("does not navigate to unvisited steps", () => {
    const onStepClick = vi.fn();
    render(
      <WizardStepper
        steps={ASSIGNMENT_WIZARD_STEPS}
        currentIndex={0}
        maxVisitedIndex={0}
        onStepClick={onStepClick}
      />,
    );
    const assetBtn = screen.getByRole("button", { name: /Asset/i });
    expect(assetBtn).toBeDisabled();
  });
});

describe("ReturnWizard cancel", () => {
  it("invokes onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ReturnWizard onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("WizardShell", () => {
  it("renders branch label when provided", () => {
    render(
      <WizardShell title="T" stepTitle="S" branchLabel="HQ" footer={<div />}>
        body
      </WizardShell>,
    );
    expect(screen.getByText(/Branch:/)).toBeInTheDocument();
    expect(screen.getByText("HQ")).toBeInTheDocument();
  });
});

describe("listMissingAssignmentFields", () => {
  it("lists employee and asset when empty", () => {
    const missing = listMissingAssignmentFields(EMPTY_ASSIGNMENT_WIZARD_STATE);
    expect(missing.map((m) => m.label)).toEqual(["Employee", "Asset"]);
  });

  it("requires manual name phone and deployed-to", () => {
    const missing = listMissingAssignmentFields({
      ...EMPTY_ASSIGNMENT_WIZARD_STATE,
      employeeSource: "MANUAL_ENTRY",
      assetId: "a1",
    });
    expect(missing.map((m) => m.id)).toEqual(["name", "phone", "deployed-to"]);
  });
});

describe("validateAssignmentStep", () => {
  it("requires employee on step 0", () => {
    expect(validateAssignmentStep(0, EMPTY_ASSIGNMENT_WIZARD_STATE)).toMatch(/employee/i);
  });

  it("passes employee step when employee selected", () => {
    expect(
      validateAssignmentStep(0, { ...EMPTY_ASSIGNMENT_WIZARD_STATE, employeeId: "emp-1" }),
    ).toBeNull();
  });

  it("requires asset on step 1", () => {
    expect(validateAssignmentStep(1, EMPTY_ASSIGNMENT_WIZARD_STATE)).toMatch(/asset/i);
  });

  it("requires delivery number when status issued", () => {
    expect(
      validateAssignmentStep(3, {
        ...EMPTY_ASSIGNMENT_WIZARD_STATE,
        deliveryReferenceStatus: "issued",
        deliveryReferenceNumber: "",
      }),
    ).toMatch(/reference number/i);
  });

  it("allows pending without delivery number", () => {
    expect(
      validateAssignmentStep(3, {
        ...EMPTY_ASSIGNMENT_WIZARD_STATE,
        deliveryReferenceStatus: "pending",
        deliveryReferenceNumber: "",
      }),
    ).toBeNull();
  });
});

describe("WizardStepper", () => {
  it("marks current step with aria-current", () => {
    render(
      <WizardStepper
        steps={ASSIGNMENT_WIZARD_STEPS}
        currentIndex={1}
        maxVisitedIndex={2}
        onStepClick={vi.fn()}
      />,
    );
    const nav = screen.getByRole("navigation", { name: /wizard progress/i });
    const current = within(nav).getByRole("button", { current: "step" });
    expect(current).toHaveTextContent("Asset");
  });

  it("announces step position to screen readers", () => {
    render(
      <WizardStepper
        steps={ASSIGNMENT_WIZARD_STEPS}
        currentIndex={0}
        maxVisitedIndex={0}
      />,
    );
    expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
  });

  it("calls onStepClick for visited steps", async () => {
    const user = userEvent.setup();
    const onStepClick = vi.fn();
    render(
      <WizardStepper
        steps={ASSIGNMENT_WIZARD_STEPS}
        currentIndex={2}
        maxVisitedIndex={2}
        onStepClick={onStepClick}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Allocation & Employee/i }));
    expect(onStepClick).toHaveBeenCalledWith(0);
  });
});

describe("WizardProgressBar", () => {
  it("exposes progressbar with value", () => {
    render(<WizardProgressBar currentIndex={1} totalSteps={5} />);
    const bar = screen.getByRole("progressbar", { name: /wizard progress/i });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
  });
});

describe("WizardFooter", () => {
  it("shows Next on non-final step", () => {
    render(
      <WizardFooter
        isFirst
        isLast={false}
        onBack={vi.fn()}
        onNext={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create draft/i })).not.toBeInTheDocument();
  });

  it("shows finish label on last step", () => {
    render(
      <WizardFooter
        isFirst={false}
        isLast
        finishLabel="Confirm return"
        onBack={vi.fn()}
        onNext={vi.fn()}
        onCancel={vi.fn()}
        onFinish={vi.fn()}
        showSaveDraft={false}
      />,
    );
    expect(screen.getByRole("button", { name: /Confirm return/i })).toBeInTheDocument();
  });

  it("invokes onNext when Next clicked", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(
      <WizardFooter
        isFirst
        isLast={false}
        onBack={vi.fn()}
        onNext={onNext}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Next/i }));
    expect(onNext).toHaveBeenCalled();
  });
});

describe("AssignmentWizard", () => {
  it("renders issue asset title and all sections without step gating", () => {
    render(<AssignmentWizard onCancel={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /Issue asset/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Allocation & Employee/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Asset$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Issued Items/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Delivery \(DC paperwork\)/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Review & Submit/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Next$/i })).not.toBeInTheDocument();
  });

  it("disables submit and lists missing fields", () => {
    render(<AssignmentWizard onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^Submit$/i })).toBeDisabled();
    expect(screen.getByTestId("issue-missing-summary")).toHaveTextContent(/Employee/i);
    expect(screen.getByTestId("issue-missing-summary")).toHaveTextContent(/Asset/i);
  });

  it("enables submit when required fields are present and calls onFinish", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(
      <AssignmentWizard
        onCancel={vi.fn()}
        onFinish={onFinish}
        initialState={{
          employeeId: "emp-1",
          assetId: "asset-1",
          deliveryReferenceStatus: "pending",
        }}
      />,
    );
    expect(screen.getByRole("button", { name: /^Submit$/i })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /^Submit$/i }));
    expect(onFinish).toHaveBeenCalled();
  });

  it("calls onSaveDraft from footer without requiring completeness", async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn();
    render(<AssignmentWizard onCancel={vi.fn()} onSaveDraft={onSaveDraft} />);
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    expect(onSaveDraft).toHaveBeenCalled();
  });

  it("shows loading skeleton in shell", () => {
    render(
      <WizardShell
        title="T"
        stepTitle="S"
        loading
        footer={<div />}
      >
        child
      </WizardShell>,
    );
    expect(screen.getByLabelText(/Loading wizard step/i)).toBeInTheDocument();
  });
});

describe("ReturnWizard", () => {
  it("renders return asset heading", () => {
    render(<ReturnWizard onCancel={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /Return asset/i })).toBeInTheDocument();
    expect(screen.getByText(/AASN-2026-000088/)).toBeInTheDocument();
  });

  it("navigates to condition step", async () => {
    const user = userEvent.setup();
    render(<ReturnWizard onCancel={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText(/How is the asset being returned/i)).toBeInTheDocument();
  });

  it("selects outdated condition", async () => {
    const user = userEvent.setup();
    render(<ReturnWizard onCancel={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Next/i }));
    await user.click(screen.getByRole("radio", { name: /Outdated/i }));
    await user.click(screen.getByRole("button", { name: /Next/i }));
    await user.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByLabelText(/Return remarks/i)).toBeInTheDocument();
  });

  it("calls onFinish on confirm", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<ReturnWizard onCancel={vi.fn()} onFinish={onFinish} />);
    for (let i = 0; i < 4; i += 1) {
      await user.click(screen.getByRole("button", { name: /Next/i }));
    }
    await user.click(screen.getByRole("button", { name: /Confirm return/i }));
    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({ returnCondition: "good" }),
    );
  });
});

describe("ReturnConditionStep", () => {
  it("defaults to good", () => {
    render(
      <ReturnConditionStep
        state={{ returnCondition: "good", returnRemarks: "", reason: "", componentReturns: [] }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: /Good/i })).toBeChecked();
  });
});

describe("AssetStep empty state", () => {
  it("shows empty state when no assets", () => {
    render(
      <AssetStep state={EMPTY_ASSIGNMENT_WIZARD_STATE} onChange={vi.fn()} assets={[]} />,
    );
    expect(screen.getByTestId("assignment-no-ready-assets")).toBeInTheDocument();
    expect(screen.getByText("No assets are currently ready to move.")).toBeInTheDocument();
    expect(
      screen.getByText("Register and approve an asset before assigning it."),
    ).toBeInTheDocument();
  });

  it("shows unavailable deep-link message and choose-another action", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <AssetStep
        state={EMPTY_ASSIGNMENT_WIZARD_STATE}
        onChange={vi.fn()}
        assets={[]}
        unavailableAssetMessage="Choose another Ready to Move asset."
        onClearUnavailableAsset={onClear}
      />,
    );
    expect(screen.getByTestId("assignment-asset-unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("This asset is no longer available for assignment."),
    ).toBeInTheDocument();
    expect(screen.getByText("Choose another Ready to Move asset.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Choose another asset/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it("lists only provided eligible assets with operational badge", () => {
    render(
      <AssetStep
        state={EMPTY_ASSIGNMENT_WIZARD_STATE}
        onChange={vi.fn()}
        assets={[
          {
            id: "a1",
            label: "Laptop One",
            code: "AST-1",
            operationalStatus: "READY_TO_MOVE",
            lifecycleStatus: "active",
            branchLabel: "HQ",
            branchId: "b1",
            serialNumber: "SN-1",
            make: "Dell",
            model: "5420",
          },
        ]}
      />,
    );
    expect(screen.getByRole("option", { name: /Laptop One/i })).toBeInTheDocument();
    expect(screen.getByText("Ready to Move")).toBeInTheDocument();
    expect(screen.getByText(/S\/N: SN-1/)).toBeInTheDocument();
    expect(screen.queryByText("Assigned")).not.toBeInTheDocument();
  });
});

describe("IssuedItemsStep empty state", () => {
  it("shows no accessories message", () => {
    render(
      <IssuedItemsStep state={EMPTY_ASSIGNMENT_WIZARD_STATE} onChange={vi.fn()} items={[]} />,
    );
    expect(screen.getByText(/No registered accessories/i)).toBeInTheDocument();
  });
});

describe("RETURN_WIZARD_STEPS", () => {
  it("has five steps including components reconciliation", () => {
    expect(RETURN_WIZARD_STEPS).toHaveLength(5);
  });
});

describe("ASSIGNMENT_WIZARD_STEPS", () => {
  it("matches freeze labels", () => {
    expect(ASSIGNMENT_WIZARD_STEPS.map((s) => s.label)).toEqual([
      "Allocation & Employee",
      "Asset",
      "Issued Items",
      "Delivery (DC paperwork)",
      "Review & Submit",
    ]);
  });
});

describe("AssignmentWizard cancel", () => {
  it("calls onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<AssignmentWizard onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("WizardFooter back", () => {
  it("hides back on first step", () => {
    render(
      <WizardFooter
        isFirst
        isLast={false}
        onBack={vi.fn()}
        onNext={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Back/i })).not.toBeInTheDocument();
  });
});

describe("responsive layout", () => {
  it("does not render a step progress bar on the issue form", () => {
    const { container } = render(<AssignmentWizard onCancel={vi.fn()} />);
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });
});
