"""Meeting engine."""

from modules.crm.domain.enums import MeetingStatus
from modules.crm.domain.exceptions import InvalidMeetingState
from modules.crm.models import CrmMeeting


class MeetingEngine:
    def validate_completable(self, meeting: CrmMeeting) -> None:
        if meeting.status != MeetingStatus.SCHEDULED.value:
            raise InvalidMeetingState("Only scheduled meetings can be completed")

    def complete(self, meeting: CrmMeeting) -> None:
        self.validate_completable(meeting)
        meeting.status = MeetingStatus.COMPLETED.value
