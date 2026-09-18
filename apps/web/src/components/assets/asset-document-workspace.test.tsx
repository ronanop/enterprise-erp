/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetDocumentWorkspace } from "@/components/assets/asset-document-workspace";

const listAssets = vi.fn();
const searchDocs = vi.fn();
const getUploadLimits = vi.fn();
const uploadDoc = vi.fn();
const archiveDoc = vi.fn();
const getContentBlob = vi.fn();

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
}));

vi.mock("@/services/assets-service", () => ({
  assetOperationsService: {
    listAssets: (...args: unknown[]) => listAssets(...args),
  },
  documentService: {
    search: (...args: unknown[]) => searchDocs(...args),
    getUploadLimits: (...args: unknown[]) => getUploadLimits(...args),
    upload: (...args: unknown[]) => uploadDoc(...args),
    archive: (...args: unknown[]) => archiveDoc(...args),
    getContentBlob: (...args: unknown[]) => getContentBlob(...args),
  },
}));

const assetA = {
  id: "asset-1",
  asset_code: "AST-2026-000001",
  asset_name: "MacBook",
  asset_type: "Laptop",
  asset_type_name: "Laptop",
};

const assetB = {
  id: "asset-2",
  asset_code: "AST-2026-000007",
  asset_name: "Lenovo Laptop",
  asset_type: "Laptop",
  asset_type_name: "Laptop",
};

const existingDoc = {
  id: "doc-1",
  asset_id: "asset-1",
  document_type: "other",
  document_name: "warranty_card.pdf",
  status: "active",
  company_id: "c1",
  version: 1,
  created_at: "2026-09-01T10:00:00Z",
  content_type: "application/pdf",
  file_size_bytes: 1100000,
  downloadable: true,
};

beforeEach(() => {
  listAssets.mockResolvedValue({
    items: [assetA, assetB],
    total: 2,
    page: 1,
    page_size: 25,
  });
  searchDocs.mockImplementation(async (params: { asset_id?: string; status?: string }) => {
    if (params.asset_id === "asset-1") {
      return { items: [existingDoc], total: 1, page: 1, page_size: 100 };
    }
    if (params.status === "active" && !params.asset_id) {
      return { items: [existingDoc], total: 1, page: 1, page_size: 200 };
    }
    return { items: [], total: 0, page: 1, page_size: 100 };
  });
  getUploadLimits.mockResolvedValue({
    max_upload_mb: 10,
    allowed_content_types: ["application/pdf", "image/png", "image/jpeg"],
    accepted_extensions: ["pdf", "png", "jpg", "jpeg"],
  });
  uploadDoc.mockResolvedValue({
    id: "doc-2",
    asset_id: "asset-1",
    document_type: "other",
    document_name: "purchase_invoice.pdf",
    status: "active",
    company_id: "c1",
    version: 1,
    content_type: "application/pdf",
    file_size_bytes: 2400000,
    downloadable: true,
  });
  archiveDoc.mockResolvedValue({ ...existingDoc, status: "archived" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AssetDocumentWorkspace", () => {
  it("loads assets and opens documents for a selected asset", async () => {
    const user = userEvent.setup();
    render(<AssetDocumentWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("MacBook")).toBeInTheDocument();
    });
    expect(screen.getByText("AST-2026-000001")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Asset Documents" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View Documents" }));

    await waitFor(() => {
      expect(screen.getByText("warranty_card.pdf")).toBeInTheDocument();
    });
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });

  it("uploads a selected file and shows the original filename", async () => {
    const user = userEvent.setup();
    render(<AssetDocumentWorkspace />);

    await waitFor(() => expect(screen.getByText("MacBook")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "View Documents" }));
    await waitFor(() => expect(screen.getByText("warranty_card.pdf")).toBeInTheDocument());

    await user.click(
      within(screen.getByTestId("asset-documents-detail")).getByRole("button", {
        name: "Add Document",
      }),
    );
    const dialog = screen.getByTestId("asset-document-upload-dialog");
    expect(within(dialog).getByText(/MacBook/)).toBeInTheDocument();

    const file = new File(["%PDF-1.4 test"], "purchase_invoice.pdf", {
      type: "application/pdf",
    });
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(screen.getByTestId("asset-document-selected-file")).toHaveTextContent(
      "purchase_invoice.pdf",
    );

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(uploadDoc).toHaveBeenCalledWith("asset-1", expect.any(File));
    });
    await waitFor(() => {
      expect(screen.getByText(/Document uploaded successfully/)).toBeInTheDocument();
    });
  });

  it("shows empty state for an asset with no documents", async () => {
    const user = userEvent.setup();
    render(<AssetDocumentWorkspace />);
    await waitFor(() => expect(screen.getByText("Lenovo Laptop")).toBeInTheDocument());

    const row = screen.getByTestId("asset-documents-row-AST-2026-000007");
    await user.click(within(row).getByRole("button", { name: "Add Document" }));

    await waitFor(() => {
      expect(screen.getByText("No documents uploaded for this asset.")).toBeInTheDocument();
    });
  });
});
