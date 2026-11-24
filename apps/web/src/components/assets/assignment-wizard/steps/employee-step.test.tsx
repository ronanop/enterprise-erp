/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmployeeStep } from "@/components/assets/assignment-wizard/steps/employee-step";
import { EMPTY_ASSIGNMENT_WIZARD_STATE } from "@/components/assets/assignment-wizard/wizard-types";

vi.mock("@/lib/org-options", () => ({
  listDepartmentOptions: vi.fn(async () => [{ id: "dept-1", label: "Finance" }]),
}));

describe("EmployeeStep manual entry", () => {
  it("defaults to directory mode", () => {
    render(<EmployeeStep state={EMPTY_ASSIGNMENT_WIZARD_STATE} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Employee \*/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Deployed to/i)).toBeNull();
  });

  it("offers only Employee and Department allocation types", async () => {
    const user = userEvent.setup();
    render(<EmployeeStep state={EMPTY_ASSIGNMENT_WIZARD_STATE} onChange={vi.fn()} />);
    await user.click(screen.getByLabelText(/Allocation type/i));
    expect(screen.getByRole("option", { name: "Employee" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Department" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /project/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /warehouse/i })).not.toBeInTheDocument();
  });

  it("shows department options when Department allocation is selected", async () => {
    const user = userEvent.setup();
    render(
      <EmployeeStep
        state={{ ...EMPTY_ASSIGNMENT_WIZARD_STATE, allocationType: "department" }}
        onChange={vi.fn()}
        departments={[{ id: "dept-1", label: "Finance" }]}
      />,
    );
    expect(screen.getByLabelText(/Department \*/i)).toBeInTheDocument();
    await user.click(screen.getByTestId("wiz-department-select"));
    expect(await screen.findByRole("option", { name: "Finance" })).toBeInTheDocument();
  });

  it("shows manual fields and clears directory employee when switching", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EmployeeStep
        state={{ ...EMPTY_ASSIGNMENT_WIZARD_STATE, employeeId: "e1" }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Enter manually/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ employeeSource: "MANUAL_ENTRY", employeeId: "" }),
    );
  });

  it("clears manual fields when switching back to directory", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EmployeeStep
        state={{
          ...EMPTY_ASSIGNMENT_WIZARD_STATE,
          employeeSource: "MANUAL_ENTRY",
          manualEmployeeName: "Riya",
          manualEmployeePhone: "999",
          manualEmployeeEmail: "a@b.c",
          manualEmployeeDeployedTo: "Airtel",
        }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /From directory/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeSource: "MASTER_DATA",
        manualEmployeeName: "",
        manualEmployeePhone: "",
        manualEmployeeEmail: "",
        manualEmployeeDeployedTo: "",
      }),
    );
  });
});
