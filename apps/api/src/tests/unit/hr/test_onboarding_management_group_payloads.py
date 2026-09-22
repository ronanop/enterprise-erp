"""Contract tests for optional management-group onboarding payloads."""

from uuid import uuid4

from modules.hr.schemas import EmploymentActivateRequest
from modules.recruitment.schemas import OnboardingCompleteRequest


def test_onboarding_completion_accepts_optional_management_group() -> None:
    group_id = uuid4()
    payload = OnboardingCompleteRequest(
        designation="Software Engineer",
        management_group_id=group_id,
    )

    assert payload.management_group_id == group_id


def test_onboarding_completion_allows_no_management_group() -> None:
    payload = OnboardingCompleteRequest(designation="Software Engineer")

    assert payload.management_group_id is None


def test_activation_accepts_optional_management_group() -> None:
    group_id = uuid4()
    payload = EmploymentActivateRequest(management_group_id=group_id)

    assert payload.management_group_id == group_id
