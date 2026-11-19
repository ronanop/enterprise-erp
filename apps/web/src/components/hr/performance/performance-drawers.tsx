"use client";

import { useState } from "react";

import { EmployeeSelect } from "@/components/hr/shared/employee-select";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import type { HrMasterOption } from "@/services/hr-master-connector";
import type {
  ContinuousFeedback,
  FeedbackType,
  FeedbackVisibility,
  GoalCategory,
  GoalPriority,
  GoalStatus,
  GoalType,
  KpiDefinition,
  MeasureType,
  OkrObjective,
  OneOnOneMeeting,
  PerformanceGoal,
  PerformanceReview,
  PipPlan,
  ProbationCase,
  ReviewCycle,
  ReviewRecommendation,
  ReviewType,
  AppraisalRecord,
} from "@/types/performance-management";

type EmpProps = { employees: HrMasterOption[]; departments: string[] };

export function GoalDrawer({
  open,
  onClose,
  employees,
  departments,
  onSubmit,
}: EmpProps & {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: Omit<PerformanceGoal, "id" | "goalCode" | "createdAt" | "updatedAt">) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("individual");
  const [category, setCategory] = useState<GoalCategory>("kpi");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState<GoalPriority>("medium");
  const [weightage, setWeightage] = useState("10");
  const [targetValue, setTargetValue] = useState("100");
  const [currentProgress, setCurrentProgress] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<GoalStatus>("in_progress");

  function save() {
    if (!title.trim() || !employeeName.trim()) return;
    onSubmit({
      title: title.trim(),
      description,
      goalType,
      category,
      employeeId: employeeId || undefined,
      employeeName,
      assignedBy: "HR Manager",
      department: department || "General",
      priority,
      weightage: Number(weightage) || 0,
      targetValue: Number(targetValue) || 100,
      currentProgress: Number(currentProgress) || 0,
      startDate,
      dueDate,
      status,
    });
    onClose();
    setTitle("");
    setEmployeeId("");
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title="Create Goal"
      description="Goal ID auto-generated (GOL-000001)."
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="cursor-pointer" disabled={!title || !employeeName} onClick={save}>
            Assign Goal
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SetupField label="Goal title" required>
          <SetupInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </SetupField>
        <SetupField label="Description">
          <SetupTextarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Goal type">
            <SetupSelect value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)}>
              <option value="individual">Individual</option>
              <option value="team">Team</option>
              <option value="company">Company</option>
              <option value="department">Department</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Category">
            <SetupSelect value={category} onChange={(e) => setCategory(e.target.value as GoalCategory)}>
              <option value="kpi">KPI</option>
              <option value="okr">OKR</option>
              <option value="learning">Learning</option>
              <option value="compliance">Compliance</option>
            </SetupSelect>
          </SetupField>
        </div>
        <EmployeeSelect
          label="Assigned employee"
          value={employeeId || employees.find((e) => e.label.split(" · ")[0] === employeeName)?.id || ""}
          options={employees}
          required
          onChange={(id, opt) => {
            setEmployeeId(id);
            setEmployeeName(opt ? opt.label.split(" · ")[0] : "");
            if (opt?.department) setDepartment(opt.department);
          }}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Department">
            <SetupInput
              list="pms-depts"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <datalist id="pms-depts">
              {departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </SetupField>
          <SetupField label="Priority">
            <SetupSelect value={priority} onChange={(e) => setPriority(e.target.value as GoalPriority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </SetupSelect>
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SetupField label="Weightage">
            <SetupInput type="number" value={weightage} onChange={(e) => setWeightage(e.target.value)} />
          </SetupField>
          <SetupField label="Target">
            <SetupInput type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
          </SetupField>
          <SetupField label="Current progress">
            <SetupInput
              type="number"
              value={currentProgress}
              onChange={(e) => setCurrentProgress(e.target.value)}
            />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Start date">
            <SetupInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </SetupField>
          <SetupField label="Due date">
            <SetupInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </SetupField>
        </div>
        <SetupField label="Status">
          <SetupSelect value={status} onChange={(e) => setStatus(e.target.value as GoalStatus)}>
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </SetupSelect>
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function KpiDrawer({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: Omit<KpiDefinition, "id" | "createdAt">) => void;
}) {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [weightage, setWeightage] = useState("20");
  const [target, setTarget] = useState("100");
  const [measureType, setMeasureType] = useState<MeasureType>("percentage");
  const [ratingScale, setRatingScale] = useState("5");

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Create KPI"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!name.trim()}
          onClick={() => {
            onSubmit({
              name: name.trim(),
              department,
              designation,
              weightage: Number(weightage) || 0,
              target: Number(target) || 0,
              measureType,
              ratingScale: Number(ratingScale) || 5,
            });
            onClose();
            setName("");
          }}
        >
          Create KPI
        </Button>
      }
    >
      <div className="space-y-3">
        <SetupField label="KPI name" required>
          <SetupInput value={name} onChange={(e) => setName(e.target.value)} />
        </SetupField>
        <SetupField label="Department">
          <SetupInput value={department} onChange={(e) => setDepartment(e.target.value)} />
        </SetupField>
        <SetupField label="Designation">
          <SetupInput value={designation} onChange={(e) => setDesignation(e.target.value)} />
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Weightage">
            <SetupInput type="number" value={weightage} onChange={(e) => setWeightage(e.target.value)} />
          </SetupField>
          <SetupField label="Target">
            <SetupInput type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
          </SetupField>
        </div>
        <SetupField label="Measurement type">
          <SetupSelect
            value={measureType}
            onChange={(e) => setMeasureType(e.target.value as MeasureType)}
          >
            <option value="percentage">Percentage</option>
            <option value="number">Number</option>
            <option value="currency">Currency</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="Rating scale">
          <SetupInput type="number" value={ratingScale} onChange={(e) => setRatingScale(e.target.value)} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function OkrDrawer({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: Omit<OkrObjective, "id" | "createdAt" | "progressPct">) => void;
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [department, setDepartment] = useState("");
  const [weightage, setWeightage] = useState("100");
  const [kr1, setKr1] = useState("");
  const [kr1p, setKr1p] = useState("0");
  const [kr2, setKr2] = useState("");
  const [kr2p, setKr2p] = useState("0");

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title="Create OKR"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!title.trim()}
          onClick={() => {
            const keyResults = [
              kr1
                ? {
                    id: crypto.randomUUID(),
                    title: kr1,
                    progressPct: Number(kr1p) || 0,
                    weightage: 50,
                  }
                : null,
              kr2
                ? {
                    id: crypto.randomUUID(),
                    title: kr2,
                    progressPct: Number(kr2p) || 0,
                    weightage: 50,
                  }
                : null,
            ].filter(Boolean) as OkrObjective["keyResults"];
            onSubmit({
              title: title.trim(),
              owner,
              department,
              weightage: Number(weightage) || 100,
              keyResults,
            });
            onClose();
            setTitle("");
          }}
        >
          Create OKR
        </Button>
      }
    >
      <div className="space-y-3">
        <SetupField label="Objective" required>
          <SetupInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Owner">
            <SetupInput value={owner} onChange={(e) => setOwner(e.target.value)} />
          </SetupField>
          <SetupField label="Department">
            <SetupInput value={department} onChange={(e) => setDepartment(e.target.value)} />
          </SetupField>
        </div>
        <SetupField label="Weightage">
          <SetupInput type="number" value={weightage} onChange={(e) => setWeightage(e.target.value)} />
        </SetupField>
        <SetupField label="Key result 1">
          <SetupInput value={kr1} onChange={(e) => setKr1(e.target.value)} />
        </SetupField>
        <SetupField label="KR1 progress %">
          <SetupInput type="number" value={kr1p} onChange={(e) => setKr1p(e.target.value)} />
        </SetupField>
        <SetupField label="Key result 2">
          <SetupInput value={kr2} onChange={(e) => setKr2(e.target.value)} />
        </SetupField>
        <SetupField label="KR2 progress %">
          <SetupInput type="number" value={kr2p} onChange={(e) => setKr2p(e.target.value)} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function CycleDrawer({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: Omit<ReviewCycle, "id" | "createdAt">) => void;
}) {
  const [name, setName] = useState("");
  const [reviewType, setReviewType] = useState<ReviewType>("quarterly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [departments, setDepartments] = useState("All");
  const [manager, setManager] = useState("");
  const [employeeCount, setEmployeeCount] = useState("0");

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Create Review Cycle"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!name.trim()}
          onClick={() => {
            onSubmit({
              name: name.trim(),
              reviewType,
              startDate,
              endDate,
              departments,
              manager,
              employeeCount: Number(employeeCount) || 0,
              status: "active",
            });
            onClose();
            setName("");
          }}
        >
          Create Cycle
        </Button>
      }
    >
      <div className="space-y-3">
        <SetupField label="Cycle name" required>
          <SetupInput value={name} onChange={(e) => setName(e.target.value)} />
        </SetupField>
        <SetupField label="Review type">
          <SetupSelect
            value={reviewType}
            onChange={(e) => setReviewType(e.target.value as ReviewType)}
          >
            <option value="probation">Probation</option>
            <option value="quarterly">Quarterly</option>
            <option value="half_yearly">Half-Yearly</option>
            <option value="annual">Annual</option>
            <option value="custom">Custom</option>
          </SetupSelect>
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Start">
            <SetupInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </SetupField>
          <SetupField label="End">
            <SetupInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </SetupField>
        </div>
        <SetupField label="Departments">
          <SetupInput value={departments} onChange={(e) => setDepartments(e.target.value)} />
        </SetupField>
        <SetupField label="Reporting manager">
          <SetupInput value={manager} onChange={(e) => setManager(e.target.value)} />
        </SetupField>
        <SetupField label="Applicable employees (count)">
          <SetupInput
            type="number"
            value={employeeCount}
            onChange={(e) => setEmployeeCount(e.target.value)}
          />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function ReviewDrawer({
  open,
  onClose,
  cycles,
  employees = [],
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  cycles: ReviewCycle[];
  employees?: HrMasterOption[];
  onSubmit: (input: Omit<PerformanceReview, "id" | "reviewCode" | "createdAt" | "updatedAt">) => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [reviewerEmployeeId, setReviewerEmployeeId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [selfAssessment, setSelfAssessment] = useState("");
  const [managerAssessment, setManagerAssessment] = useState("");
  const [peerReview, setPeerReview] = useState("");
  const [finalComments, setFinalComments] = useState("");
  const [overallRating, setOverallRating] = useState("3");
  const [recommendation, setRecommendation] = useState<ReviewRecommendation>("increment");
  const [attachmentName, setAttachmentName] = useState("");

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title="Start Appraisal / Review"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!employeeName.trim()}
          onClick={() => {
            onSubmit({
              cycleId,
              employeeId: employeeId || undefined,
              employeeName,
              managerName,
              reviewerEmployeeId: reviewerEmployeeId || employeeId || undefined,
              reviewerName: managerName,
              hrName: "HR",
              selfAssessment,
              managerAssessment,
              peerReview,
              finalComments,
              overallRating: Number(overallRating) || 0,
              recommendation,
              status: "self_pending",
              attachmentName,
            });
            onClose();
          }}
        >
          Start Review
        </Button>
      }
    >
      <div className="space-y-3">
        <EmployeeSelect
          value={employeeId || employees.find((e) => e.label.split(" · ")[0] === employeeName)?.id || ""}
          options={employees}
          required
          onChange={(id, opt) => {
            setEmployeeId(id);
            setEmployeeName(opt ? opt.label.split(" · ")[0] : "");
          }}
        />
        <EmployeeSelect
          label="Reviewer / reporting manager"
          value={reviewerEmployeeId}
          options={employees}
          onChange={(id, opt) => {
            setReviewerEmployeeId(id);
            setManagerName(opt ? opt.label.split(" · ")[0] : "");
          }}
        />
        <SetupField label="Reporting manager (display)">
          <SetupInput value={managerName} onChange={(e) => setManagerName(e.target.value)} />
        </SetupField>
        <SetupField label="Review cycle">
          <SetupSelect value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
            <option value="">Select…</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Self assessment">
          <SetupTextarea value={selfAssessment} onChange={(e) => setSelfAssessment(e.target.value)} rows={2} />
        </SetupField>
        <SetupField label="Reporting manager assessment">
          <SetupTextarea
            value={managerAssessment}
            onChange={(e) => setManagerAssessment(e.target.value)}
            rows={2}
          />
        </SetupField>
        <SetupField label="Peer review">
          <SetupTextarea value={peerReview} onChange={(e) => setPeerReview(e.target.value)} rows={2} />
        </SetupField>
        <SetupField label="Final comments">
          <SetupTextarea value={finalComments} onChange={(e) => setFinalComments(e.target.value)} rows={2} />
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Overall rating (1–5)">
            <SetupInput
              type="number"
              min={1}
              max={5}
              value={overallRating}
              onChange={(e) => setOverallRating(e.target.value)}
            />
          </SetupField>
          <SetupField label="Recommendation">
            <SetupSelect
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value as ReviewRecommendation)}
            >
              <option value="promotion">Promotion</option>
              <option value="increment">Increment</option>
              <option value="training">Training</option>
              <option value="pip">PIP</option>
              <option value="none">None</option>
            </SetupSelect>
          </SetupField>
        </div>
        <SetupField label="Attachment">
          <SetupInput value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function FeedbackDrawer({
  open,
  onClose,
  employees = [],
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  employees?: HrMasterOption[];
  onSubmit: (input: Omit<ContinuousFeedback, "id" | "createdAt">) => void;
}) {
  const [employeeName, setEmployeeName] = useState("");
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("recognition");
  const [category, setCategory] = useState("General");
  const [comment, setComment] = useState("");
  const [visibility, setVisibility] = useState<FeedbackVisibility>("manager");
  const [attachmentName, setAttachmentName] = useState("");

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Give Feedback"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!employeeName || !comment}
          onClick={() => {
            onSubmit({
              employeeName,
              fromName: "Reporting manager",
              feedbackType,
              category,
              comment,
              attachmentName,
              visibility,
            });
            onClose();
            setComment("");
          }}
        >
          Submit Feedback
        </Button>
      }
    >
      <div className="space-y-3">
        <EmployeeSelect
          value={employees.find((e) => e.label.split(" · ")[0] === employeeName)?.id ?? ""}
          options={employees}
          required
          onChange={(_id, opt) => setEmployeeName(opt ? opt.label.split(" · ")[0] : "")}
        />
        <SetupField label="Feedback type">
          <SetupSelect
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
          >
            <option value="recognition">Recognition</option>
            <option value="improvement">Improvement</option>
            <option value="coaching">Coaching</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="Category">
          <SetupInput value={category} onChange={(e) => setCategory(e.target.value)} />
        </SetupField>
        <SetupField label="Comment" required>
          <SetupTextarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        </SetupField>
        <SetupField label="Visibility">
          <SetupSelect
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as FeedbackVisibility)}
          >
            <option value="private">Private</option>
            <option value="manager">Reporting manager</option>
            <option value="hr">HR</option>
            <option value="employee">Employee</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="Attachment">
          <SetupInput value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function MeetingDrawer({
  open,
  onClose,
  employees = [],
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  employees?: HrMasterOption[];
  onSubmit: (input: Omit<OneOnOneMeeting, "id" | "createdAt">) => void;
}) {
  const [employeeName, setEmployeeName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [agenda, setAgenda] = useState("");
  const [notes, setNotes] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Schedule 1:1 Meeting"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!employeeName || !meetingDate}
          onClick={() => {
            onSubmit({
              employeeName,
              managerName,
              meetingDate,
              agenda,
              notes,
              actionItems,
              followUpDate,
            });
            onClose();
          }}
        >
          Schedule
        </Button>
      }
    >
      <div className="space-y-3">
        <EmployeeSelect
          value={employees.find((e) => e.label.split(" · ")[0] === employeeName)?.id ?? ""}
          options={employees}
          required
          onChange={(_id, opt) => setEmployeeName(opt ? opt.label.split(" · ")[0] : "")}
        />
        <SetupField label="Reporting manager">
          <SetupInput value={managerName} onChange={(e) => setManagerName(e.target.value)} />
        </SetupField>
        <SetupField label="Meeting date" required>
          <SetupInput type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
        </SetupField>
        <SetupField label="Agenda">
          <SetupTextarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={2} />
        </SetupField>
        <SetupField label="Notes">
          <SetupTextarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </SetupField>
        <SetupField label="Action items">
          <SetupTextarea value={actionItems} onChange={(e) => setActionItems(e.target.value)} rows={2} />
        </SetupField>
        <SetupField label="Follow-up date">
          <SetupInput type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function PipDrawer({
  open,
  onClose,
  employees = [],
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  employees?: HrMasterOption[];
  onSubmit: (input: Omit<PipPlan, "id" | "createdAt">) => void;
}) {
  const [employeeName, setEmployeeName] = useState("");
  const [reason, setReason] = useState("");
  const [goals, setGoals] = useState("");
  const [durationDays, setDurationDays] = useState("60");
  const [reviewDates, setReviewDates] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [managerName, setManagerName] = useState("");
  const [hrName, setHrName] = useState("HR");

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title="Start PIP"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!employeeName || !reason}
          onClick={() => {
            onSubmit({
              employeeName,
              reason,
              goals,
              durationDays: Number(durationDays) || 60,
              reviewDates,
              expectedOutcome,
              managerName,
              hrName,
              status: "active",
            });
            onClose();
          }}
        >
          Start PIP
        </Button>
      }
    >
      <div className="space-y-3">
        <EmployeeSelect
          value={employees.find((e) => e.label.split(" · ")[0] === employeeName)?.id ?? ""}
          options={employees}
          required
          onChange={(_id, opt) => setEmployeeName(opt ? opt.label.split(" · ")[0] : "")}
        />
        <SetupField label="Reason" required>
          <SetupTextarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </SetupField>
        <SetupField label="Goals">
          <SetupTextarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} />
        </SetupField>
        <SetupField label="Duration (days)">
          <SetupInput type="number" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
        </SetupField>
        <SetupField label="Review dates">
          <SetupInput value={reviewDates} onChange={(e) => setReviewDates(e.target.value)} placeholder="2026-08-01, 2026-09-01" />
        </SetupField>
        <SetupField label="Expected outcome">
          <SetupTextarea value={expectedOutcome} onChange={(e) => setExpectedOutcome(e.target.value)} rows={2} />
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Reporting manager">
            <SetupInput value={managerName} onChange={(e) => setManagerName(e.target.value)} />
          </SetupField>
          <SetupField label="HR">
            <SetupInput value={hrName} onChange={(e) => setHrName(e.target.value)} />
          </SetupField>
        </div>
      </div>
    </SetupDrawer>
  );
}

export function ProbationDrawer({
  open,
  onClose,
  employees = [],
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  employees?: HrMasterOption[];
  onSubmit: (input: Omit<ProbationCase, "id" | "createdAt">) => void;
}) {
  const [employeeName, setEmployeeName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [managerFeedback, setManagerFeedback] = useState("");
  const [hrFeedback, setHrFeedback] = useState("");

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Add Probation Case"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!employeeName}
          onClick={() => {
            onSubmit({
              employeeName,
              startDate,
              endDate,
              reviewDate,
              managerFeedback,
              hrFeedback,
              status: "in_progress",
            });
            onClose();
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-3">
        <EmployeeSelect
          value={employees.find((e) => e.label.split(" · ")[0] === employeeName)?.id ?? ""}
          options={employees}
          required
          onChange={(_id, opt) => setEmployeeName(opt ? opt.label.split(" · ")[0] : "")}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Probation start">
            <SetupInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </SetupField>
          <SetupField label="Probation end">
            <SetupInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </SetupField>
        </div>
        <SetupField label="Review date">
          <SetupInput type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
        </SetupField>
        <SetupField label="Reporting manager feedback">
          <SetupTextarea value={managerFeedback} onChange={(e) => setManagerFeedback(e.target.value)} rows={2} />
        </SetupField>
        <SetupField label="HR feedback">
          <SetupTextarea value={hrFeedback} onChange={(e) => setHrFeedback(e.target.value)} rows={2} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function AppraisalCreateDrawer({
  open,
  onClose,
  employees = [],
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  employees?: HrMasterOption[];
  onSubmit: (input: Omit<AppraisalRecord, "id" | "appraisalCode" | "createdAt" | "updatedAt">) => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [cycleName, setCycleName] = useState("Annual 2026");
  const [salaryRecommendation, setSalary] = useState("");
  const [promotionRecommendation, setPromo] = useState("");
  const [bonusRecommendation, setBonus] = useState("");
  const [trainingRecommendation, setTraining] = useState("");
  const [overallRating, setRating] = useState("3");

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Start Appraisal"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!employeeName}
          onClick={() => {
            onSubmit({
              employeeId: employeeId || undefined,
              employeeName,
              cycleName,
              salaryRecommendation,
              promotionRecommendation,
              bonusRecommendation,
              trainingRecommendation,
              workflowStage: "manager",
              overallRating: Number(overallRating) || 0,
            });
            onClose();
          }}
        >
          Start Appraisal
        </Button>
      }
    >
      <div className="space-y-3">
        <EmployeeSelect
          value={employeeId || employees.find((e) => e.label.split(" · ")[0] === employeeName)?.id || ""}
          options={employees}
          required
          onChange={(id, opt) => {
            setEmployeeId(id);
            setEmployeeName(opt ? opt.label.split(" · ")[0] : "");
          }}
        />
        <SetupField label="Cycle">
          <SetupInput value={cycleName} onChange={(e) => setCycleName(e.target.value)} />
        </SetupField>
        <SetupField label="Salary recommendation">
          <SetupInput value={salaryRecommendation} onChange={(e) => setSalary(e.target.value)} />
        </SetupField>
        <SetupField label="Promotion recommendation">
          <SetupInput value={promotionRecommendation} onChange={(e) => setPromo(e.target.value)} />
        </SetupField>
        <SetupField label="Bonus recommendation">
          <SetupInput value={bonusRecommendation} onChange={(e) => setBonus(e.target.value)} />
        </SetupField>
        <SetupField label="Training recommendation">
          <SetupInput value={trainingRecommendation} onChange={(e) => setTraining(e.target.value)} />
        </SetupField>
        <SetupField label="Overall rating">
          <SetupInput type="number" min={1} max={5} value={overallRating} onChange={(e) => setRating(e.target.value)} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
