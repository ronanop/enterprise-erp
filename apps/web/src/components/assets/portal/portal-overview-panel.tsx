"use client";

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Cpu,
  FileText,
  Hash,
  Package,
  Shield,
  ShieldCheck,
  Tag,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  StatusBadge,
  formatPortalOverviewStatus,
  isOperationalStatus,
} from "@/components/assets/shared";
import type { AssetInformationPortal } from "@/services/assets-service";

function dash(value?: string | null): string {
  return value && String(value).trim() ? String(value) : "—";
}

type SpecTone = "sky" | "emerald" | "slate" | "amber" | "violet" | "indigo";

const TONE: Record<
  SpecTone,
  { wrap: string; rail: string; badge: string }
> = {
  sky: {
    wrap: "bg-sky-100 text-sky-700 ring-sky-200",
    rail: "border-sky-500/30",
    badge: "bg-sky-50 text-sky-800 ring-sky-200",
  },
  emerald: {
    wrap: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    rail: "border-emerald-500/30",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  slate: {
    wrap: "bg-slate-100 text-slate-700 ring-slate-200",
    rail: "border-slate-400/40",
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  amber: {
    wrap: "bg-amber-100 text-amber-800 ring-amber-200",
    rail: "border-amber-500/30",
    badge: "bg-amber-50 text-amber-900 ring-amber-200",
  },
  violet: {
    wrap: "bg-violet-100 text-violet-700 ring-violet-200",
    rail: "border-violet-500/30",
    badge: "bg-violet-50 text-violet-800 ring-violet-200",
  },
  indigo: {
    wrap: "bg-indigo-100 text-indigo-700 ring-indigo-200",
    rail: "border-indigo-500/30",
    badge: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  },
};

function SpecTile({
  label,
  value,
  icon: Icon,
  tone = "slate",
  mono,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: SpecTone;
  mono?: boolean;
}) {
  const style = TONE[tone];
  return (
    <div
      className={`rounded-xl border bg-card/80 px-3.5 py-3 shadow-sm transition-colors duration-200 hover:bg-card ${style.rail}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ${style.wrap}`}
        >
          <Icon className="size-3.5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div
            className={`mt-0.5 truncate text-sm font-medium text-foreground ${
              mono ? "font-mono text-xs" : ""
            }`}
            title={value}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPanel({
  title,
  stage,
  icon: Icon,
  tone,
  children,
  empty,
  emptyLabel,
  testId,
}: {
  title: string;
  stage: string;
  icon: LucideIcon;
  tone: SpecTone;
  children?: ReactNode;
  empty?: boolean;
  emptyLabel: string;
  testId?: string;
}) {
  const style = TONE[tone];
  return (
    <section
      className={`rounded-xl border bg-card/80 px-3.5 py-3.5 shadow-sm transition-colors duration-200 hover:bg-card ${style.rail}`}
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ${style.wrap}`}
        >
          <Icon className="size-3.5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${style.badge}`}
            >
              {stage}
            </span>
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
          </div>
          {empty ? (
            <p className="text-xs text-muted-foreground">{emptyLabel}</p>
          ) : (
            children
          )}
        </div>
      </div>
    </section>
  );
}

function MetaPair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={`mt-0.5 truncate text-xs font-medium text-foreground ${mono ? "font-mono" : ""}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function OverviewStatusBadge({
  operationalStatus,
  lifecycleStatus,
}: {
  operationalStatus?: string | null;
  lifecycleStatus?: string | null;
}) {
  const label = formatPortalOverviewStatus({
    operational_status: operationalStatus,
    status: lifecycleStatus,
  });
  const opsKey = String(operationalStatus ?? "")
    .trim()
    .replace(/-/g, "_")
    .toUpperCase();
  return (
    <div data-testid="portal-overview-status" className="flex items-center gap-2">
      {label === "—" ? (
        <span className="text-sm text-muted-foreground">—</span>
      ) : isOperationalStatus(opsKey) ? (
        <StatusBadge kind="operational" status={opsKey} />
      ) : (
        <Badge variant="secondary" className="text-xs">
          {label}
        </Badge>
      )}
    </div>
  );
}

type Props = {
  portal: AssetInformationPortal;
};

export function PortalOverviewPanel({ portal }: Props) {
  const category =
    portal.category_code
      ? `${portal.category_code}${portal.category_name ? ` — ${portal.category_name}` : ""}`
      : dash(portal.category_name);

  return (
    <div className="space-y-4" data-testid="portal-overview-panel">
      {/* Hero identity */}
      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border/60 bg-gradient-to-br from-slate-50 via-white to-sky-50/40 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  Overview
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {portal.asset_code}
                </span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {dash(portal.asset_name)}
              </h2>
              <p className="text-xs text-muted-foreground">
                Current register snapshot — identity, custody, and coverage at a glance.
              </p>
            </div>
            <OverviewStatusBadge
              operationalStatus={portal.operational_status}
              lifecycleStatus={portal.status}
            />
          </div>
        </div>

        <div className="grid gap-2.5 p-4 sm:grid-cols-2 sm:p-5">
          <SpecTile
            label="Asset code"
            value={dash(portal.asset_code)}
            icon={Hash}
            tone="emerald"
            mono
          />
          <SpecTile
            label="Serial number"
            value={dash(portal.serial_number)}
            icon={Cpu}
            tone="indigo"
            mono
          />
          <SpecTile label="Type" value={dash(portal.asset_type)} icon={Tag} tone="slate" />
          <SpecTile label="Category" value={category} icon={Package} tone="violet" />
          <SpecTile
            label="Manufacturer"
            value={dash(portal.manufacturer)}
            icon={Building2}
            tone="sky"
          />
          <SpecTile label="Model" value={dash(portal.model)} icon={FileText} tone="amber" />
        </div>
      </section>

      {/* Custody + coverage */}
      <div className="space-y-3">
        <StatusPanel
          title="Assignment"
          stage={portal.assignment ? "Active" : "Unassigned"}
          icon={UserRound}
          tone={portal.assignment ? "sky" : "slate"}
          empty={!portal.assignment}
          emptyLabel="No active assignment — asset is not currently issued to a user."
          testId="portal-overview-assignment"
        >
          {portal.assignment ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              <MetaPair label="Assignee" value={dash(portal.assignment.assignee_label)} />
              <MetaPair label="Allocation" value={dash(portal.assignment.allocation_type)} />
              <MetaPair
                label="Document"
                value={dash(portal.assignment.document_number)}
                mono
              />
              <MetaPair label="Status" value={dash(portal.assignment.status)} />
            </dl>
          ) : null}
        </StatusPanel>

        <div className="grid gap-3 md:grid-cols-2">
          <StatusPanel
            title="Warranty"
            stage={portal.warranty ? "Covered" : "None"}
            icon={Shield}
            tone={portal.warranty ? "emerald" : "slate"}
            empty={!portal.warranty}
            emptyLabel="No open warranty on record for this asset."
            testId="portal-overview-warranty"
          >
            {portal.warranty ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                <MetaPair label="Type" value={dash(portal.warranty.warranty_type)} />
                <MetaPair label="Status" value={dash(portal.warranty.status)} />
                <MetaPair label="Start" value={dash(portal.warranty.start_date)} />
                <MetaPair label="End" value={dash(portal.warranty.end_date)} />
              </dl>
            ) : null}
          </StatusPanel>

          <StatusPanel
            title="Insurance"
            stage={portal.insurance ? "Active policy" : "None"}
            icon={ShieldCheck}
            tone={portal.insurance ? "indigo" : "slate"}
            empty={!portal.insurance}
            emptyLabel="No open insurance policy on record for this asset."
            testId="portal-overview-insurance"
          >
            {portal.insurance ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                <MetaPair label="Policy" value={dash(portal.insurance.policy_number)} mono />
                <MetaPair label="Insurer" value={dash(portal.insurance.insurer_name)} />
                <MetaPair label="Status" value={dash(portal.insurance.status)} />
                <MetaPair label="End" value={dash(portal.insurance.end_date)} />
              </dl>
            ) : null}
          </StatusPanel>
        </div>
      </div>
    </div>
  );
}
