"use client";

import { useCallback, useEffect, useState } from "react";
import { Cloud, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatApiError } from "@/services/api-client";
import {
  listM365Files,
  listM365Workspaces,
  registerM365File,
  type M365File,
  type M365Workspace,
} from "@/services/marketing-service";

export function MarketingM365Board() {
  const [workspaces, setWorkspaces] = useState<M365Workspace[]>([]);
  const [files, setFiles] = useState<M365File[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setWorkspaces(await listM365Workspaces());
      setFiles(await listM365Files());
    } catch (err) {
      setError(formatApiError(err, "Failed to load Microsoft 365 records"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRegister() {
    if (!name.trim()) return;
    setError(null);
    try {
      await registerM365File(name.trim());
      setName("");
      await load();
    } catch (err) {
      setError(formatApiError(err, "Register failed"));
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Microsoft 365 collaboration"
        description="Campaign Teams workspaces, SharePoint libraries, and OneDrive drafts. Graph provisions when Entra credentials are configured."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => void load()}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </Button>
        }
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <section className="rounded-md border border-border/70 bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Campaign workspaces</h2>
        {workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create a campaign to auto-provision a Teams workspace.</p>
        ) : (
          <ul className="space-y-2">
            {workspaces.map((ws) => (
              <li key={ws.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{ws.display_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(ws.folder_structure?.folders ?? []).join(" · ") || "Standard library folders"}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {ws.provision_status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-md border border-border/70 bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">OneDrive working files</h2>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Draft file name"
            className="transition-colors duration-200"
          />
          <Button type="button" className="cursor-pointer transition-colors duration-200" onClick={() => void onRegister()}>
            <Cloud className="size-3.5" aria-hidden />
            Register draft
          </Button>
        </div>
        <ul className="space-y-1 text-xs">
          {files.map((file) => (
            <li key={file.id} className="flex justify-between gap-2 border-b border-border/40 py-2 last:border-0">
              <span>
                {file.file_name}{" "}
                <span className="text-muted-foreground">
                  {file.storage_tier}
                  {file.folder_path}
                </span>
              </span>
              <span className="font-mono text-muted-foreground">{file.version_label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
