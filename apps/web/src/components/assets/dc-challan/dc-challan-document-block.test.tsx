/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DcChallanDocumentBlock } from "@/components/assets/dc-challan/dc-challan-document-block";
import { DcChallanDocumentPreviewModal } from "@/components/assets/dc-challan/dc-challan-document-preview-modal";
import type { DcChallanRow } from "@/services/assets-service";

const uploadMock = vi.fn();
const blobMock = vi.fn();

vi.mock("@/services/assets-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/assets-service")>();
  return {
    ...actual,
    dcChallanService: {
      ...actual.dcChallanService,
      getDocumentBlob: (...args: unknown[]) => blobMock(...args),
    },
  };
});

afterEach(() => {
  cleanup();
  uploadMock.mockReset();
  blobMock.mockReset();
});

const row: DcChallanRow = {
  id: "dc-1",
  dc_number: "DC-2026-000001",
  asset_id: "a1",
  status: "SENT_TO_SCM",
  company_id: "c1",
  branch_id: "b1",
  version: 1,
};

describe("DcChallanDocumentBlock", () => {
  it("rejects disallowed type before calling upload", () => {
    render(
      <DcChallanDocumentBlock
        title="SCM Challan Document"
        row={row}
        kind="scm-issued"
        document={null}
        showUploader
        canUpload
        uploadLabel="Upload SCM document manually"
        onUpload={uploadMock}
      />,
    );
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File(["not-a-pdf"], "payload.exe", { type: "application/x-msdownload" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("dc-doc-client-error").textContent).toMatch(/PDF, JPEG, and PNG/);
  });

  it("rejects oversized files before calling upload", () => {
    render(
      <DcChallanDocumentBlock
        title="SCM Challan Document"
        row={row}
        kind="scm-issued"
        document={null}
        showUploader
        canUpload
        onUpload={uploadMock}
      />,
    );
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File([new Uint8Array(12)], "huge.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [file] } });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("dc-doc-client-error").textContent).toMatch(/10 MB/);
  });

  it("uses backend-provided size limit in the error copy", () => {
    render(
      <DcChallanDocumentBlock
        title="SCM Challan Document"
        row={row}
        kind="scm-issued"
        document={null}
        showUploader
        canUpload
        uploadLimits={{ max_upload_mb: 2, allowed_content_types: ["application/pdf"] }}
        onUpload={uploadMock}
      />,
    );
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File([new Uint8Array(12)], "huge.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 3 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [file] } });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("dc-doc-client-error").textContent).toMatch(/2 MB/);
  });

  it("confirms before replacing a stored document", () => {
    render(
      <DcChallanDocumentBlock
        title="SCM Challan Document"
        row={{ ...row, status: "DOCUMENT_RECEIVED" }}
        kind="scm-issued"
        document={{ doc_kind: "SCM_ISSUED", original_filename: "issued.pdf", has_stored_file: true }}
        canReplace
        onUpload={uploadMock}
      />,
    );
    expect(screen.queryByTestId("dc-doc-replace-confirm-scm-issued")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Replace document" }));
    expect(screen.getByTestId("dc-doc-replace-confirm-scm-issued")).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
    const input = screen.getByTestId("dc-doc-replace-input-scm-issued") as HTMLInputElement;
    const file = new File(["%PDF"], "new.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  it("hides replace for read-only users", () => {
    render(
      <DcChallanDocumentBlock
        title="Signed Document"
        row={{ ...row, status: "SIGNED" }}
        kind="signed"
        document={{ doc_kind: "SIGNED", original_filename: "signed.pdf", has_stored_file: true }}
        canReplace={false}
        onUpload={uploadMock}
      />,
    );
    expect(screen.queryByRole("button", { name: "Replace document" })).toBeNull();
  });
});

describe("DcChallanDocumentPreviewModal", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:dc-preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("renders a PDF iframe from the inline blob", async () => {
    blobMock.mockResolvedValue({
      kind: "file",
      blob: new Blob(["%PDF"], { type: "application/pdf" }),
      contentType: "application/pdf",
      filename: "dc.pdf",
    });
    render(
      <DcChallanDocumentPreviewModal
        open={{
          row,
          kind: "scm-issued",
          document: { doc_kind: "SCM_ISSUED", original_filename: "dc.pdf", content_type: "application/pdf" },
        }}
        onOpenChange={vi.fn()}
      />,
    );
    expect(await screen.findByTitle("dc.pdf")).toBeInTheDocument();
    expect(screen.getByTestId("dc-document-preview-modal")).toBeInTheDocument();
  });

  it("renders an image preview", async () => {
    blobMock.mockResolvedValue({
      kind: "file",
      blob: new Blob(["img"], { type: "image/png" }),
      contentType: "image/png",
      filename: "scan.png",
    });
    render(
      <DcChallanDocumentPreviewModal
        open={{
          row,
          kind: "signed",
          document: { doc_kind: "SIGNED", original_filename: "scan.png", content_type: "image/png" },
        }}
        onOpenChange={vi.fn()}
      />,
    );
    expect(await screen.findByAltText("scan.png")).toBeInTheDocument();
  });

  it("revokes the blob URL when the modal closes", async () => {
    blobMock.mockResolvedValue({
      kind: "file",
      blob: new Blob(["%PDF"], { type: "application/pdf" }),
      contentType: "application/pdf",
      filename: "dc.pdf",
    });
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <DcChallanDocumentPreviewModal
        open={{
          row,
          kind: "scm-issued",
          document: { doc_kind: "SCM_ISSUED", original_filename: "dc.pdf", content_type: "application/pdf" },
        }}
        onOpenChange={onOpenChange}
      />,
    );
    expect(await screen.findByTitle("dc.pdf")).toBeInTheDocument();
    rerender(<DcChallanDocumentPreviewModal open={null} onOpenChange={onOpenChange} />);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:dc-preview");
  });
});
