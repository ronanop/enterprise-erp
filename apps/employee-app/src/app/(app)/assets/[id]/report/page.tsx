"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { AlertBox } from "@/components/ui";
import * as ui from "@/theme/classes";

const URGENCY = ["Low", "Medium", "Critical"] as const;

export default function ReportAssetIssuePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assetId = params.id;
  const [category, setCategory] = useState("");
  const [urgency, setUrgency] =
    useState<(typeof URGENCY)[number]>("Medium");
  const [desc, setDesc] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    setMessage("Issue report submitted to IT Ops");
    setLoading(false);
    setTimeout(() => router.push(`/assets/${assetId}`), 800);
  }

  return (
    <div className="space-y-5">
      <SubHeader title="Report Issue" backHref={`/assets/${assetId}`} />

      {message ? <AlertBox tone="success">{message}</AlertBox> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <h2 className="text-lg font-semibold text-[#0b1c30]">Asset Details</h2>
        <div className={`${ui.card} p-4 text-sm text-[#434655]`}>
          Asset ID: <span className="font-semibold text-[#0b1c30]">{assetId}</span>
        </div>

        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          Problem Category
          <select
            className={ui.input}
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Select a category</option>
            <option>Hardware</option>
            <option>Software</option>
            <option>Display</option>
            <option>Battery</option>
            <option>Other</option>
          </select>
        </label>

        <div>
          <p className="mb-2 text-sm font-semibold text-[#434655]">
            Urgency Level
          </p>
          <div className="grid grid-cols-3 gap-2">
            {URGENCY.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUrgency(u)}
                className={`rounded-xl border px-2 py-3 text-sm font-semibold ${
                  urgency === u
                    ? "border-[#2563eb] bg-[#eff4ff] text-[#004ac6]"
                    : "border-[#c3c6d7]/50 bg-white text-[#434655]"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-[#434655]">
            Damage Evidence
          </p>
          <button
            type="button"
            className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-[#2563eb]/40 bg-[#eff4ff] px-4 py-8 text-sm font-semibold text-[#004ac6]"
          >
            Tap to upload photos
          </button>
        </div>

        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          Issue Description
          <textarea
            className={`${ui.input} min-h-[100px] resize-none`}
            required
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Describe the issue in detail..."
          />
        </label>

        <button className={`${ui.btn} w-full`} disabled={loading || !desc}>
          {loading ? "Submitting…" : "Submit Report"}
        </button>
      </form>
    </div>
  );
}
