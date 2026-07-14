"""Task engine."""

from modules.crm.domain.enums import TaskStatus
from modules.crm.domain.exceptions import InvalidTaskState
from modules.crm.models import CrmTask


class TaskEngine:
    def validate_completable(self, task: CrmTask) -> None:
        if task.status not in {TaskStatus.PENDING.value, TaskStatus.IN_PROGRESS.value}:
            raise InvalidTaskState("Task cannot be completed from current status")

    def complete(self, task: CrmTask) -> None:
        self.validate_completable(task)
        task.status = TaskStatus.COMPLETED.value
