"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, FileText, RefreshCw } from "lucide-react";

import { HrAuthBanner } from "@/components/hr/hr-primitives";
import {
  SetupDrawer,
  SetupField,
} from "@/components/hr/setup/setup-drawer";
import { SetupToastHost, toast } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth";
import { authService } from "@/services/api-client";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import {
  acceptOrgDocument,
  listOrgDocuments,
  listPendingForEmployee,
  type OrgDocument,
} from "@/services/edoc-org-documents-service";

type Viewer = {
  employeeId: string;
  employeeCode: string;
  email: string;
  name: string;
};

export function EssOrgDocsPage() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [pending, setPending] = useState<OrgDocument[]>([]);
  const [history, setHistory] = useState<
    { doc: OrgDocument; status: string; respondedAt?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<OrgDocument | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let email = "";
      let name = "";
      try {
        const me = await authService.me();
        email = String(me.data?.email ?? "").toLowerCase();
        name = String(me.data?.display_name || me.data?.full_name || email);
      } catch {
        /* guest / offline */
      }

      const { records } = await loadEmployeeDirectory().catch(() => ({ records: [] }));
      const match =
        records.find((r) => (r.officialEmail || "").toLowerCase() === email) ||
        records.find(
          (r) =>
            (r.extension?.personal?.email || "").toLowerCase() === email ||
            (r.extension?.personal?.personalEmail || "").toLowerCase() === email,
        );

      const v: Viewer = {
        employeeId: match?.id || email || "current-user",
        employeeCode: match?.employeeCode || "",
        email: email || match?.officialEmail || "",
        name: match?.displayName || name || "You",
      };
      setViewer(v);

      const pendingDocs = listPendingForEmployee({
        employeeId: match?.id,
        employeeCode: match?.employeeCode,
        email: v.email,
      });
      setPending(pendingDocs);

      const hist: { doc: OrgDocument; status: string; respondedAt?: string }[] = [];
      for (const doc of listOrgDocuments()) {
        const a = doc.acceptances.find(
          (x) =>
            x.employeeId === match?.id ||
            (match?.employeeCode &&
              x.employeeCode.toLowerCase() === match.employeeCode.toLowerCase()) ||
            (v.email && x.email.toLowerCase() === v.email),
        );
        if (a && a.status !== "pending") {
          hist.push({ doc, status: a.status, respondedAt: a.respondedAt });
        }
      }
      setHistory(hist);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signedIn = useMemo(() => isAuthenticated(), []);

  async function respond(decision: "accepted" | "declined") {
    if (!active || !viewer) return;
    setActing(true);
    try {
      const matchId =
        active.acceptances.find(
          (a) =>
            a.employeeId === viewer.employeeId ||
            (viewer.employeeCode &&
              a.employeeCode.toLowerCase() === viewer.employeeCode.toLowerCase()) ||
            (viewer.email && a.email.toLowerCase() === viewer.email),
        )?.employeeId ?? viewer.employeeId;

      acceptOrgDocument(active.id, matchId, decision);
      toast(
        decision === "accepted" ? "Document accepted" : "Document declined",
        decision === "accepted" ? "success" : "error",
      );
      setActive(null);
      await load();
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      {!signedIn ? <HrAuthBanner /> : null}
      <PageHeader
        title="Org documents"
        description="Policies and documents sent by HR. Accept here in the PWA until the employee app is ready."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/hr/ess-inbox"
              className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              Back to requests
            </Link>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer gap-1"
              onClick={() => void load()}
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Pending acceptance</h2>
            {pending.length === 0 ? (
              <p className="rounded-xl border border-border/70 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                No documents waiting for you
                {viewer?.name ? ` (${viewer.name})` : ""}.
              </p>
            ) : (
              <ul className="space-y-2">
                {pending.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {doc.code} · {doc.kind}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="cursor-pointer"
                      onClick={() => setActive(doc)}
                    >
                      Review & accept
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {history.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Your responses</h2>
              <ul className="space-y-1.5">
                {history.map(({ doc, status, respondedAt }) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="truncate font-medium">{doc.title}</span>
                    <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                      {status}
                      {respondedAt ? ` · ${respondedAt.slice(0, 10)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <SetupDrawer
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.title || "Document"}
        description={active ? `${active.code} · ${active.kind}` : undefined}
        wide
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={acting}
              onClick={() => void respond("declined")}
            >
              Decline
            </Button>
            <Button
              type="button"
              className="cursor-pointer gap-1"
              disabled={acting}
              onClick={() => void respond("accepted")}
            >
              <Check className="size-3.5" />
              {acting ? "Saving…" : "I accept"}
            </Button>
          </>
        }
      >
        {active ? (
          <div className="space-y-3">
            {active.body.trim() ? (
              <SetupField label="Content">
                <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/20 p-3 text-sm leading-relaxed">
                  {active.body}
                </div>
              </SetupField>
            ) : null}
            {(active.attachments?.length ?? 0) > 0 ? (
              <SetupField label="Attachments">
                <ul className="space-y-1.5">
                  {active.attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        href={a.dataUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm text-primary hover:bg-muted/30"
                      >
                        <FileText className="size-3.5 shrink-0" />
                        <span className="truncate">{a.fileName}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </SetupField>
            ) : null}
          </div>
        ) : null}
      </SetupDrawer>
    </div>
  );
}
