"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, RefreshCw } from "lucide-react";

import { EmailWorkspaceNav } from "@/components/email/email-workspace-nav";
import { FinanceField, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createEmailTemplate,
  listEmailTemplates,
  type EmailTemplateRow,
} from "@/services/email-notification-service";
import { ApiClientError } from "@/services/api-client";

export function EmailTemplatesPage() {
  const [rows, setRows] = useState<EmailTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Hello {{name}}");
  const [body, setBody] = useState("<p>Hello {{name}},</p><p>{{message}}</p>");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listEmailTemplates());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createEmailTemplate({
        template_code: code.trim(),
        template_name: name.trim(),
        channel: "email",
        subject_template: subject,
        body_template: body,
      });
      setShowForm(false);
      setCode("");
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <EmailWorkspaceNav />
      <PageHeader
        title="Email templates"
        description="Channel templates with {{variable}} placeholders."
        actions={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              onClick={() => setShowForm((v) => !v)}
            >
              <Plus className="size-3.5" />
              New template
            </Button>
          </div>
        }
      />

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <form
          onSubmit={(e) => void onCreate(e)}
          className="max-w-3xl space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FinanceField label="Template code" htmlFor="code">
              <Input id="code" required value={code} onChange={(e) => setCode(e.target.value)} />
            </FinanceField>
            <FinanceField label="Name" htmlFor="name">
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </FinanceField>
          </div>
          <FinanceField label="Subject template" htmlFor="subject">
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </FinanceField>
          <FinanceField label="Body HTML template" htmlFor="body">
            <FinanceTextarea
              id="body"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="font-mono text-xs"
            />
          </FinanceField>
          <Button type="submit" disabled={saving} className="cursor-pointer">
            {saving ? "Saving…" : "Create template"}
          </Button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2.5 font-medium">Code</th>
              <th className="px-3 py-2.5 font-medium">Name</th>
              <th className="px-3 py-2.5 font-medium">Subject</th>
              <th className="px-3 py-2.5 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 last:border-0">
                <td className="px-3 py-2.5 font-mono text-xs">{row.template_code}</td>
                <td className="px-3 py-2.5">{row.template_name}</td>
                <td className="max-w-[280px] truncate px-3 py-2.5 text-muted-foreground">
                  {row.subject_template ?? "—"}
                </td>
                <td className="px-3 py-2.5">{row.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No email templates yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
