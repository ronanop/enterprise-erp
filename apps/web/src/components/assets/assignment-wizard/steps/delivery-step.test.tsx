/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeliveryStep } from "@/components/assets/assignment-wizard/steps/delivery-step";
import { EMPTY_ASSIGNMENT_WIZARD_STATE } from "@/components/assets/assignment-wizard/wizard-types";

afterEach(() => cleanup());

describe("DeliveryStep", () => {
  it("renders DC number, status, and signature fields", () => {
    render(
      <DeliveryStep
        state={{
          ...EMPTY_ASSIGNMENT_WIZARD_STATE,
          deliveryReferenceNumber: "DC-2026-001",
          deliveryReferenceStatus: "issued",
          deliveryChallanSignatureStatus: "signed",
        }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Delivery Challan")).toBeTruthy();
    expect(screen.getByLabelText(/DC Number/i)).toHaveValue("DC-2026-001");
    expect(screen.getByLabelText(/DC Status/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Signature/i)).toBeTruthy();
  });

  it("updates DC number via onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DeliveryStep state={EMPTY_ASSIGNMENT_WIZARD_STATE} onChange={onChange} />,
    );
    await user.type(screen.getByLabelText(/DC Number/i), "X");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.some((c) => c[0].deliveryReferenceNumber === "X")).toBe(true);
  });
});
