"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus, RefreshCw } from "lucide-react";

import { HrAuthBanner, HrStatusBadge } from "@/components/hr/hr-primitives";
import { SetupToastHost, toast } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  hrEssPoliciesService,
  type HrEssPolicyRow,
} from "@/services/hr-ess-policies-service";

export function HrEssPoliciesPage() {
  const [rows, setRows] = useState<HrEssPolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HrEssPolicyRow | null>(null);
  const [form, setForm] = useState({
    policy_code: "",
    title: "",
    content_markdown: "",
    is_mandatory: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrEssPoliciesService.list();
      const data = Array.isArray(res.data) ? res.data : [];
      setRows(data as HrEssPolicyRow[]);
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.message : "Failed to load policies",
        "error",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveNew() {
    try {
      await hrEssPoliciesService.create({
        policy_code: form.policy_code.trim(),
        title: form.title.trim(),
        content_markdown: form.content_markdown,
        is_mandatory: form.is_mandatory,
        status: "draft",
      });
      toast("Policy created", "success");
      setForm({ policy_code: "", title: "", content_markdown: "", is_mandatory: true });
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Create failed", "error");
    }
  }

  async function saveEdit() {
    if (!editing) return;
    try {
      await hrEssPoliciesService.update(editing.id, {
        title: editing.title,
        content_markdown: editing.content_markdown,
        is_mandatory: editing.is_mandatory,
      });
      toast("Policy updated", "success");
      setEditing(null);
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Update failed", "error");
    }
  }

  async function publish(id: string) {
    try {
      await hrEssPoliciesService.publish(id);
      toast("Published — employees must re-ack if version bumped", "success");
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Publish failed", "error");
    }
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <HrAuthBanner />
      <PageHeader
        title="ESS Policies"
        description="Publish mandatory walkthroughs for the employee app. Use ## headings for steps."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh
            </Button>
            <Link href="/hr/ess-inbox">
              <Button variant="outline" size="sm">
                Employee Requests
              </Button>
            </Link>
          </div>
        }
      />

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Plus className="h-4 w-4" />
          New policy
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Policy code (e.g. CODE_OF_CONDUCT)"
            value={form.policy_code}
            onChange={(e) => setForm((f) => ({ ...f, policy_code: e.target.value }))}
          />
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <textarea
          className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
          placeholder="Markdown content — use ## Step title for walkthrough steps"
          value={form.content_markdown}
          onChange={(e) => setForm((f) => ({ ...f, content_markdown: e.target.value }))}
        />
        <Button
          size="sm"
          disabled={!form.policy_code || !form.title || !form.content_markdown}
          onClick={() => void saveNew()}
        >
          Create draft
        </Button>
      </section>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border bg-card p-4">
              {editing?.id === row.id ? (
                <div className="space-y-2">
                  <Input
                    value={editing.title}
                    onChange={(e) =>
                      setEditing({ ...editing, title: e.target.value })
                    }
                  />
                  <textarea
                    className="min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                    value={editing.content_markdown}
                    onChange={(e) =>
                      setEditing({ ...editing, content_markdown: e.target.value })
                    }
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void saveEdit()}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-2 font-semibold">
                        <FileText className="h-4 w-4 text-primary" />
                        {row.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.policy_code} · v{row.policy_version}
                      </p>
                    </div>
                    <HrStatusBadge status={row.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                      Edit
                    </Button>
                    {row.status !== "published" ? (
                      <Button size="sm" onClick={() => void publish(row.id)}>
                        Publish
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => void publish(row.id)}>
                        Republish (bump version)
                      </Button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
