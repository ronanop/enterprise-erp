/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  document_type: "warranty",
  document_name: "warranty_card.pdf",
  status: "active",
  company_id: "c1",
  version: 1,
  created_at: "2026-09-01T10:00:00Z",
  content_type: "application/pdf",
  file_size_bytes: 1100000,
  downloadable: true,
};

const uploadedInvoice = {
  id: "doc-2",
  asset_id: "asset-1",
  document_type: "invoice",
  document_name: "Dell Invoice 2026.pdf",
  status: "active",
  company_id: "c1",
  version: 1,
  created_at: "2026-09-21T10:00:00Z",
  content_type: "application/pdf",
  file_size_bytes: 2400000,
  downloadable: true,
};

const uploadedWarranty = {
  id: "doc-3",
  asset_id: "asset-1",
  document_type: "warranty",
  document_name: "Dell Warranty.pdf",
  status: "active",
  company_id: "c1",
  version: 1,
  created_at: "2026-09-21T10:05:00Z",
  content_type: "application/pdf",
  file_size_bytes: 500000,
  downloadable: true,
};

async function openAddDocumentDialog(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByText("MacBook")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "View Documents" }));
  const dialog = await screen.findByTestId("asset-document-upload-dialog");
  await waitFor(() => {
    expect(within(dialog).getByText("warranty_card.pdf")).toBeInTheDocument();
  });
  return dialog;
}

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
    allowed_content_types: [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    accepted_extensions: ["pdf", "png", "jpg", "jpeg", "doc", "docx", "xls", "xlsx"],
  });
  uploadDoc.mockResolvedValue(uploadedInvoice);
  archiveDoc.mockResolvedValue({ ...existingDoc, status: "archived" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AssetDocumentWorkspace", () => {
  it("loads assets without a permanent documents side panel", async () => {
    render(<AssetDocumentWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("MacBook")).toBeInTheDocument();
    });
    expect(screen.getByText("AST-2026-000001")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Asset Documents" })).toBeInTheDocument();
    expect(screen.queryByTestId("asset-documents-detail")).not.toBeInTheDocument();
    expect(screen.getByTestId("asset-documents-asset-table")).toBeInTheDocument();
  });

  it("opens existing documents and add form from the asset row action", async () => {
    const user = userEvent.setup();
    render(<AssetDocumentWorkspace />);
    const dialog = await openAddDocumentDialog(user);

    expect(within(dialog).getByRole("heading", { name: "Add Asset Document" })).toBeInTheDocument();
    expect(within(dialog).getByText("warranty_card.pdf")).toBeInTheDocument();
    expect(within(dialog).getByText("PDF")).toBeInTheDocument();
    expect(
      within(within(dialog).getByTestId("asset-documents-file-table")).getByText("Warranty"),
    ).toBeInTheDocument();
    expect(within(dialog).getByTestId("asset-document-draft-1")).toBeInTheDocument();
  });

  it("opens Add Asset Document form with document type options", async () => {
    const user = userEvent.setup();
    render(<AssetDocumentWorkspace />);
    const dialog = await openAddDocumentDialog(user);

    expect(within(dialog).getByRole("heading", { name: "Add Asset Document" })).toBeInTheDocument();
    const typeSelect = within(dialog).getByLabelText(/Document type 1/i);
    expect(typeSelect).toBeInTheDocument();

    const options = Array.from(typeSelect.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(
      expect.arrayContaining([
        "Invoice",
        "Purchase Order",
        "Warranty",
        "AMC",
        "Insurance",
        "Delivery Challan",
        "GRN",
        "Asset Photo",
        "User Manual",
        "Specification",
        "Other",
      ]),
    );
    expect(within(dialog).getByRole("button", { name: "Save Documents" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(dialog).getByTestId("asset-document-add-another")).toBeInTheDocument();
  });

  it("adds one document and uploads via existing API", async () => {
    const user = userEvent.setup();
    render(<AssetDocumentWorkspace />);
    const dialog = await openAddDocumentDialog(user);

    await user.selectOptions(within(dialog).getByLabelText(/Document type 1/i), "invoice");
    await user.type(within(dialog).getByPlaceholderText(/Dell Invoice 2026/i), "Dell Invoice 2026");

    const file = new File(["%PDF-1.4 test"], "invoice.pdf", { type: "application/pdf" });
    await user.upload(within(dialog).getByTestId("asset-document-file-input-1"), file);

    expect(within(dialog).getByTestId("asset-document-selected-file-1")).toHaveTextContent(
      "invoice.pdf",
    );
    expect(within(dialog).getByTestId("asset-document-summary-1")).toHaveTextContent("Invoice");
    expect(within(dialog).getByTestId("asset-document-summary-1")).toHaveTextContent(
      "Dell Invoice 2026",
    );

    await user.click(within(dialog).getByRole("button", { name: "Save Documents" }));

    await waitFor(() => {
      expect(uploadDoc).toHaveBeenCalledWith(
        "asset-1",
        expect.any(File),
        expect.objectContaining({
          documentType: "invoice",
          documentName: "Dell Invoice 2026.pdf",
        }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByTestId("asset-document-upload-dialog")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/Document uploaded successfully/)).toBeInTheDocument();
    });
  });

  it("adds multiple documents and uploads each", async () => {
    const user = userEvent.setup();
    uploadDoc
      .mockResolvedValueOnce(uploadedInvoice)
      .mockResolvedValueOnce(uploadedWarranty);

    searchDocs.mockImplementation(async (params: { asset_id?: string; status?: string }) => {
      if (params.asset_id === "asset-1") {
        if (uploadDoc.mock.calls.length >= 2) {
          return {
            items: [existingDoc, uploadedInvoice, uploadedWarranty],
            total: 3,
            page: 1,
            page_size: 100,
          };
        }
        return { items: [existingDoc], total: 1, page: 1, page_size: 100 };
      }
      if (params.status === "active" && !params.asset_id) {
        return {
          items: [existingDoc, uploadedInvoice, uploadedWarranty],
          total: 3,
          page: 1,
          page_size: 200,
        };
      }
      return { items: [], total: 0, page: 1, page_size: 100 };
    });

    render(<AssetDocumentWorkspace />);
    const dialog = await openAddDocumentDialog(user);

    await user.selectOptions(within(dialog).getByLabelText(/Document type 1/i), "invoice");
    const name1 = within(dialog).getByPlaceholderText(/Dell Invoice 2026/i);
    await user.clear(name1);
    await user.type(name1, "Dell Invoice 2026");
    await user.upload(
      within(dialog).getByTestId("asset-document-file-input-1"),
      new File(["%PDF-1.4 a"], "invoice.pdf", { type: "application/pdf" }),
    );

    await user.click(within(dialog).getByTestId("asset-document-add-another"));
    expect(within(dialog).getByTestId("asset-document-draft-2")).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText(/Document type 2/i), "warranty");
    const nameInputs = within(dialog).getAllByPlaceholderText(/Dell Invoice 2026/i);
    await user.clear(nameInputs[1]!);
    await user.type(nameInputs[1]!, "Dell Warranty");
    await user.upload(
      within(dialog).getByTestId("asset-document-file-input-2"),
      new File(["%PDF-1.4 b"], "warranty.pdf", { type: "application/pdf" }),
    );

    expect(within(dialog).getByTestId("asset-document-summary-1")).toHaveTextContent("Invoice");
    expect(within(dialog).getByTestId("asset-document-summary-2")).toHaveTextContent("Warranty");

    await user.click(within(dialog).getByRole("button", { name: "Save Documents" }));

    await waitFor(() => {
      expect(uploadDoc).toHaveBeenCalledTimes(2);
    });
    expect(uploadDoc).toHaveBeenNthCalledWith(
      1,
      "asset-1",
      expect.any(File),
      expect.objectContaining({ documentType: "invoice", documentName: "Dell Invoice 2026.pdf" }),
    );
    expect(uploadDoc).toHaveBeenNthCalledWith(
      2,
      "asset-1",
      expect.any(File),
      expect.objectContaining({ documentType: "warranty", documentName: "Dell Warranty.pdf" }),
    );

    await waitFor(() => {
      expect(screen.getByText(/2 documents uploaded successfully/)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "View Documents" }));
    const reopened = await screen.findByTestId("asset-document-upload-dialog");
    await waitFor(() => {
      expect(within(reopened).getByText("Dell Invoice 2026.pdf")).toBeInTheDocument();
      expect(within(reopened).getByText("Dell Warranty.pdf")).toBeInTheDocument();
      expect(within(reopened).getByText("warranty_card.pdf")).toBeInTheDocument();
    });
  }, 20_000);

  it("removes one document entry before save", async () => {
    const user = userEvent.setup();
    render(<AssetDocumentWorkspace />);
    const dialog = await openAddDocumentDialog(user);

    await user.selectOptions(within(dialog).getByLabelText(/Document type 1/i), "invoice");
    await user.type(within(dialog).getByPlaceholderText(/Dell Invoice 2026/i), "Keep Me");
    await user.upload(
      within(dialog).getByTestId("asset-document-file-input-1"),
      new File(["%PDF-1.4"], "keep.pdf", { type: "application/pdf" }),
    );

    await user.click(within(dialog).getByTestId("asset-document-add-another"));
    await user.selectOptions(within(dialog).getByLabelText(/Document type 2/i), "warranty");
    const nameInputs = within(dialog).getAllByPlaceholderText(/Dell Invoice 2026/i);
    await user.type(nameInputs[1]!, "Remove Me");
    await user.upload(
      within(dialog).getByTestId("asset-document-file-input-2"),
      new File(["%PDF-1.4"], "drop.pdf", { type: "application/pdf" }),
    );

    const summary2 = within(dialog).getByTestId("asset-document-summary-2");
    await user.click(within(summary2).getByRole("button", { name: "Remove" }));

    expect(within(dialog).queryByTestId("asset-document-draft-2")).not.toBeInTheDocument();
    expect(within(dialog).getByTestId("asset-document-summary-1")).toHaveTextContent("Keep Me");
    expect(within(dialog).queryByText("Remove Me")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Save Documents" }));
    await waitFor(() => expect(uploadDoc).toHaveBeenCalledTimes(1));
    expect(uploadDoc).toHaveBeenCalledWith(
      "asset-1",
      expect.any(File),
      expect.objectContaining({ documentName: "Keep Me.pdf" }),
    );
  });

  it("shows required field validation errors", async () => {
    const user = userEvent.setup();
    render(<AssetDocumentWorkspace />);
    const dialog = await openAddDocumentDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "Save Documents" }));

    expect(await within(dialog).findByText("Document type is required.")).toBeInTheDocument();
    expect(within(dialog).getByText("Document name is required.")).toBeInTheDocument();
    expect(within(dialog).getByText("A file is required.")).toBeInTheDocument();
    expect(uploadDoc).not.toHaveBeenCalled();
  });

  it("validates unsupported file type and oversized files", async () => {
    const user = userEvent.setup();
    render(<AssetDocumentWorkspace />);
    const dialog = await openAddDocumentDialog(user);

    await user.selectOptions(within(dialog).getByLabelText(/Document type 1/i), "invoice");
    await user.type(within(dialog).getByPlaceholderText(/Dell Invoice 2026/i), "Bad file");

    const fileInput = within(dialog).getByTestId(
      "asset-document-file-input-1",
    ) as HTMLInputElement;

    const badType = new File(["hello"], "notes.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [badType] } });

    expect(
      await within(dialog).findByText(
        /Unable to upload this file. Please check the file type and size/,
      ),
    ).toBeInTheDocument();

    const oversized = new File(["%PDF"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: 11 * 1024 * 1024 });
    fireEvent.change(fileInput, { target: { files: [oversized] } });
    expect(
      within(dialog).getByText(/Unable to upload this file. Please check the file type and size/),
    ).toBeInTheDocument();
    expect(uploadDoc).not.toHaveBeenCalled();
  });

  it("keeps existing documents visible after successful upload", async () => {
    const user = userEvent.setup();
    searchDocs.mockImplementation(async (params: { asset_id?: string; status?: string }) => {
      if (params.asset_id === "asset-1") {
        if (uploadDoc.mock.calls.length >= 1) {
          return {
            items: [existingDoc, uploadedInvoice],
            total: 2,
            page: 1,
            page_size: 100,
          };
        }
        return { items: [existingDoc], total: 1, page: 1, page_size: 100 };
      }
      if (params.status === "active" && !params.asset_id) {
        return {
          items: uploadDoc.mock.calls.length >= 1 ? [existingDoc, uploadedInvoice] : [existingDoc],
          total: uploadDoc.mock.calls.length >= 1 ? 2 : 1,
          page: 1,
          page_size: 200,
        };
      }
      return { items: [], total: 0, page: 1, page_size: 100 };
    });

    render(<AssetDocumentWorkspace />);
    const dialog = await openAddDocumentDialog(user);

    await user.selectOptions(within(dialog).getByLabelText(/Document type 1/i), "invoice");
    await user.type(within(dialog).getByPlaceholderText(/Dell Invoice 2026/i), "Dell Invoice 2026");
    await user.upload(
      within(dialog).getByTestId("asset-document-file-input-1"),
      new File(["%PDF-1.4"], "invoice.pdf", { type: "application/pdf" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Save Documents" }));

    await waitFor(() => {
      expect(screen.queryByTestId("asset-document-upload-dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "View Documents" }));
    const reopened = await screen.findByTestId("asset-document-upload-dialog");
    await waitFor(() => {
      expect(within(reopened).getByText("warranty_card.pdf")).toBeInTheDocument();
      expect(within(reopened).getByText("Dell Invoice 2026.pdf")).toBeInTheDocument();
    });
  });

  it("opens add form for an asset with no documents", async () => {
    const user = userEvent.setup();
    render(<AssetDocumentWorkspace />);
    await waitFor(() => expect(screen.getByText("Lenovo Laptop")).toBeInTheDocument());

    const row = screen.getByTestId("asset-documents-row-AST-2026-000007");
    await user.click(within(row).getByRole("button", { name: "Add Document" }));

    const dialog = await screen.findByTestId("asset-document-upload-dialog");
    expect(within(dialog).getByRole("heading", { name: "Add Asset Document" })).toBeInTheDocument();
    expect(
      within(dialog).getByText("No documents uploaded yet for this asset."),
    ).toBeInTheDocument();
    expect(within(dialog).getByTestId("asset-document-draft-1")).toBeInTheDocument();
    expect(screen.queryByTestId("asset-documents-detail")).not.toBeInTheDocument();
  });
});
