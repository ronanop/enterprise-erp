"use client";

import { useState } from "react";
import { SubHeader } from "@/components/app-header";
import { IconClose, IconSparkle } from "@/components/icons";
import { AiFab, AlertBox } from "@/components/ui";
import * as ui from "@/theme/classes";

export default function UploadDocumentPage() {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <SubHeader title="Upload Document" backHref="/documents" />

      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Secure Documents</h1>
        <p className="mt-1 text-sm text-[#434655]">
          Upload your official documents for verification. Our AI will
          automatically identify and extract relevant details.
        </p>
      </div>

      {message ? <AlertBox tone="success">{message}</AlertBox> : null}

      <button
        type="button"
        onClick={() => setMessage("Document queued for AI processing")}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-[#c3c6d7] bg-white px-4 py-10"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2563eb] text-2xl text-white">
          ↑
        </span>
        <p className="font-semibold text-[#0b1c30]">Tap to Upload</p>
        <p className="text-sm text-[#434655]">or drag and drop PDF, JPG, PNG</p>
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="rounded-2xl bg-[#eff4ff] px-3 py-4 text-sm font-semibold text-[#004ac6]"
        >
          OCR Scan
        </button>
        <button
          type="button"
          className="rounded-2xl bg-[#eff4ff] px-3 py-4 text-sm font-semibold text-[#004ac6]"
        >
          Gallery
        </button>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-[#434655]">
            Active Upload
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#eaddff] px-2.5 py-0.5 text-[10px] font-bold text-[#712ae2]">
            <IconSparkle size={12} /> AI Processing
          </span>
        </div>
        <div className={`${ui.card} relative overflow-hidden p-4`}>
          <div className="absolute left-0 top-0 h-1 w-3/5 bg-[#2563eb]" />
          <div className="flex items-start gap-3">
            <div className="h-14 w-11 rounded-lg bg-[#eff4ff]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-[#0b1c30]">
                  Passport_Scan_v2.jpg ✓
                </p>
                <button type="button" className="text-[#ba1a1a]" aria-label="Remove">
                  <IconClose size={16} />
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#dbe1ff] px-2 py-0.5 text-[10px] font-bold text-[#004ac6]">
                  Identified: Passport
                </span>
                <span className="rounded-full bg-[#eff4ff] px-2 py-0.5 text-[10px] font-bold text-[#434655]">
                  1.2 MB
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#c3c6d7]/30 pt-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase text-[#434655]">Full Name</p>
                  <p className="font-semibold text-[#0b1c30]">Riya Sharma</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[#434655]">Expiry</p>
                  <p className="font-semibold text-[#0b1c30]">24 Oct 2029</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-2xl bg-[#eff4ff] p-4">
        <p className="font-semibold text-[#004ac6]">Upload Requirements</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[#434655]">
          <li>Ensure all four corners of the document are visible.</li>
          <li>High-resolution image (at least 300 DPI recommended).</li>
          <li>Maximum file size: 10MB per document.</li>
        </ul>
      </div>

      <AiFab href="/documents" />
    </div>
  );
}
