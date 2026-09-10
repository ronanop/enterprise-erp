"""PFMEA RPN calculation."""

from modules.quality.domain.exceptions import InvalidPfmeaState


class PfmeaEngine:
    def compute_rpn(self, severity: int, occurrence: int, detection: int) -> int:
        self.validate_rating(severity, "severity")
        self.validate_rating(occurrence, "occurrence")
        self.validate_rating(detection, "detection")
        return int(severity) * int(occurrence) * int(detection)

    def validate_rating(self, value: int, field: str) -> None:
        if value < 1 or value > 10:
            raise InvalidPfmeaState(f"{field} must be between 1 and 10")
