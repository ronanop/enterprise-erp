"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { IconDownload, IconSparkle } from "@/components/icons";
import { mockDocuments } from "@/data/mock-portal";
import * as ui from "@/theme/classes";

export default function DocumentViewerPage() {
  const params = useParams<{ id: string }>();
  const doc =
    mockDocuments.find((d) => d.id === params.id) ?? mockDocuments[2];

  return (
    <div className="space-y-4 pb-8">
      <SubHeader
        title={doc.title.replace(/\.pdf$/i, "")}
        backHref="/documents"
        right={
          <div className="flex items-center gap-2">
            <button type="button" className="text-[#004ac6]" aria-label="Download">
              <IconDownload size={20} />
            </button>
            <button type="button" className={`${ui.btn} !px-3 !py-1.5 text-xs`}>
              Sign Now
            </button>
          </div>
        }
      />
      <p className="-mt-2 px-1 text-xs text-[#434655]">{doc.modified}</p>

      <Meta icon="⏱" label="Version" value="v2.4 Final" tone="blue" />
      <Meta icon="✓" label="Status" value="Ready to Sign" tone="purple" />
      <Meta icon="🔒" label="Access" value="Confidential" tone="green" />

      <div className={`${ui.card} flex items-center gap-3 p-4`}>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#dbe1ff] text-[#004ac6]">
          ■
        </span>
        <div>
          <p className="font-semibold text-[#0b1c30]">Quantum Collective</p>
          <p className="text-sm text-[#434655]">
            124 Innovation Way, Tech Valley, CA
          </p>
        </div>
      </div>

      <section className={`${ui.card} space-y-3 p-4`}>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#712ae2] to-[#2563eb] text-white">
            <IconSparkle size={14} />
          </span>
          <h2 className="font-semibold text-[#0b1c30]">AI Smart Summary</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Summary label="Key Term" value="Base: $165k/yr" color="bg-[#dbe1ff] text-[#004ac6]" />
          <Summary label="Notice Period" value="4-week notice" color="bg-[#eaddff] text-[#712ae2]" />
          <Summary label="Equity" value="4-year Vesting" color="bg-emerald-100 text-emerald-800" />
          <Summary label="Expiration" value="Valid 7 Days" color="bg-[#ffdad6] text-[#ba1a1a]" />
        </div>
        <Link
          href="/documents"
          className="block text-center text-sm text-[#434655]"
        >
          View full clause breakdown
        </Link>
      </section>
    </div>
  );
}

function Meta({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: "blue" | "purple" | "green";
}) {
  const bg =
    tone === "purple"
      ? "bg-[#eaddff] text-[#712ae2]"
      : tone === "green"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-[#dbe1ff] text-[#004ac6]";
  return (
    <div className={`${ui.card} flex items-center gap-3 p-4`}>
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm ${bg}`}
      >
        {icon}
      </span>
      <div>
        <p className="text-xs text-[#434655]">{label}</p>
        <p className="font-semibold text-[#0b1c30]">{value}</p>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <p className="text-[10px] font-bold uppercase opacity-80">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}
