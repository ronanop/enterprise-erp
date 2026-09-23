"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Hash, Package, UserCheck } from "lucide-react";
import Link from "next/link";

import {
  NonItAssignmentPicker,
  type AssignmentTarget,
} from "@/components/assets/non-it/non-it-assignment-picker";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  createNonItAsset,
  listNonItAssetTypes,
  peekNonItNextCode,
  type NonItAssetType,
} from "@/services/nonit-asset-service";
import { cn } from "@/lib/utils";

function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

type Intent = "stock" | "assign";

export function NonItAddAssetPage() {
  const router = useRouter();
  const [types, setTypes] = useState<NonItAssetType[]>([]);
  const [assetTypeId, setAssetTypeId] = useState("");
  const [intent, setIntent] = useState<Intent>("stock");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [target, setTarget] = useState<AssignmentTarget>({
    employee_id: null,
    location_id: null,
  });
  const [codePreview, setCodePreview] = useState<string | null>(null);
  const [codePreviewLoading, setCodePreviewLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const items = await listNonItAssetTypes({ active: true });
        if (!cancelled) setTypes(items);
      } catch {
        if (!cancelled) setTypes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedType = useMemo(
    () => types.find((t) => t.id === assetTypeId) ?? null,
    [types, assetTypeId],
  );

  useEffect(() => {
    if (!assetTypeId) {
      setCodePreview(null);
      return;
    }
    let cancelled = false;
    setCodePreviewLoading(true);
    void (async () => {
      try {
        const preview = await peekNonItNextCode(assetTypeId);
        if (!cancelled) setCodePreview(preview.provisional_code);
      } catch {
        if (!cancelled) setCodePreview(null);
      } finally {
        if (!cancelled) setCodePreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetTypeId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assetTypeId) {
      setError("Select an asset type");
      return;
    }
    if (intent === "assign" && !target.employee_id && !target.location_id) {
      setError("Select an employee or location for assignment");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const status = intent === "assign" ? "ASSIGNED" : "IN_STOCK";
      const created = await createNonItAsset({
        asset_type_id: assetTypeId,
        status,
        purchase_date: purchaseDate || null,
        remarks: remarks.trim() || null,
        current_employee_id: intent === "assign" ? target.employee_id : null,
        current_location_id: intent === "assign" ? target.location_id : null,
      });
      router.push(`/assets/non-it/${created.id}`);
    } catch (err) {
      setError(formatApiError(err, "Failed to create asset"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="relative -mx-1 min-h-[calc(100dvh-6rem)] sm:-mx-2 md:mx-0"
      data-testid="nonit-add-asset-page"
    >
      {/* Atmosphere — design-system navy/sky, no purple */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(3,105,161,0.09),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(15,23,42,0.06),_transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100dvh-7.5rem)] w-full max-w-5xl flex-col gap-5 px-3 pb-4 pt-2 sm:px-5 md:px-6 md:pt-3">
        <div className="space-y-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 cursor-pointer gap-1.5 text-muted-foreground transition-colors duration-200"
          >
            <Link href="/assets/non-it/inventory">
              <ArrowLeft className="size-4" aria-hidden />
              Back to inventory
            </Link>
          </Button>
          <PageHeader
            title="Add Non-IT asset"
            description="Pick a type to unlock details. Code is reserved at save."
          />
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-1 flex-col gap-5">
          <div className="flex flex-1 flex-col gap-5">
          {/* Type + provisional code — full width hero strip */}
          <Card className="overflow-hidden border-border/70 bg-background/90 shadow-md backdrop-blur-sm">
            <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.8fr)] md:items-end md:p-6">
              <div className="space-y-2">
                <label
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  htmlFor="nonit-add-type"
                >
                  Asset type
                </label>
                <select
                  id="nonit-add-type"
                  className="flex h-11 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-base font-medium shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={assetTypeId}
                  onChange={(e) => {
                    setAssetTypeId(e.target.value);
                    setTarget({ employee_id: null, location_id: null });
                    setError(null);
                  }}
                  required
                >
                  <option value="">Select type…</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.prefix})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Assignment mode follows the type
                  {selectedType ? (
                    <>
                      {" "}
                      · <span className="font-medium text-foreground">{selectedType.assignment_mode}</span>
                    </>
                  ) : null}
                </p>
              </div>

              <div
                className={cn(
                  "rounded-xl border px-4 py-3 transition-colors duration-200",
                  selectedType
                    ? "border-sky-200/80 bg-gradient-to-br from-sky-50 to-slate-50"
                    : "border-dashed border-border bg-muted/20",
                )}
                data-testid="nonit-code-preview"
              >
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Hash className="size-3.5" aria-hidden />
                  Next code
                </div>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {!selectedType
                    ? "—"
                    : codePreviewLoading
                      ? "…"
                      : (codePreview ?? `${selectedType.prefix}…`)}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  {selectedType
                    ? "Provisional — locked at save if others create concurrently."
                    : "Select a type to preview the next code."}
                </p>
              </div>
            </CardContent>
          </Card>

          {selectedType ? (
            <>
              <div
                className={cn(
                  "grid gap-5",
                  intent === "assign" ? "lg:grid-cols-2" : "lg:grid-cols-1 lg:max-w-3xl",
                )}
              >
                <Card className="border-border/70 bg-background/90 shadow-md backdrop-blur-sm">
                  <CardHeader className="border-b border-border/50 pb-3 pt-5">
                    <CardTitle className="text-sm font-semibold tracking-tight">
                      Asset details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5 p-5 md:p-6">
                    <div className="space-y-2" role="group" aria-label="Create intent">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Starting state
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          disabled={busy}
                          className={cn(
                            "flex cursor-pointer flex-col items-start gap-1.5 rounded-xl border px-4 py-4 text-left transition-[border-color,box-shadow,background-color] duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            intent === "stock"
                              ? "border-sky-400/70 bg-sky-50/80 shadow-sm ring-1 ring-sky-200/60"
                              : "border-border bg-background hover:border-slate-300 hover:bg-muted/30",
                          )}
                          onClick={() => {
                            setIntent("stock");
                            setTarget({ employee_id: null, location_id: null });
                          }}
                        >
                          <span className="flex size-8 items-center justify-center rounded-lg bg-sky-100/80 text-sky-800">
                            <Package className="size-4" aria-hidden />
                          </span>
                          <span className="text-sm font-semibold">Add to Stock</span>
                          <span className="text-xs leading-snug text-muted-foreground">
                            In Stock · no holder yet
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className={cn(
                            "flex cursor-pointer flex-col items-start gap-1.5 rounded-xl border px-4 py-4 text-left transition-[border-color,box-shadow,background-color] duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            intent === "assign"
                              ? "border-emerald-400/70 bg-emerald-50/80 shadow-sm ring-1 ring-emerald-200/60"
                              : "border-border bg-background hover:border-slate-300 hover:bg-muted/30",
                          )}
                          onClick={() => setIntent("assign")}
                        >
                          <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-800">
                            <UserCheck className="size-4" aria-hidden />
                          </span>
                          <span className="text-sm font-semibold">Assign Now</span>
                          <span className="text-xs leading-snug text-muted-foreground">
                            Assigned · employee or location
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label
                          className="text-xs font-medium text-muted-foreground"
                          htmlFor="nonit-add-purchase"
                        >
                          Purchase date
                        </label>
                        <Input
                          id="nonit-add-purchase"
                          type="date"
                          className="h-10"
                          value={purchaseDate}
                          onChange={(e) => setPurchaseDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <label
                          className="text-xs font-medium text-muted-foreground"
                          htmlFor="nonit-add-remarks"
                        >
                          Remarks
                        </label>
                        <Input
                          id="nonit-add-remarks"
                          className="h-10"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Optional notes"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {intent === "assign" ? (
                  <Card className="border-border/70 bg-background/90 shadow-md backdrop-blur-sm">
                    <CardHeader className="border-b border-border/50 pb-3 pt-5">
                      <CardTitle className="text-sm font-semibold tracking-tight">
                        Assignment
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 md:p-6">
                      <NonItAssignmentPicker
                        assignmentMode={selectedType.assignment_mode}
                        value={target}
                        onChange={setTarget}
                        disabled={busy}
                        suggestionsPlacement="up"
                      />
                    </CardContent>
                  </Card>
                ) : null}
              </div>

              {error ? (
                <p
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </>
          ) : (
            <Card className="border-dashed border-border/80 bg-background/60 py-12 text-center shadow-none backdrop-blur-sm">
              <CardContent>
                <p className="text-sm font-medium text-foreground">Select an asset type to continue</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Details, stock vs assign, and optional holder appear after you choose a type.
                </p>
              </CardContent>
            </Card>
          )}
          </div>

          {/* Footer actions — in-flow, pinned to bottom of content column (never overlaps sidebar) */}
          <div className="mt-auto border-t border-border/60 bg-background/80 pt-4 backdrop-blur-sm">
            <div className="flex min-h-12 w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm">
              <p className="hidden min-w-0 flex-1 truncate text-xs leading-none text-muted-foreground sm:block">
                {selectedType
                  ? intent === "assign"
                    ? "Will create as Assigned"
                    : "Will create as In Stock"
                  : "Choose a type to enable create"}
              </p>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={busy}
                  onClick={() => router.push("/assets/non-it/inventory")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="min-w-[8.5rem] cursor-pointer transition-colors duration-200"
                  disabled={busy || !selectedType}
                >
                  {busy ? "Creating…" : "Create Asset"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
