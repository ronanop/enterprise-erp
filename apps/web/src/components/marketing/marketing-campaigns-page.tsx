"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Megaphone, Plus, RefreshCw, X } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { MarketingSignedInProfile } from "@/components/marketing/marketing-signed-in-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canViewAllModuleScreens } from "@/lib/module-access";
import { formatApiError } from "@/services/api-client";
import {
  createCampaignDeliverable,
  createMarketingCampaign,
  listCampaignDeliverables,
  listMarketingCampaigns,
  listMarketingTeamMembers,
  type MarketingCampaign,
  type MarketingCampaignDeliverable,
  type MarketingTeamMember,
} from "@/services/marketing-service";

const CAMPAIGN_TYPES = [
  { value: "social", label: "Social" },
  { value: "email", label: "Email" },
  { value: "paid", label: "Paid" },
  { value: "event", label: "Event" },
  { value: "content", label: "Content" },
  { value: "other", label: "Other" },
] as const;

const PRESET_DELIVERABLE_TYPES = [
  { value: "brochure", label: "Brochure" },
  { value: "video", label: "Video" },
  { value: "social_media_post", label: "Social media post" },
  { value: "email", label: "Email" },
  { value: "blog", label: "Blog" },
  { value: "presentation", label: "Presentation" },
  { value: "infographic", label: "Infographic" },
  { value: "landing_page", label: "Landing page" },
] as const;

const CUSTOM_TYPE_VALUE = "__custom__";

const CONTENT_PROVIDER_ROLES = new Set(["content_creator"]);
const APPROVAL_HEAD_ROLES = new Set(["approval_head"]);
const EDITOR_ROLES = new Set(["video_editor", "graphic_designer", "supporting_member"]);

function roleLabel(role: string): string {
  return role.replaceAll("_", " ");
}

function memberOptionLabel(member: MarketingTeamMember): string {
  return `${member.display_name} (${roleLabel(member.role)})`;
}

function canManageCampaignDeliverables(
  moduleRoles: Record<string, string>,
  adminModuleKeys: string[],
  userType?: string,
): boolean {
  if (canViewAllModuleScreens("marketing", adminModuleKeys, userType, moduleRoles)) return true;
  return moduleRoles.marketing === "marketing_head";
}

function formatDeliverableType(value: string): string {
  return value.replaceAll("_", " ");
}

function slugDeliverableType(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function MarketingCampaignsPage() {
  const { user, moduleRoles, adminModuleKeys, loading: authLoading } = useAuthUser();
  const canCreate = canManageCampaignDeliverables(moduleRoles, adminModuleKeys, user?.userType);

  const [rows, setRows] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [campaignType, setCampaignType] = useState("social");
  const [objective, setObjective] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [openCampaign, setOpenCampaign] = useState<MarketingCampaign | null>(null);
  const [deliverables, setDeliverables] = useState<MarketingCampaignDeliverable[]>([]);
  const [deliverablesLoading, setDeliverablesLoading] = useState(false);
  const [deliverablesError, setDeliverablesError] = useState<string | null>(null);
  const [showAddDeliverable, setShowAddDeliverable] = useState(false);
  const [deliverableType, setDeliverableType] = useState<string>(PRESET_DELIVERABLE_TYPES[0].value);
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [extraTypes, setExtraTypes] = useState<Array<{ value: string; label: string }>>([]);
  const [dueDate, setDueDate] = useState("");
  const [deliverableTitle, setDeliverableTitle] = useState("");
  const [deliverableNotes, setDeliverableNotes] = useState("");
  const [savingDeliverable, setSavingDeliverable] = useState(false);
  const [deliverableFormError, setDeliverableFormError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<MarketingTeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [contentProviderId, setContentProviderId] = useState("");
  const [approvalHeadId, setApprovalHeadId] = useState("");
  const [editorId, setEditorId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listMarketingCampaigns());
    } catch (err) {
      setRows([]);
      setError(formatApiError(err, "Failed to load campaigns"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDeliverables = useCallback(async (campaignId: string) => {
    setDeliverablesLoading(true);
    setDeliverablesError(null);
    try {
      const items = await listCampaignDeliverables(campaignId);
      setDeliverables(items);
      setExtraTypes((prev) => {
        const known = new Set<string>([
          ...PRESET_DELIVERABLE_TYPES.map((t) => t.value),
          ...prev.map((t) => t.value),
        ]);
        const discovered: Array<{ value: string; label: string }> = [];
        for (const item of items) {
          const value = item.deliverable_type;
          if (!value || known.has(value)) continue;
          known.add(value);
          discovered.push({ value, label: formatDeliverableType(value) });
        }
        return discovered.length > 0 ? [...prev, ...discovered] : prev;
      });
    } catch (err) {
      setDeliverables([]);
      setDeliverablesError(formatApiError(err, "Failed to load deliverables"));
    } finally {
      setDeliverablesLoading(false);
    }
  }, []);

  const loadTeamMembers = useCallback(async () => {
    if (!canCreate) return;
    setTeamLoading(true);
    try {
      setTeamMembers(await listMarketingTeamMembers());
    } catch {
      setTeamMembers([]);
    } finally {
      setTeamLoading(false);
    }
  }, [canCreate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (canCreate && !authLoading) {
      void loadTeamMembers();
    }
  }, [authLoading, canCreate, loadTeamMembers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.campaign_name.toLowerCase().includes(q) ||
        row.campaign_code.toLowerCase().includes(q) ||
        row.campaign_type.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const typeOptions = useMemo(
    () => [...PRESET_DELIVERABLE_TYPES, ...extraTypes],
    [extraTypes],
  );

  const contentProviders = useMemo(
    () => teamMembers.filter((m) => CONTENT_PROVIDER_ROLES.has(m.role)),
    [teamMembers],
  );
  const approvalHeads = useMemo(
    () => teamMembers.filter((m) => APPROVAL_HEAD_ROLES.has(m.role)),
    [teamMembers],
  );
  const editors = useMemo(
    () => teamMembers.filter((m) => EDITOR_ROLES.has(m.role)),
    [teamMembers],
  );

  async function submitCreate() {
    const campaignName = name.trim();
    if (!campaignName) {
      setFormError("Campaign name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    setError(null);
    try {
      await createMarketingCampaign({
        campaign_name: campaignName,
        campaign_type: campaignType,
        objective: objective.trim() || undefined,
      });
      setName("");
      setObjective("");
      setCampaignType("social");
      setShowCreate(false);
      await load();
    } catch (err) {
      setFormError(formatApiError(err, "Could not create campaign"));
    } finally {
      setSaving(false);
    }
  }

  async function openCampaignDeliverables(campaign: MarketingCampaign) {
    setOpenCampaign(campaign);
    setShowAddDeliverable(false);
    setDeliverableFormError(null);
    setDeliverableType(PRESET_DELIVERABLE_TYPES[0].value);
    setCustomTypeLabel("");
    setDueDate("");
    setDeliverableTitle("");
    setDeliverableNotes("");
    setContentProviderId("");
    setApprovalHeadId("");
    setEditorId("");
    await loadDeliverables(campaign.id);
  }

  function closeDeliverables() {
    setOpenCampaign(null);
    setDeliverables([]);
    setDeliverablesError(null);
    setShowAddDeliverable(false);
  }

  function addCustomTypeOption() {
    const slug = slugDeliverableType(customTypeLabel);
    if (!slug) {
      setDeliverableFormError("Enter a custom deliverable type.");
      return;
    }
    const label = customTypeLabel.trim();
    setExtraTypes((prev) => {
      if (prev.some((t) => t.value === slug)) return prev;
      if (PRESET_DELIVERABLE_TYPES.some((t) => t.value === slug)) return prev;
      return [...prev, { value: slug, label }];
    });
    setDeliverableType(slug);
    setCustomTypeLabel("");
    setDeliverableFormError(null);
  }

  async function submitDeliverable() {
    if (!openCampaign) return;

    let typeValue = deliverableType;
    if (typeValue === CUSTOM_TYPE_VALUE) {
      const slug = slugDeliverableType(customTypeLabel);
      if (!slug) {
        setDeliverableFormError("Enter a custom deliverable type.");
        return;
      }
      typeValue = slug;
      setExtraTypes((prev) => {
        if (prev.some((t) => t.value === slug)) return prev;
        if (PRESET_DELIVERABLE_TYPES.some((t) => t.value === slug)) return prev;
        return [...prev, { value: slug, label: customTypeLabel.trim() }];
      });
    }

    if (!dueDate) {
      setDeliverableFormError("Submission due date is required.");
      return;
    }
    if (!contentProviderId) {
      setDeliverableFormError("Select a content provider.");
      return;
    }
    if (!approvalHeadId) {
      setDeliverableFormError("Select an approval head.");
      return;
    }
    if (!editorId) {
      setDeliverableFormError("Select an editor.");
      return;
    }

    setSavingDeliverable(true);
    setDeliverableFormError(null);
    try {
      await createCampaignDeliverable(openCampaign.id, {
        deliverable_type: typeValue,
        due_date: dueDate,
        title: deliverableTitle.trim() || undefined,
        notes: deliverableNotes.trim() || undefined,
        content_provider_user_id: contentProviderId,
        approval_head_user_id: approvalHeadId,
        editor_user_id: editorId,
      });
      setShowAddDeliverable(false);
      setDeliverableType(PRESET_DELIVERABLE_TYPES[0].value);
      setCustomTypeLabel("");
      setDueDate("");
      setDeliverableTitle("");
      setDeliverableNotes("");
      setContentProviderId("");
      setApprovalHeadId("");
      setEditorId("");
      await loadDeliverables(openCampaign.id);
    } catch (err) {
      setDeliverableFormError(formatApiError(err, "Could not add deliverable"));
    } finally {
      setSavingDeliverable(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Campaigns"
        description="Plan and track marketing campaigns. Only Marketing head and module admins can create campaigns."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MarketingSignedInProfile />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </Button>
            {canCreate && !authLoading ? (
              <Button
                type="button"
                size="sm"
                className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
                onClick={() => {
                  setFormError(null);
                  setShowCreate((v) => !v);
                }}
              >
                <Plus className="size-3.5" aria-hidden />
                Create campaign
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!canCreate && !authLoading ? (
        <p className="text-[12px] text-muted-foreground">
          You can view campaigns. Creating new campaigns requires Marketing head or module admin access.
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Megaphone className="size-4" aria-hidden />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Records</p>
                <Badge variant="secondary" className="font-normal tabular-nums">
                  {loading ? "…" : `${filtered.length} shown`}
                </Badge>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Live data from{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/marketing/campaigns</code>
              </p>
            </div>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter campaigns…"
            className="h-9 w-full max-w-xs border-border/80 bg-background transition-colors duration-200"
            aria-label="Filter campaigns"
          />
        </div>

        {showCreate && canCreate ? (
          <div className="space-y-3 border-b border-border/70 bg-muted/15 px-4 py-3 sm:px-5">
            <p className="text-[12px] font-medium text-foreground">New campaign</p>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Campaign name"
                className="h-9"
                disabled={saving}
                aria-label="Campaign name"
              />
              <select
                value={campaignType}
                onChange={(e) => setCampaignType(e.target.value)}
                disabled={saving}
                className="h-9 cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200"
                aria-label="Campaign type"
              >
                {CAMPAIGN_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Input
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Objective (optional)"
                className="h-9 md:col-span-2 lg:col-span-1"
                disabled={saving}
                aria-label="Campaign objective"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
                disabled={saving}
                onClick={() => void submitCreate()}
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                {saving ? "Creating…" : "Save campaign"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 cursor-pointer transition-colors duration-200"
                disabled={saving}
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
            </div>
            {formError ? <p className="text-[12px] text-destructive">{formError}</p> : null}
          </div>
        ) : null}

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Campaign</th>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Start</th>
                <th className="px-4 py-2.5">End</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Loading campaigns…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {query.trim()
                      ? "No campaigns match your filter."
                      : canCreate
                        ? "No campaigns yet. Create the first one."
                        : "No campaigns yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const isOpen = openCampaign?.id === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30 ${
                        isOpen ? "bg-accent/20" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        <Link
                          href={`/marketing/campaigns/${row.id}`}
                          className="cursor-pointer underline-offset-2 transition-colors duration-200 hover:underline"
                        >
                          {row.campaign_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.campaign_code}</td>
                      <td className="px-4 py-2.5 capitalize text-muted-foreground">
                        {row.campaign_type.replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-2.5">
                        <FinanceStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.start_date ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.end_date ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={isOpen ? "secondary" : "outline"}
                          className="h-8 cursor-pointer px-3 transition-colors duration-200"
                          onClick={() => {
                            if (isOpen) {
                              closeDeliverables();
                              return;
                            }
                            void openCampaignDeliverables(row);
                          }}
                        >
                          {isOpen ? "Close" : "Open"}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {openCampaign ? (
        <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  Deliverables — {openCampaign.campaign_name}
                </p>
                <Badge variant="secondary" className="font-normal tabular-nums">
                  {deliverablesLoading ? "…" : `${deliverables.length} items`}
                </Badge>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Work items to submit for this campaign, with due dates.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
                disabled={deliverablesLoading}
                onClick={() => void loadDeliverables(openCampaign.id)}
              >
                <RefreshCw
                  className={`size-3.5 ${deliverablesLoading ? "animate-spin" : ""}`}
                  aria-hidden
                />
                Refresh
              </Button>
              {canCreate && !authLoading ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
                  onClick={() => {
                    setDeliverableFormError(null);
                    setShowAddDeliverable((v) => !v);
                  }}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add deliverable
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
                onClick={closeDeliverables}
              >
                <X className="size-3.5" aria-hidden />
                Close
              </Button>
            </div>
          </div>

          {deliverablesError ? (
            <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {deliverablesError}
            </div>
          ) : null}

          {showAddDeliverable && canCreate ? (
            <div className="space-y-3 border-b border-border/70 bg-muted/15 px-4 py-3 sm:px-5">
              <p className="text-[12px] font-medium text-foreground">New deliverable</p>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                <select
                  value={
                    typeOptions.some((t) => t.value === deliverableType)
                      ? deliverableType
                      : CUSTOM_TYPE_VALUE
                  }
                  onChange={(e) => {
                    setDeliverableType(e.target.value);
                    setDeliverableFormError(null);
                  }}
                  disabled={savingDeliverable}
                  className="h-9 cursor-pointer rounded-md border border-input bg-background px-3 text-sm capitalize transition-colors duration-200"
                  aria-label="Deliverable type"
                >
                  {typeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  <option value={CUSTOM_TYPE_VALUE}>Custom type…</option>
                </select>
                {deliverableType === CUSTOM_TYPE_VALUE ? (
                  <div className="flex gap-2 md:col-span-1">
                    <Input
                      value={customTypeLabel}
                      onChange={(e) => setCustomTypeLabel(e.target.value)}
                      placeholder="e.g. Press kit"
                      className="h-9"
                      disabled={savingDeliverable}
                      aria-label="Custom deliverable type"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0 cursor-pointer transition-colors duration-200"
                      disabled={savingDeliverable}
                      onClick={addCustomTypeOption}
                    >
                      Add type
                    </Button>
                  </div>
                ) : null}
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9"
                  disabled={savingDeliverable}
                  aria-label="Submission due date"
                />
                <Input
                  value={deliverableTitle}
                  onChange={(e) => setDeliverableTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="h-9"
                  disabled={savingDeliverable}
                  aria-label="Deliverable title"
                />
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Content provider
                  </span>
                  <select
                    value={contentProviderId}
                    onChange={(e) => setContentProviderId(e.target.value)}
                    disabled={savingDeliverable || teamLoading}
                    className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200"
                    aria-label="Content provider"
                  >
                    <option value="">
                      {teamLoading
                        ? "Loading…"
                        : contentProviders.length === 0
                          ? "No content creators"
                          : "Select content provider"}
                    </option>
                    {contentProviders.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {memberOptionLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Approval head
                  </span>
                  <select
                    value={approvalHeadId}
                    onChange={(e) => setApprovalHeadId(e.target.value)}
                    disabled={savingDeliverable || teamLoading}
                    className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200"
                    aria-label="Approval head"
                  >
                    <option value="">
                      {teamLoading
                        ? "Loading…"
                        : approvalHeads.length === 0
                          ? "No approval heads"
                          : "Select approval head"}
                    </option>
                    {approvalHeads.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {memberOptionLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Editor
                  </span>
                  <select
                    value={editorId}
                    onChange={(e) => setEditorId(e.target.value)}
                    disabled={savingDeliverable || teamLoading}
                    className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200"
                    aria-label="Editor"
                  >
                    <option value="">
                      {teamLoading
                        ? "Loading…"
                        : editors.length === 0
                          ? "No editors / supporting members"
                          : "Select editor"}
                    </option>
                    {editors.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {memberOptionLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Input
                value={deliverableNotes}
                onChange={(e) => setDeliverableNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="h-9"
                disabled={savingDeliverable}
                aria-label="Deliverable notes"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
                  disabled={savingDeliverable || teamLoading}
                  onClick={() => void submitDeliverable()}
                >
                  {savingDeliverable ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : null}
                  {savingDeliverable ? "Saving…" : "Save deliverable"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 cursor-pointer transition-colors duration-200"
                  disabled={savingDeliverable}
                  onClick={() => setShowAddDeliverable(false)}
                >
                  Cancel
                </Button>
              </div>
              {deliverableFormError ? (
                <p className="text-[12px] text-destructive">{deliverableFormError}</p>
              ) : null}
            </div>
          ) : null}

          {!canCreate && !authLoading ? (
            <p className="border-b border-border/60 px-4 py-2 text-[12px] text-muted-foreground sm:px-5">
              Only Marketing head or module admin can add deliverables.
            </p>
          ) : null}

          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  <th className="px-4 py-2.5">Deliverable</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Content</th>
                  <th className="px-4 py-2.5">Approval</th>
                  <th className="px-4 py-2.5">Editor</th>
                  <th className="px-4 py-2.5">Due</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {deliverablesLoading && deliverables.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      Loading deliverables…
                    </td>
                  </tr>
                ) : deliverables.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      {canCreate
                        ? "No deliverables yet. Add brochure, video, social posts, or a custom type."
                        : "No deliverables assigned to this campaign yet."}
                    </td>
                  </tr>
                ) : (
                  deliverables.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">{item.title}</td>
                      <td className="px-4 py-2.5 capitalize text-muted-foreground">
                        {formatDeliverableType(item.deliverable_type)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {item.content_provider_name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {item.approval_head_name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {item.editor_name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {item.due_date ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <FinanceStatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
