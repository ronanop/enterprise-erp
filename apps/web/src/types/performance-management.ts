/** Enterprise Performance Management System — types */

export type GoalType = "individual" | "team" | "company" | "department";
export type GoalCategory = "kpi" | "okr" | "learning" | "compliance";
export type GoalPriority = "low" | "medium" | "high" | "critical";
export type GoalStatus = "draft" | "in_progress" | "completed" | "cancelled";

export type MeasureType = "percentage" | "number" | "currency";

export type ReviewType = "probation" | "quarterly" | "half_yearly" | "annual" | "custom";
export type CycleStatus = "draft" | "active" | "closed" | "cancelled";

export type ReviewRecommendation = "promotion" | "increment" | "training" | "pip" | "none";
export type ReviewStatus = "draft" | "self_pending" | "manager_pending" | "hr_pending" | "completed" | "cancelled";

export type FeedbackType = "recognition" | "improvement" | "coaching";
export type FeedbackVisibility = "private" | "manager" | "hr" | "employee";

export type ProbationStatus = "in_progress" | "confirmed" | "extended" | "terminated";
export type PipStatus = "active" | "completed" | "failed" | "cancelled";

export type AppraisalWorkflow = "manager" | "hr" | "director" | "approved" | "rejected";

export type PerformanceGoal = {
  id: string;
  goalCode: string;
  title: string;
  description: string;
  goalType: GoalType;
  category: GoalCategory;
  employeeId?: string;
  employeeName: string;
  assignedBy: string;
  department: string;
  priority: GoalPriority;
  weightage: number;
  targetValue: number;
  currentProgress: number;
  startDate: string;
  dueDate: string;
  status: GoalStatus;
  performanceReviewId?: string;
  createdAt: string;
  updatedAt: string;
};

export type KpiDefinition = {
  id: string;
  name: string;
  department: string;
  designation: string;
  weightage: number;
  target: number;
  measureType: MeasureType;
  ratingScale: number;
  createdAt: string;
};

export type OkrObjective = {
  id: string;
  title: string;
  owner: string;
  department: string;
  weightage: number;
  progressPct: number;
  keyResults: { id: string; title: string; progressPct: number; weightage: number }[];
  createdAt: string;
};

export type ReviewCycle = {
  id: string;
  name: string;
  reviewType: ReviewType;
  startDate: string;
  endDate: string;
  departments: string;
  manager: string;
  employeeCount: number;
  status: CycleStatus;
  createdAt: string;
};

export type PerformanceReview = {
  id: string;
  reviewCode: string;
  cycleId: string;
  employeeId?: string;
  employeeName: string;
  managerName: string;
  reviewerEmployeeId?: string;
  reviewerName: string;
  hrName: string;
  selfAssessment: string;
  managerAssessment: string;
  peerReview: string;
  finalComments: string;
  overallRating: number;
  recommendation: ReviewRecommendation;
  status: ReviewStatus;
  attachmentName: string;
  createdAt: string;
  updatedAt: string;
};

export type ContinuousFeedback = {
  id: string;
  employeeName: string;
  fromName: string;
  feedbackType: FeedbackType;
  category: string;
  comment: string;
  attachmentName: string;
  visibility: FeedbackVisibility;
  createdAt: string;
};

export type OneOnOneMeeting = {
  id: string;
  employeeName: string;
  managerName: string;
  meetingDate: string;
  agenda: string;
  notes: string;
  actionItems: string;
  followUpDate: string;
  createdAt: string;
};

export type ProbationCase = {
  id: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  reviewDate: string;
  managerFeedback: string;
  hrFeedback: string;
  status: ProbationStatus;
  createdAt: string;
};

export type PipPlan = {
  id: string;
  employeeName: string;
  reason: string;
  goals: string;
  durationDays: number;
  reviewDates: string;
  expectedOutcome: string;
  managerName: string;
  hrName: string;
  status: PipStatus;
  createdAt: string;
};

export type AppraisalRecord = {
  id: string;
  appraisalCode: string;
  employeeId?: string;
  employeeName: string;
  cycleName: string;
  salaryRecommendation: string;
  promotionRecommendation: string;
  bonusRecommendation: string;
  trainingRecommendation: string;
  workflowStage: AppraisalWorkflow;
  overallRating: number;
  performanceReviewId?: string;
  createdAt: string;
  updatedAt: string;
};

export type PerformanceAudit = {
  id: string;
  action: string;
  detail: string;
  actor: string;
  at: string;
};

export type PerformanceFilters = {
  query: string;
  status: string;
  department: string;
};

export function emptyPerformanceFilters(): PerformanceFilters {
  return { query: "", status: "all", department: "all" };
}

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: "Draft",
  self_pending: "Self Assessment",
  manager_pending: "Reporting manager review",
  hr_pending: "HR Review",
  completed: "Completed",
  cancelled: "Cancelled",
};
