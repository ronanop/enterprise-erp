"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Download,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Shield,
  Target,
  Users,
} from "lucide-react";

import {
  AppraisalCreateDrawer,
  CycleDrawer,
  FeedbackDrawer,
  GoalDrawer,
  KpiDrawer,
  MeetingDrawer,
  OkrDrawer,
  PipDrawer,
  ProbationDrawer,
  ReviewDrawer,
} from "@/components/hr/performance/performance-drawers";
import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
  HrToolbar,
  HrUnderlineTabs,
  type HrTabItem,
} from "@/components/hr/hr-primitives";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  advanceAppraisal,
  computePerformanceStats,
  createAppraisal,
  createCycle,
  createGoal,
  createKpi,
  createOkr,
  createProbation,
  createReview,
  downloadTextFile,
  exportGoalsCsv,
  filterGoals,
  giveFeedback,
  goalCompletionByDept,
  listPmsAudit,
  loadPerformanceDirectory,
  performanceDistribution,
  scheduleOneOnOne,
  startPip,
  updateGoalProgress,
  updateProbation,
  updateReview,
  type PerformanceDirectory,
} from "@/services/performance-management-service";
import type { PerformanceFilters } from "@/types/performance-management";
import {
  emptyPerformanceFilters,
  GOAL_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
} from "@/types/performance-management";

const PAGE = 10;

type Tab =
  | "dashboard"
  | "goals"
  | "kpis"
  | "okrs"
  | "cycles"
  | "reviews"
  | "feedback"
  | "meetings"
  | "probation"
  | "pip"
  | "appraisals"
  | "reports"
  | "audit";

export function PerformanceManagementPage() {
  const [dir, setDir] = useState<PerformanceDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [filters, setFilters] = useState<PerformanceFilters>(() => emptyPerformanceFilters());
  const [page, setPage] = useState(1);

  const [goalOpen, setGoalOpen] = useState(false);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [okrOpen, setOkrOpen] = useState(false);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [probationOpen, setProbationOpen] = useState(false);
  const [appraisalOpen, setAppraisalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDir(await loadPerformanceDirectory());
    } catch {
      toast("Failed to load performance data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => setPage(1), [filters, tab]);

  const stats = useMemo(() => (dir ? computePerformanceStats(dir) : null), [dir]);
  const goals = useMemo(() => filterGoals(dir?.goals ?? [], filters), [dir, filters]);
  const pageGoals = useMemo(() => {
    const s = (page - 1) * PAGE;
    return goals.slice(s, s + PAGE);
  }, [goals, page]);
  const audit = useMemo(() => listPmsAudit(), [dir, tab]);
  const distribution = useMemo(
    () => performanceDistribution(dir?.reviews ?? []),
    [dir],
  );
  const deptGoals = useMemo(() => goalCompletionByDept(dir?.goals ?? []), [dir]);
  const authBlocked =
    !isAuthenticated() && !loading && !(dir?.goals.length || dir?.reviews.length);

  const maxDist = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Performance Management"
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button size="sm" className="cursor-pointer" onClick={() => setCycleOpen(true)}>
              <Plus className="size-3.5" />
              Create Review Cycle
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setGoalOpen(true)}>
              <Target className="size-3.5" />
              Assign Goals
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setKpiOpen(true)}>
              Create KPI
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setReviewOpen(true)}>
              <ClipboardList className="size-3.5" />
              Start Appraisal
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                downloadTextFile(
                  `goals-${new Date().toISOString().slice(0, 10)}.csv`,
                  exportGoalsCsv(goals),
                );
                toast("Exported");
              }}
            >
              <Download className="size-3.5" />
              Export
            </Button>
          </HrToolbar>
        }
      />

      {authBlocked ? <HrAuthBanner /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {[
          { label: "Active Review Cycles", value: stats?.activeCycles ?? 0 },
          { label: "Goals Assigned", value: stats?.goalsAssigned ?? 0 },
          { label: "Goals Completed", value: stats?.goalsCompleted ?? 0 },
          { label: "Pending Reviews", value: stats?.pendingReviews ?? 0 },
          { label: "Completed Reviews", value: stats?.completedReviews ?? 0 },
          { label: "High Performers", value: stats?.highPerformers ?? 0 },
          { label: "Employees on PIP", value: stats?.onPip ?? 0 },
          { label: "Upcoming Reviews", value: stats?.upcomingReviews ?? 0 },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-border/70 bg-card px-3 py-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
          >
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {k.label}
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight">{k.value}</p>
          </div>
        ))}
      </div>

      <HrUnderlineTabs
        size="sm"
        tabs={
          [
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "goals", label: "Goals", icon: Target },
            { id: "kpis", label: "KPIs", icon: BarChart3 },
            { id: "okrs", label: "OKRs", icon: Target },
            { id: "cycles", label: "Review Cycles", icon: CalendarDays },
            { id: "reviews", label: "Reviews", icon: ClipboardList },
            { id: "feedback", label: "Feedback", icon: MessageSquare },
            { id: "meetings", label: "1:1s", icon: Users },
            { id: "probation", label: "Probation", icon: Shield },
            { id: "pip", label: "PIP", icon: AlertTriangle },
            { id: "appraisals", label: "Appraisals", icon: ClipboardList },
            { id: "reports", label: "Reports", icon: BarChart3 },
            { id: "audit", label: "Audit", icon: Shield },
          ] satisfies HrTabItem[]
        }
        value={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {loading && !dir ? <EmsSkeleton /> : null}

      {(tab === "goals" || tab === "reviews") && (
        <Input
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          placeholder="Search…"
          className="max-w-xs"
        />
      )}

      {tab === "dashboard" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Performance distribution (1–5)
            </p>
            <div className="flex h-36 items-end gap-2">
              {distribution.map((d) => (
                <div key={d.rating} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-primary/80 transition-all duration-300"
                    style={{ height: `${(d.count / maxDist) * 100}%`, minHeight: d.count ? 8 : 2 }}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.rating}★</span>
                  <span className="text-[10px] font-medium">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Goal completion by department
            </p>
            <div className="space-y-2">
              {deptGoals.length === 0 ? (
                <p className="text-xs text-muted-foreground">No goals yet.</p>
              ) : (
                deptGoals.map((d) => (
                  <div key={d.department} className="text-xs">
                    <div className="mb-1 flex justify-between">
                      <span>{d.department}</span>
                      <span>
                        {d.done}/{d.total} · {d.pct}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${d.pct}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:col-span-2">
            <QuickBtn icon={Target} label="Assign goals" onClick={() => setGoalOpen(true)} />
            <QuickBtn icon={MessageSquare} label="Give feedback" onClick={() => setFeedbackOpen(true)} />
            <QuickBtn icon={ClipboardList} label="Start review" onClick={() => setReviewOpen(true)} />
            <QuickBtn icon={AlertTriangle} label="Start PIP" onClick={() => setPipOpen(true)} />
          </div>
        </div>
      ) : null}

      {tab === "goals" ? (
        <div className="space-y-2">
          <Button size="sm" className="cursor-pointer" onClick={() => setGoalOpen(true)}>
            + Create Goal
          </Button>
          <TableBlock
            empty="No goals"
            headers={["ID", "Title", "Employee", "Progress", "Status", "Due", ""]}
            rows={pageGoals.map((g) => [
              g.goalCode,
              g.title,
              g.employeeName,
              <div key="p" className="flex min-w-[100px] items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (g.currentProgress / Math.max(1, g.targetValue)) * 100)}%`,
                    }}
                  />
                </div>
                <span>{g.currentProgress}/{g.targetValue}</span>
              </div>,
              <HrStatusBadge key="s" status={GOAL_STATUS_LABELS[g.status]} />,
              g.dueDate || "—",
              <Button
                key="u"
                type="button"
                size="sm"
                variant="outline"
                className="h-7 cursor-pointer"
                onClick={() => {
                  const next = Math.min(g.targetValue, g.currentProgress + 10);
                  updateGoalProgress(g.id, next);
                  toast("Progress updated");
                  void load();
                }}
              >
                +10%
              </Button>,
            ])}
            page={page}
            total={goals.length}
            onPageChange={setPage}
          />
        </div>
      ) : null}

      {tab === "kpis" ? (
        <div className="space-y-2">
          <Button size="sm" className="cursor-pointer" onClick={() => setKpiOpen(true)}>
            + Create KPI
          </Button>
          <TableBlock
            empty="No KPIs"
            headers={["Name", "Dept", "Designation", "Weight", "Target", "Type", "Scale"]}
            rows={(dir?.kpis ?? []).map((k) => [
              k.name,
              k.department,
              k.designation,
              `${k.weightage}%`,
              k.target,
              k.measureType,
              k.ratingScale,
            ])}
            page={1}
            total={dir?.kpis.length ?? 0}
            onPageChange={() => undefined}
          />
        </div>
      ) : null}

      {tab === "okrs" ? (
        <div className="space-y-3">
          <Button size="sm" className="cursor-pointer" onClick={() => setOkrOpen(true)}>
            + Create OKR
          </Button>
          {(dir?.okrs ?? []).length === 0 ? (
            <HrEmptyState title="No OKRs" />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(dir?.okrs ?? []).map((o) => (
                <div key={o.id} className="rounded-xl border border-border/70 bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{o.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {o.owner} · {o.department}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-primary">{o.progressPct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${o.progressPct}%` }}
                    />
                  </div>
                  <ul className="mt-3 space-y-1 text-xs">
                    {o.keyResults.map((kr) => (
                      <li key={kr.id} className="flex justify-between gap-2">
                        <span>{kr.title}</span>
                        <span className="text-muted-foreground">{kr.progressPct}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "cycles" ? (
        <div className="space-y-2">
          <Button size="sm" className="cursor-pointer" onClick={() => setCycleOpen(true)}>
            + Create Review Cycle
          </Button>
          <TableBlock
            empty="No cycles"
            headers={["Name", "Type", "Window", "Dept", "Reporting manager", "Employees", "Status"]}
            rows={(dir?.cycles ?? []).map((c) => [
              c.name,
              c.reviewType,
              `${c.startDate} → ${c.endDate}`,
              c.departments,
              c.manager || "—",
              c.employeeCount,
              <HrStatusBadge key="s" status={c.status} />,
            ])}
            page={1}
            total={dir?.cycles.length ?? 0}
            onPageChange={() => undefined}
          />
        </div>
      ) : null}

      {tab === "reviews" ? (
        <div className="space-y-2">
          <Button size="sm" className="cursor-pointer" onClick={() => setReviewOpen(true)}>
            + Start Review
          </Button>
          <TableBlock
            empty="No reviews"
            headers={["Code", "Employee", "Reporting manager", "Rating", "Recommendation", "Status", ""]}
            rows={(dir?.reviews ?? []).map((r) => [
              r.reviewCode,
              r.employeeName,
              r.managerName,
              r.overallRating || "—",
              r.recommendation,
              <HrStatusBadge key="s" status={REVIEW_STATUS_LABELS[r.status]} />,
              <Button
                key="c"
                type="button"
                size="sm"
                variant="outline"
                className="h-7 cursor-pointer"
                onClick={() => {
                  updateReview(r.id, { status: "completed" });
                  toast("Review completed");
                  void load();
                }}
              >
                Complete
              </Button>,
            ])}
            page={1}
            total={dir?.reviews.length ?? 0}
            onPageChange={() => undefined}
          />
        </div>
      ) : null}

      {tab === "feedback" ? (
        <div className="space-y-2">
          <Button size="sm" className="cursor-pointer" onClick={() => setFeedbackOpen(true)}>
            + Give Feedback
          </Button>
          <TableBlock
            empty="No feedback"
            headers={["Employee", "From", "Type", "Category", "Visibility", "When"]}
            rows={(dir?.feedback ?? []).map((f) => [
              f.employeeName,
              f.fromName,
              f.feedbackType,
              f.category,
              f.visibility,
              new Date(f.createdAt).toLocaleString(),
            ])}
            page={1}
            total={dir?.feedback.length ?? 0}
            onPageChange={() => undefined}
          />
        </div>
      ) : null}

      {tab === "meetings" ? (
        <div className="space-y-2">
          <Button size="sm" className="cursor-pointer" onClick={() => setMeetingOpen(true)}>
            Schedule Meeting
          </Button>
          <TableBlock
            empty="No 1:1s"
            headers={["Employee", "Reporting manager", "Date", "Agenda", "Follow-up"]}
            rows={(dir?.meetings ?? []).map((m) => [
              m.employeeName,
              m.managerName,
              m.meetingDate,
              m.agenda || "—",
              m.followUpDate || "—",
            ])}
            page={1}
            total={dir?.meetings.length ?? 0}
            onPageChange={() => undefined}
          />
        </div>
      ) : null}

      {tab === "probation" ? (
        <div className="space-y-2">
          <Button size="sm" className="cursor-pointer" onClick={() => setProbationOpen(true)}>
            + Probation Case
          </Button>
          <TableBlock
            empty="No probation cases"
            headers={["Employee", "Start", "End", "Review", "Status", ""]}
            rows={(dir?.probation ?? []).map((p) => [
              p.employeeName,
              p.startDate,
              p.endDate,
              p.reviewDate,
              <HrStatusBadge key="s" status={p.status} />,
              <div key="a" className="flex gap-1">
                {(["confirmed", "extended", "terminated"] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 cursor-pointer capitalize"
                    onClick={() => {
                      updateProbation(p.id, { status: s });
                      void load();
                    }}
                  >
                    {s}
                  </Button>
                ))}
              </div>,
            ])}
            page={1}
            total={dir?.probation.length ?? 0}
            onPageChange={() => undefined}
          />
        </div>
      ) : null}

      {tab === "pip" ? (
        <div className="space-y-2">
          <Button size="sm" className="cursor-pointer" onClick={() => setPipOpen(true)}>
            Start PIP
          </Button>
          <TableBlock
            empty="No PIPs"
            headers={["Employee", "Reason", "Duration", "Reporting manager", "Status"]}
            rows={(dir?.pips ?? []).map((p) => [
              p.employeeName,
              p.reason.slice(0, 40),
              `${p.durationDays}d`,
              p.managerName,
              <HrStatusBadge key="s" status={p.status} />,
            ])}
            page={1}
            total={dir?.pips.length ?? 0}
            onPageChange={() => undefined}
          />
        </div>
      ) : null}

      {tab === "appraisals" ? (
        <div className="space-y-2">
          <Button size="sm" className="cursor-pointer" onClick={() => setAppraisalOpen(true)}>
            Start Appraisal
          </Button>
          <TableBlock
            empty="No appraisals"
            headers={["Code", "Employee", "Cycle", "Rating", "Workflow", ""]}
            rows={(dir?.appraisals ?? []).map((a) => [
              a.appraisalCode,
              a.employeeName,
              a.cycleName,
              a.overallRating || "—",
              <span key="w" className="capitalize">
                Reporting manager → HR → Director → {a.workflowStage}
              </span>,
              a.workflowStage !== "approved" && a.workflowStage !== "rejected" ? (
                <Button
                  key="adv"
                  type="button"
                  size="sm"
                  className="h-7 cursor-pointer"
                  onClick={() => {
                    advanceAppraisal(a.id);
                    toast("Workflow advanced");
                    void load();
                  }}
                >
                  Advance
                </Button>
              ) : (
                <HrStatusBadge key="done" status={a.workflowStage} />
              ),
            ])}
            page={1}
            total={dir?.appraisals.length ?? 0}
            onPageChange={() => undefined}
          />
        </div>
      ) : null}

      {tab === "reports" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ReportCard title="Goals Completed" value={String(stats?.goalsCompleted ?? 0)} />
          <ReportCard title="High Performers" value={String(stats?.highPerformers ?? 0)} />
          <ReportCard title="On PIP" value={String(stats?.onPip ?? 0)} />
          <ReportCard title="Pending Reviews" value={String(stats?.pendingReviews ?? 0)} />
          <div className="rounded-xl border border-border/70 bg-card p-4 md:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Radar-style scorecard (sample dimensions)
            </p>
            <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
              {["Delivery", "Quality", "Collaboration", "Leadership", "Learning"].map((dim, i) => {
                const score = Math.max(1, Math.min(5, (distribution[i]?.count || 1) + 2));
                return (
                  <div key={dim} className="rounded-lg border border-border/60 bg-muted/30 p-2">
                    <p className="font-medium text-foreground">{dim}</p>
                    <p className="mt-1 text-lg font-semibold text-primary">{score}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "audit" ? (
        <TableBlock
          empty="No audit entries"
          headers={["When", "Action", "Detail", "Actor"]}
          rows={audit.slice(0, 100).map((a) => [
            new Date(a.at).toLocaleString(),
            a.action,
            a.detail,
            a.actor,
          ])}
          page={1}
          total={audit.length}
          onPageChange={() => undefined}
        />
      ) : null}

      <GoalDrawer
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        employees={dir?.employees ?? []}
        departments={dir?.departments ?? []}
        onSubmit={(input) => {
          void createGoal(input)
            .then(() => {
              toast("Goal assigned");
              void load();
            })
            .catch((e) => toast(e instanceof Error ? e.message : "Failed", "error"));
        }}
      />
      <KpiDrawer
        open={kpiOpen}
        onClose={() => setKpiOpen(false)}
        onSubmit={(input) => {
          void createKpi(input)
            .then(() => {
              toast("KPI created");
              void load();
            })
            .catch((e) => toast(e instanceof Error ? e.message : "Failed", "error"));
        }}
      />
      <OkrDrawer
        open={okrOpen}
        onClose={() => setOkrOpen(false)}
        onSubmit={(input) => {
          void createOkr(input)
            .then(() => {
              toast("OKR created");
              void load();
            })
            .catch((e) => toast(e instanceof Error ? e.message : "Failed", "error"));
        }}
      />
      <CycleDrawer
        open={cycleOpen}
        onClose={() => setCycleOpen(false)}
        onSubmit={(input) => {
          createCycle(input);
          toast("Review cycle created");
          void load();
        }}
      />
      <ReviewDrawer
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        cycles={dir?.cycles ?? []}
        employees={dir?.employees ?? []}
        managers={dir?.managers ?? []}
        onSubmit={(input) => {
          void createReview(input)
            .then(() => {
              toast("Review started");
              void load();
            })
            .catch((e) => toast(e instanceof Error ? e.message : "Failed", "error"));
        }}
      />
      <FeedbackDrawer
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        employees={dir?.employees ?? []}
        onSubmit={(input) => {
          giveFeedback(input);
          toast("Feedback submitted");
          void load();
        }}
      />
      <MeetingDrawer
        open={meetingOpen}
        onClose={() => setMeetingOpen(false)}
        employees={dir?.employees ?? []}
        onSubmit={(input) => {
          scheduleOneOnOne(input);
          toast("1:1 scheduled");
          void load();
        }}
      />
      <PipDrawer
        open={pipOpen}
        onClose={() => setPipOpen(false)}
        employees={dir?.employees ?? []}
        onSubmit={(input) => {
          startPip(input);
          toast("PIP started");
          void load();
        }}
      />
      <ProbationDrawer
        open={probationOpen}
        onClose={() => setProbationOpen(false)}
        employees={dir?.employees ?? []}
        onSubmit={(input) => {
          createProbation(input);
          toast("Probation case saved");
          void load();
        }}
      />
      <AppraisalCreateDrawer
        open={appraisalOpen}
        onClose={() => setAppraisalOpen(false)}
        employees={dir?.employees ?? []}
        onSubmit={(input) => {
          void createAppraisal(input)
            .then(() => {
              toast("Appraisal started");
              void load();
            })
            .catch((e) => toast(e instanceof Error ? e.message : "Failed", "error"));
        }}
      />
    </div>
  );
}

function QuickBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Target;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-left text-xs font-medium transition-colors duration-200 hover:bg-muted"
    >
      <Icon className="size-3.5 text-primary" />
      {label}
    </button>
  );
}

function ReportCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function TableBlock({
  headers,
  rows,
  empty,
  page,
  total,
  onPageChange,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
  page: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  if (rows.length === 0) return <HrEmptyState title={empty} />;
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border/70 bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h || "x"} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border/50 transition-colors duration-150 hover:bg-muted/30"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {total > PAGE ? (
        <EmsPagination page={page} pageSize={PAGE} total={total} onPageChange={onPageChange} />
      ) : null}
    </div>
  );
}
