/**
 * DC Challan workspace
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchMock = vi.fn();
const summaryMock = vi.fn();
const bulkSendMock = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
}));

vi.mock("@/hooks/use-user-permissions", () => ({
  useUserPermissions: () => ({ can: () => true, user: null, loading: false }),
}));

vi.mock("@/services/assets-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/assets-service")>();
  return {
    ...actual,
    dcChallanService: {
      search: (...args: unknown[]) => searchMock(...args),
      summary: (...args: unknown[]) => summaryMock(...args),
      bulkSendToScm: (...args: unknown[]) => bulkSendMock(...args),
      create: vi.fn(),
      sendToScm: vi.fn(),
      attachScmDocument: vi.fn(),
      markSigned: vi.fn(),
      markReceived: vi.fn(),
      cancel: vi.fn(),
      get: vi.fn(),
      uploadScmIssued: vi.fn(),
      uploadSigned: vi.fn(),
      getDocumentBlob: vi.fn(),
    },
    assetRegisterService: {
      ...actual.assetRegisterService,
      search: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 8 }),
      get: vi.fn(),
    },
    assetOperationsService: {
      ...actual.assetOperationsService,
      listAssignments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 }),
    },
  };
});

import { AssetDcChallanWorkspace } from "./asset-dc-challan-workspace";

const ROW = {
  id: "dc-1",
  dc_number: "DC-2026-000001",
  asset_id: "a1",
  assignment_id: null,
  status: "PENDING",
  company_id: "c1",
  branch_id: "b1",
  employee_code: "E-1",
  employee_name: "Ada Lovelace",
  employee_phone: "",
  employee_email: "ada@example.com",
  asset_name: "Laptop",
  asset_tag: "AST-1",
  version: 1,
  created_at: "2026-08-25T10:00:00Z",
};

describe("AssetDcChallanWorkspace", () => {
  beforeEach(() => {
    searchMock.mockReset();
    summaryMock.mockReset();
    bulkSendMock.mockReset();
    searchMock.mockResolvedValue({ items: [ROW], total: 1, page: 1, page_size: 25 });
    summaryMock.mockResolvedValue({
      pending: 1,
      sent_to_scm: 0,
      document_received: 0,
      signed: 0,
      received: 0,
      cancelled: 0,
    });
    bulkSendMock.mockResolvedValue({
      results: [{ id: "dc-1", ok: false, reason: "Employee email is required" }],
      sent_count: 0,
      skipped_count: 1,
    });
  });

  it("renders stats, list, and Operations title content", async () => {
    render(<AssetDcChallanWorkspace />);
    expect(screen.getByRole("heading", { name: "DC Challan" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("DC-2026-000001")).toBeInTheDocument());
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("shows per-item skip reasons after bulk send", async () => {
    const user = userEvent.setup();
    render(<AssetDcChallanWorkspace />);
    await waitFor(() => expect(screen.getByText("DC-2026-000001")).toBeInTheDocument());
    await user.click(screen.getByLabelText("Select DC-2026-000001"));
    await user.click(screen.getByRole("button", { name: /Send to SCM/ }));
    await waitFor(() => expect(screen.getByTestId("dc-challan-bulk-result")).toBeInTheDocument());
    expect(screen.getByText(/Employee email is required/)).toBeInTheDocument();
  });

  it("shows a soft phone warning in the drawer without blocking send", async () => {
    const user = userEvent.setup();
    render(<AssetDcChallanWorkspace />);
    await waitFor(() => expect(screen.getByText("DC-2026-000001")).toBeInTheDocument());
    await user.click(screen.getByText("DC-2026-000001"));
    expect(screen.getByText(/Employee phone is blank/)).toBeInTheDocument();
    expect(screen.getByText(/Sending to SCM is still allowed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Send to SCM$/ })).toBeEnabled();
  });

  it("opens a searchable create dialog instead of raw ID fields", async () => {
    const user = userEvent.setup();
    render(<AssetDcChallanWorkspace />);
    await waitFor(() => expect(screen.getByText("DC-2026-000001")).toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: "Create DC Challan" })[0]!);
    expect(screen.getByTestId("dc-challan-create-dialog")).toBeInTheDocument();
    expect(screen.queryByLabelText("Asset ID")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Search eligible assets" })).toBeInTheDocument();
  });

  it("shows SCM and signed document blocks in the drawer", async () => {
    const user = userEvent.setup();
    searchMock.mockResolvedValue({
      items: [
        {
          ...ROW,
          status: "DOCUMENT_RECEIVED",
          scm_issued_document: {
            doc_kind: "SCM_ISSUED",
            original_filename: "dc-issued.pdf",
            file_size_bytes: 1200,
            source: "SCM_CALLBACK",
            uploaded_at: "2026-08-25T12:00:00Z",
            has_stored_file: true,
          },
        },
      ],
      total: 1,
      page: 1,
      page_size: 25,
    });
    render(<AssetDcChallanWorkspace />);
    await waitFor(() => expect(screen.getByText("DC-2026-000001")).toBeInTheDocument());
    await user.click(screen.getByText("DC-2026-000001"));
    expect(screen.getByText("SCM Challan Document")).toBeInTheDocument();
    expect(screen.getByText("Signed Document")).toBeInTheDocument();
    expect(screen.getByText("dc-issued.pdf")).toBeInTheDocument();
    expect(screen.getByText("Upload signed copy")).toBeInTheDocument();
    expect(screen.getByText(/marks this challan as signed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark signed" })).toBeNull();
  });

  it("shows deployed_to for manual-entry challans and does not warn about missing code", async () => {
    const user = userEvent.setup();
    searchMock.mockResolvedValue({
      items: [
        {
          ...ROW,
          employee_id: null,
          employee_code: null,
          employee_phone: "9876543210",
          employee_email: "",
          deployed_to: "Airtel — Gurugram office",
        },
      ],
      total: 1,
      page: 1,
      page_size: 25,
    });
    render(<AssetDcChallanWorkspace />);
    await waitFor(() => expect(screen.getByText("DC-2026-000001")).toBeInTheDocument());
    await user.click(screen.getByText("DC-2026-000001"));
    expect(screen.getByTestId("dc-challan-deployed-to")).toHaveTextContent("Airtel — Gurugram office");
    expect(screen.queryByText(/missing code/i)).toBeNull();
    expect(screen.queryByText(/^Code$/)).toBeNull();
    expect(screen.getByText(/Employee email is blank/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Send to SCM$/ })).toBeEnabled();
  });
});
