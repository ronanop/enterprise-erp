"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AppHeader,
  FilterChips,
  SearchField,
} from "@/components/app-header";
import { IconDownload, IconWallet } from "@/components/icons";
import { AiFab, EmptyState } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssDocument } from "@/types/api";
import * as ui from "@/theme/classes";

const FILTERS = ["All", "Personal", "Company", "Tax"];

function categoryFor(doc: EssDocument): string {
  if (doc.document_type === "id_proof" || doc.document_type === "address_proof") {
    return "Personal";
  }
  if (doc.document_type === "certificate") return "Tax";
  return "Company";
}

export default function DocumentsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [docs, setDocs] = useState<EssDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    essService
      .documents()
      .then((res) => setDocs(res.data ?? []))
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load documents",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const mapped = useMemo(
    () =>
      docs.map((d) => ({
        id: d.id,
        title: d.document_name,
        category: categoryFor(d),
        modified: d.verification_status,
        recent: d.verification_status === "verified",
        href: d.storage_uri?.startsWith("http")
          ? d.storage_uri
          : `/documents/${d.id}`,
      })),
    [docs],
  );

  const recent = mapped.filter((d) => d.recent).slice(0, 6);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mapped.filter((d) => {
      if (filter !== "All" && d.category !== filter) return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [mapped, query, filter]);

  return (
    <div className="space-y-5">
      <AppHeader title="Documents" />

      {error ? (
        <p className="rounded-xl bg-[#ffdad6] px-3 py-2 text-sm text-[#ba1a1a]">{error}</p>
      ) : null}

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search documents..."
      />
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0b1c30]">Recently Viewed</h2>
          <Link href="/documents/upload" className="text-sm font-medium text-[#004ac6]">
            Upload
          </Link>
        </div>
        {loading ? (
          <EmptyState title="Loading…" />
        ) : recent.length === 0 ? (
          <EmptyState title="No recent documents" />
        ) : (
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {recent.map((d) => (
              <Link
                key={d.id}
                href={d.href}
                className={`${ui.card} w-40 shrink-0 space-y-2 p-4`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dbe1ff] text-[#004ac6]">
                  <IconWallet size={18} />
                </span>
                <p className="truncate text-sm font-semibold text-[#0b1c30]">
                  {d.title}
                </p>
                <p className="text-[10px] font-bold uppercase text-[#434655]">
                  {d.category}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#0b1c30]">All Documents</h2>
        {loading ? (
          <EmptyState title="Loading documents…" />
        ) : rows.length === 0 ? (
          <EmptyState title="No documents" />
        ) : (
          <ul className="space-y-2">
            {rows.map((d) => (
              <li key={d.id}>
                <Link
                  href={d.href}
                  className={`${ui.card} flex items-center gap-3 p-4`}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eff4ff] text-[#004ac6]">
                    <IconWallet size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#0b1c30]">
                      {d.title}
                    </p>
                    <p className="text-xs text-[#434655]">{d.modified}</p>
                  </div>
                  <IconDownload size={18} className="text-[#004ac6]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AiFab href="/documents/upload" />
    </div>
  );
}
