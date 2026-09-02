"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, Radar, WandSparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type DiscoveryChangeItem,
  type DiscoveryParseResult,
  type DiscoveryPlatform,
  assetDiscoveryService,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

const PLATFORMS: DiscoveryPlatform[] = ["windows", "linux", "macos"];

type Props = {
  assetId: string;
  assetVersion: number;
  currentProfile?: Record<string, unknown> | null;
  onApplied: () => void;
};

export function AssetDiscoveryPanel({
  assetId,
  assetVersion,
  currentProfile,
  onApplied,
}: Props) {
  const [platform, setPlatform] = useState<DiscoveryPlatform>("windows");
  const [command, setCommand] = useState("");
  const [rawOutput, setRawOutput] = useState("");
  const [preview, setPreview] = useState<DiscoveryParseResult | null>(null);
  const [loadingCommand, setLoadingCommand] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [version, setVersion] = useState(assetVersion);

  useEffect(() => {
    setVersion(assetVersion);
  }, [assetVersion]);

  const loadCommand = useCallback(async (selected: DiscoveryPlatform) => {
    setLoadingCommand(true);
    setError(null);
    try {
      const payload = await assetDiscoveryService.getCommand(selected);
      setCommand(payload.command);
    } catch (err) {
      setCommand("");
      setError(err instanceof ApiClientError ? err.message : "Failed to load command");
    } finally {
      setLoadingCommand(false);
    }
  }, []);

  useEffect(() => {
    void loadCommand(platform);
  }, [platform, loadCommand]);

  async function copyCommand() {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Unable to copy command to clipboard");
    }
  }

  async function parseOutput() {
    setActionLoading(true);
    setError(null);
    try {
      const result = await assetDiscoveryService.parse(assetId, {
        platform,
        raw_output: rawOutput,
      });
      setPreview(result);
    } catch (err) {
      setPreview(null);
      setError(err instanceof ApiClientError ? err.message : "Parse failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function applyDiscovery() {
    if (!preview) {
      setError("Parse and preview changes before applying.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const result = await assetDiscoveryService.apply(assetId, {
        platform,
        raw_output: rawOutput,
        version,
        preview_confirmed: true,
      });
      setVersion(result.version);
      setPreview(null);
      setRawOutput("");
      onApplied();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Apply failed");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radar className="size-4" aria-hidden />
          Discovery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Generate a platform command, paste the output, parse for preview, then apply. Nothing is
          saved until Apply. Finance, category, assignment, and workflow fields are never updated.
        </p>

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select
              value={platform}
              onValueChange={(v) => {
                setPlatform(v as DiscoveryPlatform);
                setPreview(null);
              }}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p} className="cursor-pointer">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer"
              disabled={!command || loadingCommand}
              onClick={() => void copyCommand()}
            >
              {copied ? (
                <CheckCircle2 className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              Copy Command
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Discovery command</Label>
          <pre className="max-h-28 overflow-auto rounded-md border bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all">
            {loadingCommand ? "Loading command…" : command || "—"}
          </pre>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discovery_raw">Paste output</Label>
          <textarea
            id="discovery_raw"
            value={rawOutput}
            onChange={(e) => {
              setRawOutput(e.target.value);
              setPreview(null);
            }}
            rows={8}
            className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={"HOSTNAME=...\nSERIAL=...\nOS_NAME=..."}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            disabled={actionLoading || !rawOutput.trim()}
            onClick={() => void parseOutput()}
          >
            {actionLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <WandSparkles className="size-4" aria-hidden />
            )}
            Parse
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer"
            disabled={actionLoading || !preview}
            onClick={() => void applyDiscovery()}
          >
            Apply
          </Button>
        </div>

        {preview ? (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Preview changes</p>
              <Badge variant="secondary" className="font-mono text-xs">
                {preview.changes.length} change(s)
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Serial: {preview.current_serial_number ?? "—"} →{" "}
              {preview.proposed_serial_number ?? "—"}
            </p>
            <ChangeTable changes={preview.changes} />
            <pre className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 text-[11px]">
              {JSON.stringify(preview.profile, null, 2)}
            </pre>
          </div>
        ) : null}

        {currentProfile ? (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Last applied profile
            </p>
            <pre className="max-h-32 overflow-auto rounded-md border bg-muted/30 p-2 text-[11px]">
              {JSON.stringify(currentProfile, null, 2)}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ChangeTable({ changes }: { changes: DiscoveryChangeItem[] }) {
  if (changes.length === 0) {
    return <p className="text-xs text-muted-foreground">No differences detected.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[420px] text-left text-xs">
        <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5">Path</th>
            <th className="px-2 py-1.5">Before</th>
            <th className="px-2 py-1.5">After</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.path} className="border-t">
              <td className="px-2 py-1.5 font-mono">{c.path}</td>
              <td className="px-2 py-1.5">{formatValue(c.before)}</td>
              <td className="px-2 py-1.5">{formatValue(c.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
