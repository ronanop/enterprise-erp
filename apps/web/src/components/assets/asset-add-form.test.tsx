import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { AssetAddForm } from "@/components/assets/asset-add-form";
import { ApiClientError } from "@/services/api-client";

const push = vi.fn();
const create = vi.fn();
const update = vi.fn();
const action = vi.fn();
const get = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
}));

vi.mock("@/lib/org-options", () => ({
  listBranchOptions: vi.fn().mockResolvedValue([{ id: "b1", label: "Noida" }]),
}));

vi.mock("@/services/asset-site-location-service", () => ({
  listSiteLocations: vi.fn().mockResolvedValue([
    {
      id: "loc-mumbai",
      name: "Mumbai",
      is_head_office: false,
      org_location_id: null,
      company_id: "c1",
      version: 1,
    },
    {
      id: "loc-bangalore",
      name: "Bangalore",
      is_head_office: false,
      org_location_id: null,
      company_id: "c1",
      version: 1,
    },
  ]),
  listSiteBuildings: vi.fn().mockImplementation(async (locationId?: string) => {
    if (locationId === "loc-mumbai") {
      return [
        {
          id: "bld-crc1",
          location_id: "loc-mumbai",
          name: "CRC-1",
          company_id: "c1",
          version: 1,
        },
        {
          id: "bld-park",
          location_id: "loc-mumbai",
          name: "Mumbai IT Park",
          company_id: "c1",
          version: 1,
        },
      ];
    }
    if (locationId === "loc-bangalore") {
      return [
        {
          id: "bld-manyata",
          location_id: "loc-bangalore",
          name: "Manyata Tech Park",
          company_id: "c1",
          version: 1,
        },
      ];
    }
    return [];
  }),
}));

vi.mock("@/services/asset-type-service", () => ({
  listItAssetTypes: vi.fn().mockResolvedValue([
    {
      id: "type-laptop",
      name: "Laptop",
      active: true,
      requires_hardware_config: true,
      description: null,
      company_id: "co1",
      version: 1,
    },
    {
      id: "type-monitor",
      name: "Monitor",
      active: true,
      requires_hardware_config: false,
      description: null,
      company_id: "co1",
      version: 1,
    },
  ]),
}));

vi.mock("@/services/assets-service", () => ({
  buildSelfServiceUrl: (id: string) => `https://example.test/self/${id}`,
  assetCategoryService: {
    search: vi.fn().mockResolvedValue({
      items: [{ id: "c1", category_name: "Laptop", category_code: "IT", status: "active" }],
    }),
  },
  filterActiveCategories: <T,>(items: T[]) => items,
  assetRegistrationQueueService: {
    prefillFromIncoming: vi.fn(),
  },
  assetRegisterService: {
    create: (...args: unknown[]) => create(...args),
    update: (...args: unknown[]) => update(...args),
    action: (...args: unknown[]) => action(...args),
    get: (...args: unknown[]) => get(...args),
  },
}));

async function selectByLabel(
  user: ReturnType<typeof userEvent.setup>,
  ariaLabel: RegExp | string,
  value: string,
) {
  const select = screen.getByRole("combobox", { name: ariaLabel });
  await user.selectOptions(select, value);
}

async function fillMinimalLaptopForm(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Add Asset" })).toBeInTheDocument(),
  );
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: /Asset Type/i })).toBeInTheDocument(),
  );

  const name = screen.getByLabelText(/Asset Name/i);
  await user.clear(name);
  await user.type(name, "Dell Latitude");

  await selectByLabel(user, /Asset Type/i, "type-laptop");
  await selectByLabel(user, /Processor/i, "Intel i5");
  await selectByLabel(user, /Generation/i, "12th");
  await selectByLabel(user, /^RAM/i, "16 GB");
  await selectByLabel(user, /Storage/i, "512 GB");
  await selectByLabel(user, /^Location/i, "loc-mumbai");
  await waitFor(() => {
    expect(screen.getByRole("combobox", { name: /Building/i })).not.toBeDisabled();
  });
  await selectByLabel(user, /Building/i, "bld-crc1");
}

describe("AssetAddForm single-page registration", () => {
  beforeEach(() => {
    push.mockReset();
    create.mockReset();
    update.mockReset();
    action.mockReset();
    get.mockReset();
    update.mockResolvedValue({});
  });

  it("renders a single page without step stepper", async () => {
    render(<AssetAddForm />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Add Asset" })).toBeInTheDocument(),
    );
    expect(screen.getByText("Register a new IT asset")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Basic" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "IT Information" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Location/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Step \d+ of/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Add Asset$/i })).toBeInTheDocument();
  });

  it("filters buildings by selected location", async () => {
    const user = userEvent.setup();
    render(<AssetAddForm />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /^Location/i })).toBeInTheDocument(),
    );

    await selectByLabel(user, /^Location/i, "loc-mumbai");
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /Building/i })).not.toBeDisabled();
    });
    const building = screen.getByRole("combobox", { name: /Building/i });
    expect(within(building).getByRole("option", { name: "CRC-1" })).toBeInTheDocument();
    expect(within(building).getByRole("option", { name: "Mumbai IT Park" })).toBeInTheDocument();
    expect(
      within(building).queryByRole("option", { name: "Manyata Tech Park" }),
    ).not.toBeInTheDocument();
  });

  it("shows Generation for Intel and hides for Apple", async () => {
    const user = userEvent.setup();
    render(<AssetAddForm />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /Asset Type/i })).toBeInTheDocument(),
    );

    await selectByLabel(user, /Asset Type/i, "type-laptop");
    await selectByLabel(user, /Processor/i, "Intel i7");
    expect(screen.getByRole("combobox", { name: /Generation/i })).toBeInTheDocument();

    await selectByLabel(user, /Processor/i, "Apple M2");
    expect(screen.queryByRole("combobox", { name: /Generation/i })).not.toBeInTheDocument();
  });

  it("shows IT hardware fields when requires_hardware_config is true and hides when false", async () => {
    const user = userEvent.setup();
    render(<AssetAddForm />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /Asset Type/i })).toBeInTheDocument(),
    );

    await selectByLabel(user, /Asset Type/i, "type-laptop");
    expect(screen.getByRole("combobox", { name: /Processor/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^RAM/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Storage/i })).toBeInTheDocument();

    await selectByLabel(user, /Asset Type/i, "type-monitor");
    expect(screen.queryByRole("combobox", { name: /Processor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /^RAM/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Storage/i })).not.toBeInTheDocument();
  });

  it("blocks submit with required validation", async () => {
    const user = userEvent.setup();
    render(<AssetAddForm />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Add Asset$/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /^Add Asset$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Asset name is required/i)).toBeInTheDocument();
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("maps create payload and navigates after create→submit→approve", async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({ id: "asset-3", status: "draft" });
    get
      .mockResolvedValueOnce({ id: "asset-3", status: "draft", operational_status: null })
      .mockResolvedValue({
        id: "asset-3",
        status: "active",
        operational_status: "READY_TO_MOVE",
      });
    action
      .mockResolvedValueOnce({ id: "asset-3", status: "submitted" })
      .mockResolvedValueOnce({
        id: "asset-3",
        status: "active",
        operational_status: "READY_TO_MOVE",
      });

    render(<AssetAddForm />);
    await fillMinimalLaptopForm(user);

    const make = screen.getByLabelText(/Manufacturer/i);
    await user.type(make, "Dell");
    const model = screen.getByLabelText(/^Model/i);
    await user.type(model, "Latitude 5440");

    await user.click(screen.getByRole("button", { name: /^Add Asset$/i }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });

    const body = create.mock.calls[0]![0] as Record<string, unknown>;
    expect(body.asset_name).toBe("Dell Latitude");
    expect(body.asset_category_id).toBe("c1");
    expect(body.asset_type_id).toBe("type-laptop");
    expect(body.asset_type).toBeUndefined();
    expect(body.branch_id).toBe("b1");
    expect(body.make).toBe("Dell");
    expect(body.model).toBe("Latitude 5440");
    expect(body.location_id).toBe("loc-mumbai");
    expect(body.building_id).toBe("bld-crc1");
    expect(String(body.configuration)).toContain("Processor: Intel i5");
    expect(String(body.configuration)).toContain("Generation: 12th");
    expect(String(body.configuration)).toContain("RAM: 16 GB");
    expect(String(body.configuration)).toContain("Storage: 512 GB");
    expect(body.asset_code).toBeUndefined();
    expect(body.purchase_cost).toBe(0);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/assets/assets/asset-3");
    });
  });

  it("preserves form data when create API fails and prevents duplicate submit", async () => {
    const user = userEvent.setup();
    create.mockRejectedValue(new ApiClientError("Create failed", 500));

    render(<AssetAddForm />);
    await fillMinimalLaptopForm(user);

    const addBtn = screen.getByRole("button", { name: /^Add Asset$/i });
    await user.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText(/Create failed/i)).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("Dell Latitude")).toBeInTheDocument();
    expect(create).toHaveBeenCalledTimes(1);
    expect(addBtn).not.toBeDisabled();
  });

  it("does not allow concurrent double-submit while saving", async () => {
    const user = userEvent.setup();
    let resolveCreate: (v: unknown) => void = () => undefined;
    create.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    get.mockResolvedValue({
      id: "asset-x",
      status: "active",
      operational_status: "READY_TO_MOVE",
    });
    action.mockResolvedValue({
      id: "asset-x",
      status: "active",
      operational_status: "READY_TO_MOVE",
    });

    render(<AssetAddForm />);
    await fillMinimalLaptopForm(user);

    const addBtn = screen.getByRole("button", { name: /^Add Asset$/i });
    await user.click(addBtn);

    await waitFor(() => expect(addBtn).toBeDisabled());
    await user.click(addBtn);
    expect(create).toHaveBeenCalledTimes(1);

    resolveCreate({ id: "asset-x", status: "draft" });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/assets/assets/asset-x");
    });
  });
});

describe("AssetAddForm Phase 5F activation reliability", () => {
  beforeEach(() => {
    push.mockReset();
    create.mockReset();
    update.mockReset();
    action.mockReset();
    get.mockReset();
    update.mockResolvedValue({});
  });

  it("source does not silently swallow submit/approve errors", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/assets/asset-add-form.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/action\(id,\s*"submit"\)\.catch\(\(\)\s*=>\s*undefined\)/);
    expect(src).not.toMatch(/action\(id,\s*"approve"\)\.catch\(\(\)\s*=>\s*undefined\)/);
  });

  it("surfaces submit failure and does not navigate to success", async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({ id: "asset-1", status: "draft" });
    get.mockResolvedValue({ id: "asset-1", status: "draft", operational_status: null });
    action.mockRejectedValue(new ApiClientError("Submit blocked", 422));

    render(<AssetAddForm />);
    await fillMinimalLaptopForm(user);
    await user.click(screen.getByRole("button", { name: /^Add Asset$/i }));

    await waitFor(() => {
      expect(screen.getByText(/submission failed/i)).toBeInTheDocument();
    });
    expect(push).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("surfaces approve failure without claiming success", async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({ id: "asset-2", status: "draft" });
    get
      .mockResolvedValueOnce({ id: "asset-2", status: "draft", operational_status: null })
      .mockResolvedValue({ id: "asset-2", status: "submitted", operational_status: null });
    action
      .mockResolvedValueOnce({ id: "asset-2", status: "submitted" })
      .mockRejectedValueOnce(new ApiClientError("Approver required", 422));

    render(<AssetAddForm />);
    await fillMinimalLaptopForm(user);
    await user.click(screen.getByRole("button", { name: /^Add Asset$/i }));

    await waitFor(() => {
      expect(screen.getByText(/approval failed/i)).toBeInTheDocument();
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates only after active + ready", async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({ id: "asset-3", status: "draft" });
    get
      .mockResolvedValueOnce({ id: "asset-3", status: "draft", operational_status: null })
      .mockResolvedValue({
        id: "asset-3",
        status: "active",
        operational_status: "READY_TO_MOVE",
      });
    action
      .mockResolvedValueOnce({ id: "asset-3", status: "submitted" })
      .mockResolvedValueOnce({
        id: "asset-3",
        status: "active",
        operational_status: "READY_TO_MOVE",
      });

    render(<AssetAddForm />);
    await fillMinimalLaptopForm(user);
    await user.click(screen.getByRole("button", { name: /^Add Asset$/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/assets/assets/asset-3");
    });
  });
});
