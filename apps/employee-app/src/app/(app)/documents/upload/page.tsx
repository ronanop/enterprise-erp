"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import * as ui from "@/theme/classes";

const DOC_TYPES = [
  { value: "id_proof", label: "ID proof" },
  { value: "address_proof", label: "Address proof" },
  { value: "contract", label: "Contract / offer" },
  { value: "certificate", label: "Certificate / education" },
  { value: "other", label: "Other" },
] as const;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [".pdf", ".png", ".jpg", ".jpeg"];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      const base64 = result.includes(",") ? result.split(",", 2)[1]! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function UploadDocumentPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<string>("id_proof");
  const [documentName, setDocumentName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onPickFile(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    const ext = `.${next.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!ALLOWED.includes(ext)) {
      setError("Allowed file types: PDF, PNG, JPG, JPEG");
      setFile(null);
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("Maximum file size is 10MB");
      setFile(null);
      return;
    }
    setFile(next);
    if (!documentName.trim()) {
      setDocumentName(next.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a file to upload");
      return;
    }
    const name = documentName.trim();
    if (!name) {
      setError("Enter a document name");
      return;
    }
    setSubmitting(true);
    try {
      const content_base64 = await readFileAsBase64(file);
      const res = await essService.uploadDocument({
        document_type: documentType,
        document_name: name,
        file_name: file.name,
        content_base64,
        content_type: file.type || undefined,
      });
      const id = res.data?.id;
      if (id) {
        router.replace(`/documents/${id}`);
      } else {
        router.replace("/documents");
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Upload failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <SubHeader title="Upload Document" backHref="/documents" />

      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Upload document</h1>
        <p className="mt-1 text-sm text-[#434655]">
          Files are stored securely and sent to HR for verification (status:
          pending).
        </p>
      </div>

      {error ? <AlertBox>{error}</AlertBox> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[#434655]">Document type</span>
          <select
            className={`${ui.input} w-full`}
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-[#434655]">Document name</span>
          <input
            className={`${ui.input} w-full`}
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder="e.g. Aadhaar card"
            maxLength={255}
          />
        </label>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-[#c3c6d7] bg-white px-4 py-10"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2563eb] text-2xl text-white">
            ↑
          </span>
          <p className="font-semibold text-[#0b1c30]">
            {file ? file.name : "Tap to choose file"}
          </p>
          <p className="text-sm text-[#434655]">PDF, JPG, or PNG — max 10MB</p>
        </button>

        <button
          type="submit"
          disabled={submitting || !file}
          className={`${ui.btn} w-full disabled:opacity-50`}
        >
          {submitting ? "Uploading…" : "Submit for verification"}
        </button>
      </form>
    </div>
  );
}
