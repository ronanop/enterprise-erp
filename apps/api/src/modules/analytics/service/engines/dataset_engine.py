"""Dataset lifecycle engine."""

from modules.analytics.domain.enums import (
    DatasetStatus,
)
from modules.analytics.domain.exceptions import (
    InvalidDatasetState,
)


class DatasetEngine:
    def submit(self, row) -> None:
        if row.status != DatasetStatus.DRAFT.value:
            raise InvalidDatasetState("Only draft datasets can be submitted")
        row.status = DatasetStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != DatasetStatus.SUBMITTED.value:
            raise InvalidDatasetState("Only submitted datasets can be approved")
        row.status = DatasetStatus.APPROVED.value

    def refresh(self, row) -> None:
        if row.status not in {
            DatasetStatus.APPROVED.value,
            DatasetStatus.ACTIVE.value,
            DatasetStatus.FAILED.value,
        }:
            raise InvalidDatasetState("Dataset not refreshable")
        row.status = DatasetStatus.REFRESHING.value

    def activate(self, row) -> None:
        row.status = DatasetStatus.ACTIVE.value

    def mark_failed(self, row) -> None:
        row.status = DatasetStatus.FAILED.value

    def retire(self, row) -> None:
        row.status = DatasetStatus.RETIRED.value
