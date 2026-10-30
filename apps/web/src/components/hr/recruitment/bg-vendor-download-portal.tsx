"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  clearStoredBgVendorAccess,
  downloadBgVendorDocument,
  fetchBgVendorMeta,
  getStoredBgVendorAccess,
  listBgVendorDocuments,
  loginBgVendor,
  triggerBase64Download,
  type BgVendorDocumentMeta,
} from "@/services/bg-vendor-portal-service";

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring";

export function BgVendorDownloadPortal({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [loginEmailHint, setLoginEmailHint] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [documents, setDocuments] = useState<BgVendorDocumentMeta[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setMetaError(null);
    setError(null);
    try {
      const meta = await fetchBgVendorMeta(token);
      setCandidateName(String(meta.candidate_name || ""));
      setLoginEmailHint(meta.login_email_hint ?? null);
      setExpiresAt(meta.expires_at ?? null);
      if (getStoredBgVendorAccess(token)) {
        clearStoredBgVendorAccess(token);
      }
      setAuthenticated(false);
      setDocuments([]);
    } catch (e) {
      setMetaError(
        e instanceof ApiClientError ? e.message : "Could not open download portal.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  async function handleLogin() {
    const email = loginEmail.trim();
    const code = accessCode.trim();
    if (!email || !code) {
      setError("Enter the email and access code from your invite email.");
      return;
    }
    setLoggingIn(true);
    setError(null);
    try {
      const data = await loginBgVendor(token, email, code);
      setCandidateName(String(data.candidate_name || candidateName || ""));
      setExpiresAt(data.expires_at ?? expiresAt);
      const docs =
        Array.isArray(data.documents) && data.documents.length
          ? data.documents
          : await listBgVendorDocuments(token);
      setDocuments(docs);
      setAuthenticated(true);
    } catch (e) {
      clearStoredBgVendorAccess(token);
      setAuthenticated(false);
      setDocuments([]);
      setError(
        e instanceof ApiClientError
          ? e.message
          : "Invalid login email or access code.",
      );
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleDownload(doc: BgVendorDocumentMeta) {
    setDownloadingId(doc.id);
    setError(null);
    try {
      const file = await downloadBgVendorDocument(token, doc.id);
      triggerBase64Download(file.filename, file.content_base64, file.content_type);
    } catch (e) {
      setError(
        e instanceof ApiClientError ? e.message : "Could not download this file.",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading portal…
      </div>
    );
  }

  if (metaError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <ShieldCheck className="mx-auto mb-3 size-8 text-destructive" />
        <h1 className="text-lg font-semibold text-foreground">Portal unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{metaError}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6 flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Background verification documents
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {candidateName
              ? `Download pack for ${candidateName}`
              : "Secure partner download portal"}
            {expiresAt
              ? ` · Expires ${new Date(expiresAt).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : ""}
          </p>
        </div>
      </div>

      {!authenticated ? (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Sign in with the partner email and access code from your BG check
            invitation
            {loginEmailHint ? ` (hint: ${loginEmailHint})` : ""}.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Login email
            </label>
            <input
              type="email"
              className={inputClass}
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="partner@example.com"
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Access code
            </label>
            <input
              type="password"
              className={inputClass}
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Access code from email"
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleLogin();
              }}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            className="w-full cursor-pointer"
            disabled={loggingIn}
            onClick={() => void handleLogin()}
          >
            {loggingIn ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in to download"
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-medium text-foreground">Available documents</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {documents.length
                ? `${documents.length} file(s) ready to download`
                : "No documents uploaded yet — contact HR if you expected files here."}
            </p>
            {documents.length ? (
              <ul className="mt-4 divide-y divide-border">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {doc.filename}
                      </span>
                      {doc.kind ? (
                        <span className="block text-[11px] text-muted-foreground">
                          {String(doc.kind).replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={downloadingId === doc.id}
                      onClick={() => void handleDownload(doc)}
                    >
                      {downloadingId === doc.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <>
                          <Download className="mr-1.5 size-3.5" />
                          Download
                        </>
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer text-muted-foreground"
            onClick={() => {
              clearStoredBgVendorAccess(token);
              setAuthenticated(false);
              setDocuments([]);
              setAccessCode("");
            }}
          >
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}
