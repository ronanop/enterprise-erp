"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { IconDownload } from "@/components/icons";
import { AlertBox, EmptyState } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssDocument } from "@/types/api";
import * as ui from "@/theme/classes";

export default function DocumentViewerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<EssDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    essService
      .document(params.id)
      .then((res) => {
        setDoc(res.data);
        if (!res.data) setError("Document not found");
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load document",
        ),
      )
      .finally(() => setLoading(false));
  }, [params.id]);

  const canDownload = Boolean(doc?.storage_uri?.startsWith("ess-doc:"));

  const onDownload = useCallback(async () => {
    if (!doc || !canDownload) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await essService.downloadDocumentBlob(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.document_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Download failed",
      );
    } finally {
      setDownloading(false);
    }
  }, [doc, canDownload]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-[#434655]">Loading document…</div>
    );
  }

  if (!doc) {
    return (
      <div className="space-y-4">
        <SubHeader title="Document" backHref="/documents" />
        {error ? <AlertBox>{error}</AlertBox> : <EmptyState title="Not found" />}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <SubHeader
        title={doc.document_name}
        backHref="/documents"
        right={
          canDownload ? (
            <button
              type="button"
              onClick={() => void onDownload()}
              disabled={downloading}
              className="text-[#004ac6] disabled:opacity-50"
              aria-label="Download"
            >
              <IconDownload size={20} />
            </button>
          ) : null
        }
      />

      {error ? <AlertBox>{error}</AlertBox> : null}

      <div className={`${ui.card} space-y-2 p-4 text-sm`}>
        <Row label="Type" value={doc.document_type} />
        <Row label="Number" value={doc.document_number} />
        <Row label="Verification" value={doc.verification_status} />
        <Row label="Status" value={doc.status} />
        {doc.issued_on ? <Row label="Issued" value={doc.issued_on} /> : null}
        {doc.expires_on ? <Row label="Expires" value={doc.expires_on} /> : null}
      </div>

      {canDownload ? (
        <button
          type="button"
          onClick={() => void onDownload()}
          disabled={downloading}
          className={`${ui.btn} block w-full text-center disabled:opacity-50`}
        >
          {downloading ? "Downloading…" : "Download file"}
        </button>
      ) : (
        <p className="text-center text-sm text-[#434655]">
          This document has no downloadable file attached in the employee portal.
        </p>
      )}

      <button
        type="button"
        onClick={() => router.push("/documents")}
        className="w-full text-center text-sm font-medium text-[#004ac6]"
      >
        Back to documents
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[#c3c6d7]/20 py-2 last:border-0">
      <span className="text-[#434655]">{label}</span>
      <span className="max-w-[60%] truncate text-right font-semibold text-[#0b1c30]">
        {value}
      </span>
    </div>
  );
}
