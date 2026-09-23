/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeliveryStep } from "@/components/assets/assignment-wizard/steps/delivery-step";
import { EMPTY_ASSIGNMENT_WIZARD_STATE } from "@/components/assets/assignment-wizard/wizard-types";

afterEach(() => cleanup());

describe("DeliveryStep", () => {
  it("hides DC number/status/signature for employee Handle later (defaults apply)", () => {
    render(
      <DeliveryStep state={EMPTY_ASSIGNMENT_WIZARD_STATE} onChange={vi.fn()} />,
    );
    expect(screen.getByText("Delivery Challan")).toBeTruthy();
    expect(screen.queryByLabelText(/DC Number/i)).toBeNull();
    expect(screen.queryByLabelText(/DC Status/i)).toBeNull();
    expect(screen.queryByLabelText(/^Signature/i)).toBeNull();
    expect(screen.getByTestId("dc-handle-later-hint")).toHaveTextContent(/Pending · Not signed/i);
    expect(screen.getByLabelText(/Assignment remarks/i)).toBeTruthy();
  });

  it("resets delivery reference defaults when selecting Handle later", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DeliveryStep
        state={{
          ...EMPTY_ASSIGNMENT_WIZARD_STATE,
          dcChallanMode: "create_now",
          deliveryReferenceNumber: "DC-OLD",
          deliveryReferenceStatus: "issued",
          deliveryChallanSignatureStatus: "signed",
        }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Handle later/i }));
    expect(onChange).toHaveBeenCalledWith({
      dcChallanMode: "later",
      dcChallanId: "",
      deliveryReferenceNumber: "",
      deliveryReferenceStatus: "pending",
      deliveryChallanSignatureStatus: "not_signed",
    });
  });

  it("shows DC number, status, and signature for warehouse allocation", () => {
    render(
      <DeliveryStep
        state={{
          ...EMPTY_ASSIGNMENT_WIZARD_STATE,
          allocationType: "warehouse",
          deliveryReferenceNumber: "DC-2026-001",
          deliveryReferenceStatus: "issued",
          deliveryChallanSignatureStatus: "signed",
        }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/DC Number/i)).toHaveValue("DC-2026-001");
    expect(screen.getByLabelText(/DC Status/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Signature/i)).toBeTruthy();
  });

  it("updates DC number via onChange for non-employee allocation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DeliveryStep
        state={{ ...EMPTY_ASSIGNMENT_WIZARD_STATE, allocationType: "warehouse" }}
        onChange={onChange}
      />,
    );
    await user.type(screen.getByLabelText(/DC Number/i), "X");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.some((c) => c[0].deliveryReferenceNumber === "X")).toBe(true);
  });

  it("shows three DC modes for employee allocation", () => {
    render(
      <DeliveryStep state={EMPTY_ASSIGNMENT_WIZARD_STATE} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /Create DC now/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Link existing/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Handle later/i })).toBeTruthy();
    expect(
      screen.getByText(/Most assets don't need a DC at handover/i),
    ).toBeTruthy();
    expect(screen.getByText(/Needs DC before or at handover/i)).toBeTruthy();
    expect(screen.getByText(/Attach a challan prepared in advance/i)).toBeTruthy();
    expect(screen.getByText(/create DC from Operations later/i)).toBeTruthy();
  });

  it("keeps Handle later as the default selected mode", () => {
    render(
      <DeliveryStep state={EMPTY_ASSIGNMENT_WIZARD_STATE} onChange={vi.fn()} />,
    );
    const later = screen.getByRole("button", { name: /Handle later/i });
    expect(later.getAttribute("class")).toMatch(/0369A1|rgba\(3,\s*105,\s*161/);
  });

  it("hides Create DC modes for warehouse allocation", () => {
    render(
      <DeliveryStep
        state={{ ...EMPTY_ASSIGNMENT_WIZARD_STATE, allocationType: "warehouse" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Create DC now/i })).toBeNull();
    expect(screen.getByText(/employee-only/i)).toBeTruthy();
    expect(screen.getByLabelText(/DC Number/i)).toBeTruthy();
  });
});
