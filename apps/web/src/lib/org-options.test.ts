import { beforeEach, describe, expect, it, vi } from "vitest";

const listMock = vi.fn();

vi.mock("@/services/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  resourceService: {
    list: (...args: unknown[]) => listMock(...args),
  },
}));

import {
  ASSET_DEPARTMENT_DIRECTORY_STATUSES,
  ASSET_EMPLOYEE_DIRECTORY_STATUSES,
  listDepartmentOptions,
  listEmployeeDirectory,
} from "@/lib/org-options";

describe("listEmployeeDirectory", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("uses active / probation / on_leave statuses contract", () => {
    expect([...ASSET_EMPLOYEE_DIRECTORY_STATUSES]).toEqual([
      "active",
      "probation",
      "on_leave",
    ]);
  });

  it("loads from asset-employees and maps department labels", async () => {
    listMock.mockResolvedValue({
      data: {
        items: [
          {
            id: "e1",
            employee_code: "CT5329",
            first_name: "Asha",
            last_name: "Almia",
            display_name: "Asha Almia",
            department_id: "d1",
            department_name: "Sales",
            status: "active",
          },
        ],
        total: 1,
      },
    });

    const rows = await listEmployeeDirectory({ throwOnError: true });

    expect(listMock).toHaveBeenCalledWith(
      expect.stringContaining("/assets/asset-employees?limit="),
    );
    expect(rows).toEqual([
      {
        id: "e1",
        displayName: "Asha Almia",
        label: "Asha Almia (CT5329) · Sales",
        employeeCode: "CT5329",
        mobile: null,
      },
    ]);
  });
});

describe("listDepartmentOptions", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("uses active-only status contract", () => {
    expect([...ASSET_DEPARTMENT_DIRECTORY_STATUSES]).toEqual(["active"]);
  });

  it("loads from asset-departments (org_department)", async () => {
    listMock.mockResolvedValue({
      data: {
        items: [
          {
            id: "d1",
            department_code: "ADMIN",
            department_name: "Admin",
            status: "active",
          },
        ],
        total: 1,
      },
    });

    const rows = await listDepartmentOptions({ throwOnError: true });

    expect(listMock).toHaveBeenCalledWith(
      expect.stringContaining("/assets/asset-departments?limit="),
    );
    expect(rows).toEqual([{ id: "d1", label: "Admin" }]);
  });
});
