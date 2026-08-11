"""Employment lifecycle engine."""

from datetime import date, timedelta

from modules.hr.domain.enums import EmploymentStatus
from modules.hr.domain.exceptions import InvalidEmploymentState


class EmploymentEngine:
    ACTIVE_SET = {
        EmploymentStatus.ACTIVE.value,
        EmploymentStatus.PROBATION.value,
        EmploymentStatus.CONFIRMED.value,
        EmploymentStatus.ONBOARDING.value,
        EmploymentStatus.NOTICE_PERIOD.value,
    }

    LIFECYCLE_ORDER = [
        EmploymentStatus.DRAFT.value,
        EmploymentStatus.ONBOARDING.value,
        EmploymentStatus.PROBATION.value,
        EmploymentStatus.ACTIVE.value,
        EmploymentStatus.CONFIRMED.value,
        EmploymentStatus.NOTICE_PERIOD.value,
        EmploymentStatus.SEPARATED.value,
        EmploymentStatus.EX_EMPLOYEE.value,
        EmploymentStatus.ENDED.value,
    ]

    def apply_start_onboarding(self, row) -> None:
        if row.status not in {EmploymentStatus.DRAFT.value}:
            raise InvalidEmploymentState("Only draft employment can enter onboarding")
        row.status = EmploymentStatus.ONBOARDING.value
        row.lifecycle_source = "onboarding"

    def apply_start_probation(self, row, *, probation_days: int = 90) -> None:
        if row.status not in {
            EmploymentStatus.DRAFT.value,
            EmploymentStatus.ONBOARDING.value,
            EmploymentStatus.ACTIVE.value,
        }:
            raise InvalidEmploymentState("Cannot start probation from current status")
        row.status = EmploymentStatus.PROBATION.value
        row.probation_start_date = row.probation_start_date or row.date_of_joining
        if not row.probation_end_date:
            start = row.probation_start_date or row.date_of_joining
            row.probation_end_date = start + timedelta(days=probation_days)
        row.lifecycle_source = row.lifecycle_source or "hire"

    def apply_activate(self, row) -> None:
        if row.status not in {
            EmploymentStatus.DRAFT.value,
            EmploymentStatus.ONBOARDING.value,
            EmploymentStatus.PROBATION.value,
        }:
            raise InvalidEmploymentState("Employment must be draft/onboarding/probation to activate")
        row.status = EmploymentStatus.ACTIVE.value

    def apply_confirm(self, row) -> None:
        if row.status not in {
            EmploymentStatus.ACTIVE.value,
            EmploymentStatus.PROBATION.value,
        }:
            raise InvalidEmploymentState("Only active/probation employment can be confirmed")
        row.status = EmploymentStatus.CONFIRMED.value
        row.confirmation_date = date.today()

    def apply_extend_probation(self, row, *, extra_days: int) -> None:
        if row.status != EmploymentStatus.PROBATION.value:
            raise InvalidEmploymentState("Only probation employment can be extended")
        if extra_days <= 0:
            raise InvalidEmploymentState("Extension days must be positive")
        base = row.probation_end_date or date.today()
        row.probation_end_date = base + timedelta(days=extra_days)

    def apply_notice(self, row) -> None:
        if row.status not in {
            EmploymentStatus.ACTIVE.value,
            EmploymentStatus.PROBATION.value,
            EmploymentStatus.CONFIRMED.value,
        }:
            raise InvalidEmploymentState("Cannot start notice from current status")
        row.status = EmploymentStatus.NOTICE_PERIOD.value

    def apply_separate(self, row) -> None:
        if row.status not in {
            EmploymentStatus.NOTICE_PERIOD.value,
            EmploymentStatus.ACTIVE.value,
            EmploymentStatus.CONFIRMED.value,
            EmploymentStatus.PROBATION.value,
        }:
            raise InvalidEmploymentState("Cannot separate from current status")
        row.status = EmploymentStatus.SEPARATED.value

    def apply_ex_employee(self, row) -> None:
        if row.status not in {
            EmploymentStatus.SEPARATED.value,
            EmploymentStatus.ENDED.value,
        }:
            raise InvalidEmploymentState("Only separated employment becomes ex-employee")
        row.status = EmploymentStatus.EX_EMPLOYEE.value

    def apply_end(self, row) -> None:
        if row.status not in self.ACTIVE_SET and row.status != EmploymentStatus.SEPARATED.value:
            raise InvalidEmploymentState("Only active employment can be ended")
        row.status = EmploymentStatus.ENDED.value
