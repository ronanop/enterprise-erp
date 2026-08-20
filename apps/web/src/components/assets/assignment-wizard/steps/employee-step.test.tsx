/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmployeeStep } from "@/components/assets/assignment-wizard/steps/employee-step";
import { EMPTY_ASSIGNMENT_WIZARD_STATE } from "@/components/assets/assignment-wizard/wizard-types";
import type { WizardEmployeeOption } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";

afterEach(() => {
  cleanup();
});

const employees: WizardEmployeeOption[] = [
  {
    id: "e1",
    label: "Asha Nair (EMP-001)",
    employeeCode: "EMP-001",
    name: "Asha Nair",
    department: "Engineering",
    departmentId: "d1",
    designation: "Developer",
    branch: "Noida",
    phone: "9876543210",
    email: "asha@example.com",
    manager: "Rohan Mehta",
    employmentStatus: "active",
  },
  {
    id: "e2",
    label: "Neha Kapoor (EMP-003)",
    employeeCode: "EMP-003",
    name: "Neha Kapoor",
    department: "HR",
    designation: "HR Lead",
    branch: "Mumbai",
    phone: "9123456780",
    email: "neha@example.com",
    manager: "Asha Nair",
    employmentStatus: "on_leave",
  },
];

describe("EmployeeStep (Employee Information)", () => {
  it("shows empty state before selection", () => {
    render(
      <EmployeeStep
        state={EMPTY_ASSIGNMENT_WIZARD_STATE}
        onChange={vi.fn()}
        employees={employees}
      />,
    );
    expect(screen.getByTestId("employee-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No employee selected")).toBeInTheDocument();
    expect(screen.queryByTestId("employee-profile-fields")).not.toBeInTheDocument();
  });

  it("shows loading skeleton while fetching", () => {
    render(
      <EmployeeStep
        state={EMPTY_ASSIGNMENT_WIZARD_STATE}
        onChange={vi.fn()}
        employees={[]}
        loading
      />,
    );
    expect(screen.getByTestId("employee-info-skeleton")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading employees")).toBeInTheDocument();
    expect(screen.queryByTestId("employee-empty-state")).not.toBeInTheDocument();
  });

  it("auto-fills read-only profile fields after selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EmployeeStep
        state={EMPTY_ASSIGNMENT_WIZARD_STATE}
        onChange={onChange}
        employees={employees}
      />,
    );

    await user.type(screen.getByTestId("employee-search-input"), "EMP-001");
    await user.click(
      within(screen.getByTestId("employee-search-results")).getByRole("button", {
        name: /Asha Nair/i,
      }),
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: "e1", departmentId: "d1" }),
    );
  });

  it("renders all profile fields for selected employee", () => {
    render(
      <EmployeeStep
        state={{ ...EMPTY_ASSIGNMENT_WIZARD_STATE, employeeId: "e1" }}
        onChange={vi.fn()}
        employees={employees}
      />,
    );
    const profile = screen.getByTestId("employee-profile-fields");
    expect(within(profile).getByText("Employee ID")).toBeInTheDocument();
    expect(within(profile).getByText("EMP-001")).toBeInTheDocument();
    expect(within(profile).getByText("Employee Name")).toBeInTheDocument();
    expect(within(profile).getByText("Asha Nair")).toBeInTheDocument();
    expect(within(profile).getByText("Department")).toBeInTheDocument();
    expect(within(profile).getByText("Engineering")).toBeInTheDocument();
    expect(within(profile).getByText("Designation")).toBeInTheDocument();
    expect(within(profile).getByText("Developer")).toBeInTheDocument();
    expect(within(profile).getByText("Branch")).toBeInTheDocument();
    expect(within(profile).getByText("Noida")).toBeInTheDocument();
    expect(within(profile).getByText("Phone Number")).toBeInTheDocument();
    expect(within(profile).getByText("9876543210")).toBeInTheDocument();
    expect(within(profile).getByText("Email")).toBeInTheDocument();
    expect(within(profile).getByText("asha@example.com")).toBeInTheDocument();
    expect(within(profile).getByText("Manager")).toBeInTheDocument();
    expect(within(profile).getByText("Rohan Mehta")).toBeInTheDocument();
    expect(within(profile).getByText("Employment Status")).toBeInTheDocument();
    expect(within(profile).getByText("active")).toBeInTheDocument();
  });

  it("filters search results by employee id or name", async () => {
    const user = userEvent.setup();
    render(
      <EmployeeStep
        state={EMPTY_ASSIGNMENT_WIZARD_STATE}
        onChange={vi.fn()}
        employees={employees}
      />,
    );
    await user.type(screen.getByTestId("employee-search-input"), "Neha");
    const results = screen.getByTestId("employee-search-results");
    expect(within(results).getByText("Neha Kapoor")).toBeInTheDocument();
    expect(within(results).queryByText("Asha Nair")).not.toBeInTheDocument();
  });

  it("selects employee from search result list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EmployeeStep
        state={EMPTY_ASSIGNMENT_WIZARD_STATE}
        onChange={onChange}
        employees={employees}
      />,
    );
    await user.type(screen.getByTestId("employee-search-input"), "EMP-003");
    await user.click(within(screen.getByTestId("employee-search-results")).getByText("Neha Kapoor"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ employeeId: "e2" }));
  });
});
