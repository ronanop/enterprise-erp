/**
 * Focused unit tests for Charger Available / Charger Code on Add Asset form.
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const create = vi.fn();
const update = vi.fn();
const get = vi.fn();
const action = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
}));

vi.mock("@/services/assets-service", () => ({
  assetCategoryService: {
    search: vi.fn(async () => ({
      items: [{ id: "cat-1", category_name: "Laptop", status: "active" }],
      total: 1,
    })),
  },
  filterActiveCategories: (items: Array<{ id: string }>) => items,
  assetRegisterService: {
    create: (...args: unknown[]) => create(...args),
    update: (...args: unknown[]) => update(...args),
    get: (...args: unknown[]) => get(...args),
    action: (...args: unknown[]) => action(...args),
  },
  assetRegistrationQueueService: {
    prefillFromIncoming: vi.fn(),
  },
  componentService: {
    search: vi.fn(async () => ({ items: [], total: 0 })),
  },
  assetLocationService: {
    search: vi.fn(async () => ({ items: [], total: 0 })),
  },
  buildSelfServiceUrl: () => "https://example.test/ss",
}));

vi.mock("@/services/asset-type-service", () => ({
  listItAssetTypes: vi.fn(async () => [
    { id: "type-1", name: "Laptop", requires_hardware_config: false, active: true },
  ]),
}));

vi.mock("@/services/asset-site-location-service", () => ({
  listSiteLocations: vi.fn(async () => [{ id: "loc-1", name: "HQ" }]),
  listSiteBuildings: vi.fn(async (locationId?: string) =>
    !locationId || locationId === "loc-1"
      ? [{ id: "bldg-1", name: "Building A", location_id: "loc-1" }]
      : [],
  ),
}));

vi.mock("@/components/assets/it-asset-import-dialog", () => ({
  ItAssetImportDialog: () => null,
}));

import { AssetAddForm } from "@/components/assets/asset-add-form";

async function selectByLabel(
  user: ReturnType<typeof userEvent.setup>,
  ariaLabel: RegExp | string,
  value: string,
) {
  const select = screen.getByRole("combobox", { name: ariaLabel });
  await user.selectOptions(select, value);
}

describe("AssetAddForm charger fields", () => {
  beforeEach(() => {
    push.mockReset();
    create.mockReset();
    update.mockReset();
    get.mockReset();
    action.mockReset();
  });

  it("renders Charger section without Charger Code by default", async () => {
    render(<AssetAddForm />);
    expect(await screen.findByTestId("asset-charger-section")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Charger" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Charger Available/i })).toBeInTheDocument();
    expect(screen.queryByTestId("charger-code-input")).not.toBeInTheDocument();
  });

  it("shows Charger Code when Yes is selected and hides on No", async () => {
    const user = userEvent.setup();
    render(<AssetAddForm />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /Charger Available/i })).toBeInTheDocument(),
    );

    await selectByLabel(user, /Charger Available/i, "yes");
    expect(await screen.findByTestId("charger-code-input")).toBeInTheDocument();

    await user.type(screen.getByTestId("charger-code-input"), "CHG-99");
    await selectByLabel(user, /Charger Available/i, "no");
    await waitFor(() => {
      expect(screen.queryByTestId("charger-code-input")).not.toBeInTheDocument();
    });
  });

  it("submits charger_available true with charger_code", async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({ id: "a1", status: "draft" });
    get.mockResolvedValue({ id: "a1", status: "active", operational_status: "READY_TO_MOVE" });
    action.mockResolvedValue({ id: "a1", status: "active", operational_status: "READY_TO_MOVE" });
    update.mockResolvedValue({});

    render(<AssetAddForm />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /Asset Type/i })).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText(/Asset Name/i), "Laptop X");
    await selectByLabel(user, /^Location/i, "loc-1");
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /Building/i })).not.toBeDisabled();
    });
    await selectByLabel(user, /Building/i, "bldg-1");
    await selectByLabel(user, /Charger Available/i, "yes");
    await user.type(screen.getByTestId("charger-code-input"), "CHG-001");
    await user.click(screen.getByTestId("asset-add-save"));

    await waitFor(() => expect(create).toHaveBeenCalled());
    const body = create.mock.calls[0]![0] as Record<string, unknown>;
    expect(body.charger_available).toBe(true);
    expect(body.charger_code).toBe("CHG-001");
  });

  it("submits charger_available false without charger_code", async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({ id: "a2", status: "draft" });
    get.mockResolvedValue({ id: "a2", status: "active", operational_status: "READY_TO_MOVE" });
    action.mockResolvedValue({ id: "a2", status: "active", operational_status: "READY_TO_MOVE" });
    update.mockResolvedValue({});

    render(<AssetAddForm />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /Asset Type/i })).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText(/Asset Name/i), "Laptop Y");
    await selectByLabel(user, /^Location/i, "loc-1");
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /Building/i })).not.toBeDisabled();
    });
    await selectByLabel(user, /Building/i, "bldg-1");
    await selectByLabel(user, /Charger Available/i, "no");
    await user.click(screen.getByTestId("asset-add-save"));

    await waitFor(() => expect(create).toHaveBeenCalled());
    const body = create.mock.calls[0]![0] as Record<string, unknown>;
    expect(body.charger_available).toBe(false);
    expect(body.charger_code).toBeUndefined();
  });

  it("prefills location and charger on edit and syncs both on save", async () => {
    const user = userEvent.setup();
    const { componentService, assetLocationService } = await import(
      "@/services/assets-service"
    );
    vi.mocked(componentService.search).mockResolvedValue({
      items: [
        {
          id: "comp-1",
          asset_id: "asset-edit-1",
          component_type: "CHARGER",
          component_code: "CHARGER-0001",
          serial_number: "CHARGER-0001",
          status: "active",
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    } as never);
    vi.mocked(assetLocationService.search).mockResolvedValue({
      items: [
        {
          id: "loc-row-1",
          asset_id: "asset-edit-1",
          location_label: "HQ · Building A",
          location_id: "loc-1",
          building_id: "bldg-1",
          is_current: true,
          status: "active",
          company_id: "c1",
          version: 1,
        },
      ],
      total: 1,
      page: 1,
      page_size: 5,
    } as never);
    get.mockResolvedValue({
      id: "asset-edit-1",
      asset_name: "Lenovo ThinkCentre M70 - 01",
      serial_number: "LTCM70SN001",
      asset_category_id: "cat-1",
      asset_type_id: "type-1",
      make: "Lenovo",
      model: "ThinkCentre M70",
      location_id: "loc-1",
      building_id: "bldg-1",
      configuration: "Processor: Intel i5; RAM: 16 GB; Storage: 512 GB",
      version: 3,
    });
    update.mockResolvedValue({ id: "asset-edit-1" });

    render(<AssetAddForm assetId="asset-edit-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Lenovo ThinkCentre M70 - 01")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("LTCM70SN001")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lenovo")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Location/i })).toHaveTextContent("HQ");
    expect(screen.getByRole("combobox", { name: /Building/i })).toHaveTextContent("Building A");
    expect(screen.getByRole("combobox", { name: /Charger Available/i })).toHaveTextContent(
      /Yes/i,
    );
    expect(await screen.findByTestId("charger-code-input")).toHaveValue("CHARGER-0001");

    await user.clear(screen.getByTestId("charger-code-input"));
    await user.type(screen.getByTestId("charger-code-input"), "CHARGER-9999");
    await user.click(screen.getByTestId("asset-edit-save"));

    await waitFor(() => expect(update).toHaveBeenCalled());
    const body = update.mock.calls[0]![1] as Record<string, unknown>;
    expect(body.location_id).toBe("loc-1");
    expect(body.building_id).toBe("bldg-1");
    expect(body.charger_available).toBe(true);
    expect(body.charger_code).toBe("CHARGER-9999");
    expect(body.version).toBe(3);
  });

  it("sends charger_available false on edit to unlink charger component", async () => {
    const user = userEvent.setup();
    const { componentService } = await import("@/services/assets-service");
    vi.mocked(componentService.search).mockResolvedValue({
      items: [
        {
          id: "comp-1",
          asset_id: "asset-edit-2",
          component_type: "CHARGER",
          component_code: "CHARGER-0001",
          status: "active",
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    } as never);
    get.mockResolvedValue({
      id: "asset-edit-2",
      asset_name: "MacBook Pro 14",
      serial_number: "SN-1001",
      asset_category_id: "cat-1",
      asset_type_id: "type-1",
      location_id: "loc-1",
      building_id: "bldg-1",
      version: 1,
    });
    update.mockResolvedValue({ id: "asset-edit-2" });

    render(<AssetAddForm assetId="asset-edit-2" />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /Charger Available/i })).toHaveTextContent(
        /Yes/i,
      ),
    );

    await selectByLabel(user, /Charger Available/i, "no");
    await user.click(screen.getByTestId("asset-edit-save"));

    await waitFor(() => expect(update).toHaveBeenCalled());
    const body = update.mock.calls[0]![1] as Record<string, unknown>;
    expect(body.charger_available).toBe(false);
    expect(body.charger_code).toBeNull();
  });
});
