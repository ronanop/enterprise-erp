/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InventorySearchTypeahead } from "@/components/assets/inventory/inventory-search-typeahead";
import { assetRegisterService } from "@/services/assets-service";

vi.mock("@/services/assets-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/assets-service")>();
  return {
    ...actual,
    assetRegisterService: {
      ...actual.assetRegisterService,
      search: vi.fn(),
    },
  };
});

afterEach(() => {
  cleanup();
  vi.mocked(assetRegisterService.search).mockReset();
});

function Harness({
  onSelect,
}: {
  onSelect: (suggestion: { id: string; assetCode: string }) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <InventorySearchTypeahead
      value={value}
      onValueChange={setValue}
      onSubmit={vi.fn()}
      onSelectSuggestion={onSelect}
    />
  );
}

describe("InventorySearchTypeahead", () => {
  it("debounces GET /assets search and selects a suggestion", async () => {
    const user = userEvent.setup();
    vi.mocked(assetRegisterService.search).mockResolvedValue({
      items: [
        {
          id: "a1",
          asset_code: "AST-1",
          asset_name: "Macbook",
          serial_number: "SN-9",
          make: "Apple",
          model: "M3",
          operational_status: "READY_TO_MOVE",
        },
      ],
      total: 1,
      page: 1,
      page_size: 8,
    });
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    await user.type(screen.getByRole("combobox", { name: "Search assets" }), "mac");
    await waitFor(() => expect(assetRegisterService.search).toHaveBeenCalled());
    expect(vi.mocked(assetRegisterService.search).mock.calls.at(-1)?.[0]).toMatchObject({
      q: "mac",
      page_size: 8,
    });
    await user.click(await screen.findByRole("option", { name: /Macbook/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "a1", assetCode: "AST-1" }));
  });

  it("filters by operational statuses and shows a custom empty message", async () => {
    const user = userEvent.setup();
    vi.mocked(assetRegisterService.search).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 8,
    });
    function EligibleHarness() {
      const [value, setValue] = useState("");
      return (
        <InventorySearchTypeahead
          value={value}
          onValueChange={setValue}
          onSubmit={vi.fn()}
          onSelectSuggestion={vi.fn()}
          operationalStatuses={["READY_TO_MOVE", "ASSIGNED"]}
          emptyMessage="No ready-to-move or assigned assets match"
        />
      );
    }
    render(<EligibleHarness />);
    await user.type(screen.getByRole("combobox", { name: "Search assets" }), "zzz");
    await waitFor(() => expect(assetRegisterService.search).toHaveBeenCalled());
    expect(await screen.findByText("No ready-to-move or assigned assets match")).toBeInTheDocument();
  });
});
