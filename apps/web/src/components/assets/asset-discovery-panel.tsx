"use client";

import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerialFromIndex,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import {
  DISCOVERY_OS_OPTIONS,
  DISCOVERY_WINDOWS_SHELL_OPTIONS,
  formatDiscoveryCommandsForClipboard,
  getDiscoveryCommandPack,
  type DiscoveryWindowsShell,
} from "@/components/assets/discovery-commands";

import { useEffect, useMemo, useState } from "react";
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
  const [windowsShell, setWindowsShell] = useState<DiscoveryWindowsShell>("powershell");
  const [rawOutput, setRawOutput] = useState("");
  const [preview, setPreview] = useState<DiscoveryParseResult | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [version, setVersion] = useState(assetVersion);

  const commandPack = useMemo(
    () => getDiscoveryCommandPack(platform, windowsShell),
    [platform, windowsShell],
  );

  useEffect(() => {
    setVersion(assetVersion);
  }, [assetVersion]);

  async function copyCommands() {
    const text = formatDiscoveryCommandsForClipboard(commandPack);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Unable to copy commands to clipboard");
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
    <Card data-testid="asset-discovery-panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radar className="size-4" aria-hidden />
          Discovery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Select an OS (and Windows shell) to generate read-only inventory commands. Copy them, run
          them manually in your own terminal, then paste the output here. The ERP never executes
          these commands — nothing is saved until you click Apply.
        </p>

        {error ? (
          <p
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
          <div className="space-y-1.5">
            <Label htmlFor="discovery-os">Operating System</Label>
            <Select
              value={platform}
              onValueChange={(v) => {
                setPlatform(v as DiscoveryPlatform);
                setPreview(null);
                setCopied(false);
              }}
            >
              <SelectTrigger id="discovery-os" className="cursor-pointer" data-testid="discovery-os">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISCOVERY_OS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id} className="cursor-pointer">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {platform === "windows" ? (
            <div className="space-y-1.5">
              <Label htmlFor="discovery-shell">Shell</Label>
              <Select
                value={windowsShell}
                onValueChange={(v) => {
                  setWindowsShell(v as DiscoveryWindowsShell);
                  setPreview(null);
                  setCopied(false);
                }}
              >
                <SelectTrigger
                  id="discovery-shell"
                  className="cursor-pointer"
                  data-testid="discovery-shell"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCOVERY_WINDOWS_SHELL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id} className="cursor-pointer">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <Label>Basic System Information</Label>
              <p className="text-[11px] text-muted-foreground">
                Intended for: <span className="font-medium text-foreground">{commandPack.shellLabel}</span>
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              data-testid="discovery-copy-commands"
              onClick={() => void copyCommands()}
            >
              {copied ? (
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              Copy Commands
            </Button>
          </div>
          {copied ? (
            <p className="text-xs text-emerald-700" data-testid="discovery-copy-success" role="status">
              Commands copied
            </p>
          ) : null}
          <pre
            className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all"
            data-testid="discovery-basic-commands"
          >
            {commandPack.basicSystemInformation}
          </pre>
        </div>

        <div className="space-y-2">
          <Label>Optional reference commands</Label>
          <p className="text-[11px] text-muted-foreground">
            Labels below are for guidance only — they are not included in Copy Commands.
          </p>
          <div
            className="max-h-40 space-y-2 overflow-auto rounded-md border bg-muted/20 p-3"
            data-testid="discovery-reference-commands"
          >
            {commandPack.referenceCommands.map((item) => (
              <div key={item.title} className="space-y-0.5">
                <p className="text-[11px] font-medium text-muted-foreground">{item.title}</p>
                <code className="block text-[11px] break-all text-foreground">{item.command}</code>
              </div>
            ))}
          </div>
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
            data-testid="discovery-paste-output"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            disabled={actionLoading || !rawOutput.trim()}
            data-testid="discovery-parse"
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
            className="cursor-pointer transition-colors duration-200"
            disabled={actionLoading || !preview}
            data-testid="discovery-apply"
            onClick={() => void applyDiscovery()}
          >
            Apply
          </Button>
        </div>

        {preview ? (
          <div className="space-y-2 rounded-md border p-3" data-testid="discovery-preview">
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
            <th className={tableSerialHeaderClassName()} scope="col">
              {TABLE_SERIAL_HEADER_LABEL}
            </th>
            <th className="px-2 py-1.5">Path</th>
            <th className="px-2 py-1.5">Before</th>
            <th className="px-2 py-1.5">After</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c, index) => (
            <tr key={c.path} className="border-t">
              <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
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
