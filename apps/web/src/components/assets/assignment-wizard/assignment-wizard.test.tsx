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
  PREFILLED_ASSIGNMENT_WIZARD_STEPS,
  RETURN_WIZARD_STEPS,
  EMPTY_ASSIGNMENT_WIZARD_STATE,
} from "@/components/assets/assignment-wizard";
import { validateAssignmentStep, validateReturnStep } from "@/components/assets/assignment-wizard/wizard-validation";
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
    ).toMatch(/required/i);
  });

  it("allows Not Applicable (pending) without delivery number", () => {
    expect(
      validateAssignmentStep(3, {
        ...EMPTY_ASSIGNMENT_WIZARD_STATE,
        deliveryReferenceStatus: "pending",
        deliveryReferenceNumber: "",
      }),
    ).toBeNull();
  });

  it("requires delivery number when status received", () => {
    expect(
      validateAssignmentStep(3, {
        ...EMPTY_ASSIGNMENT_WIZARD_STATE,
        deliveryReferenceStatus: "received",
        deliveryReferenceNumber: "",
      }),
    ).toMatch(/required/i);
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
    await user.click(screen.getByRole("button", { name: /Employee Information/i }));
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
  it("renders issue asset title and first step", () => {
    render(<AssignmentWizard onCancel={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /Issue asset/i })).toBeInTheDocument();
    expect(screen.getByTestId("employee-information-section")).toBeInTheDocument();
  });

  it("blocks next without employee", async () => {
    const user = userEvent.setup();
    render(<AssignmentWizard onCancel={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/employee/i);
    expect(screen.getByTestId("employee-information-section")).toBeInTheDocument();
  });

  it("advances to asset step when employee preset", async () => {
    const user = userEvent.setup();
    render(
      <AssignmentWizard
        onCancel={vi.fn()}
        initialState={{ employeeId: "emp-1" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText(/Select a Ready To Move asset/i)).toBeInTheDocument();
  });

  it("reaches review step and calls onFinish", async () => {
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
    await user.click(screen.getByRole("button", { name: /Next/i }));
    await user.click(screen.getByRole("button", { name: /Next/i }));
    await user.click(screen.getByRole("button", { name: /Next/i }));
    await user.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText(/Confirm to submit this assignment/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    expect(onFinish).toHaveBeenCalled();
  });

  it("starts on read-only asset step when asset is prefilled", () => {
    render(
      <AssignmentWizard
        onCancel={vi.fn()}
        prefilledAsset
        initialState={{ assetId: "asset-1" }}
        assets={[
          {
            id: "asset-1",
            code: "AST-1",
            label: "ThinkPad",
            operationalStatus: "READY_TO_MOVE",
            branchLabel: "HQ",
          },
        ]}
      />,
    );
    expect(screen.getByTestId("asset-information-section")).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: /Select asset/i })).not.toBeInTheDocument();
    expect(screen.getByText(/prefilled from the register drawer/i)).toBeInTheDocument();
  });

  it("moves from prefilled asset step to employee step", async () => {
    const user = userEvent.setup();
    render(
      <AssignmentWizard
        onCancel={vi.fn()}
        prefilledAsset
        initialState={{ assetId: "asset-1" }}
        assets={[
          {
            id: "asset-1",
            code: "AST-1",
            label: "ThinkPad",
            operationalStatus: "READY_TO_MOVE",
            branchLabel: "HQ",
          },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByTestId("employee-information-section")).toBeInTheDocument();
  });

  it("calls onSaveDraft from footer", async () => {
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
    expect(screen.getByLabelText(/Return remarks/i)).toBeInTheDocument();
  });

  it("calls onFinish on confirm", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<ReturnWizard onCancel={vi.fn()} onFinish={onFinish} />);
    for (let i = 0; i < 3; i += 1) {
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
        state={{ returnCondition: "good", returnRemarks: "", reason: "" }}
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
    expect(screen.getByText(/No ready assets/i)).toBeInTheDocument();
  });
});

describe("IssuedItemsStep empty state", () => {
  it("falls back to standard accessory checklist when items empty", () => {
    render(
      <IssuedItemsStep state={EMPTY_ASSIGNMENT_WIZARD_STATE} onChange={vi.fn()} items={[]} />,
    );
    expect(screen.getByText("Charger")).toBeInTheDocument();
    expect(screen.getByText("Other Items")).toBeInTheDocument();
  });
});

describe("RETURN_WIZARD_STEPS", () => {
  it("has four steps", () => {
    expect(RETURN_WIZARD_STEPS).toHaveLength(4);
  });
});

describe("ASSIGNMENT_WIZARD_STEPS", () => {
  it("matches CRUD section labels", () => {
    expect(ASSIGNMENT_WIZARD_STEPS.map((s) => s.label)).toEqual([
      "Employee Information",
      "Asset Information",
      "Issued Items",
      "Assignment Details",
      "Review & Confirm",
    ]);
  });
});

describe("PREFILLED_ASSIGNMENT_WIZARD_STEPS", () => {
  it("starts with asset information for drawer launches", () => {
    expect(PREFILLED_ASSIGNMENT_WIZARD_STEPS.map((s) => s.id)).toEqual([
      "asset",
      "employee",
      "issued-items",
      "delivery",
      "review",
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
  it("renders mobile progress bar in assignment wizard", () => {
    const { container } = render(<AssignmentWizard onCancel={vi.fn()} />);
    expect(container.querySelector('[role="progressbar"]')).toBeTruthy();
  });
});
