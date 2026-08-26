"""Project domain exceptions."""

from core.exceptions import ConflictException


class InvalidProjectState(ConflictException):
    def __init__(self, message: str = "Invalid project state") -> None:
        super().__init__(message)

class InvalidProjectPhaseState(ConflictException):
    def __init__(self, message: str = "Invalid projectphase state") -> None:
        super().__init__(message)

class InvalidProjectMilestoneState(ConflictException):
    def __init__(self, message: str = "Invalid projectmilestone state") -> None:
        super().__init__(message)

class InvalidProjectTaskState(ConflictException):
    def __init__(self, message: str = "Invalid projecttask state") -> None:
        super().__init__(message)

class InvalidTaskDependencyState(ConflictException):
    def __init__(self, message: str = "Invalid taskdependency state") -> None:
        super().__init__(message)

class InvalidTaskAssignmentState(ConflictException):
    def __init__(self, message: str = "Invalid taskassignment state") -> None:
        super().__init__(message)

class InvalidTimesheetState(ConflictException):
    def __init__(self, message: str = "Invalid timesheet state") -> None:
        super().__init__(message)

class InvalidTimesheetEntryState(ConflictException):
    def __init__(self, message: str = "Invalid timesheetentry state") -> None:
        super().__init__(message)

class InvalidResourcePlanState(ConflictException):
    def __init__(self, message: str = "Invalid resourceplan state") -> None:
        super().__init__(message)

class InvalidResourceAllocationState(ConflictException):
    def __init__(self, message: str = "Invalid resourceallocation state") -> None:
        super().__init__(message)

class InvalidProjectBudgetState(ConflictException):
    def __init__(self, message: str = "Invalid projectbudget state") -> None:
        super().__init__(message)

class InvalidProjectCostState(ConflictException):
    def __init__(self, message: str = "Invalid projectcost state") -> None:
        super().__init__(message)

class InvalidProjectIssueState(ConflictException):
    def __init__(self, message: str = "Invalid projectissue state") -> None:
        super().__init__(message)

class InvalidProjectRiskState(ConflictException):
    def __init__(self, message: str = "Invalid projectrisk state") -> None:
        super().__init__(message)

class InvalidChangeRequestState(ConflictException):
    def __init__(self, message: str = "Invalid changerequest state") -> None:
        super().__init__(message)

class InvalidProjectDocumentState(ConflictException):
    def __init__(self, message: str = "Invalid projectdocument state") -> None:
        super().__init__(message)

class InvalidProjectCommentState(ConflictException):
    def __init__(self, message: str = "Invalid projectcomment state") -> None:
        super().__init__(message)

class InvalidProjectStatusHistoryState(ConflictException):
    def __init__(self, message: str = "Invalid projectstatushistory state") -> None:
        super().__init__(message)

class InvalidProjectNotificationState(ConflictException):
    def __init__(self, message: str = "Invalid projectnotification state") -> None:
        super().__init__(message)

class InvalidProjectReportState(ConflictException):
    def __init__(self, message: str = "Invalid projectreport state") -> None:
        super().__init__(message)


class InvalidSiteInstallationState(ConflictException):
    def __init__(self, message: str = "Invalid site installation workflow state") -> None:
        super().__init__(message)
