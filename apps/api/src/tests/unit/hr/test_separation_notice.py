"""Notice-period defaults and approval pipeline stay intact."""

from modules.hr.domain.enums import NoticeStatus, SeparationStatus
from modules.hr.service.engines.separation_engine import SeparationEngine
from modules.hr.service.separation_service import default_notice_status


def test_default_notice_status_by_type():
    assert default_notice_status("resignation", None) == NoticeStatus.PENDING.value
    assert default_notice_status("retirement", None) == NoticeStatus.PENDING.value
    assert default_notice_status("termination", None) == NoticeStatus.NOT_APPLICABLE.value
    assert default_notice_status("death", None) == NoticeStatus.NOT_APPLICABLE.value
    assert default_notice_status("other", None) == NoticeStatus.NOT_APPLICABLE.value


def test_serve_notice_override():
    assert default_notice_status("termination", True) == NoticeStatus.PENDING.value
    assert default_notice_status("resignation", False) == NoticeStatus.NOT_APPLICABLE.value


def test_approval_pipeline_stages_unchanged():
    engine = SeparationEngine()
    assert hasattr(engine, "manager_approve")
    assert hasattr(engine, "it_approve")
    assert hasattr(engine, "accounts_approve")
    assert hasattr(engine, "hr_approve")
    assert SeparationStatus.MANAGER_APPROVED.value == "manager_approved"
    assert SeparationStatus.IT_APPROVED.value == "it_approved"
    assert SeparationStatus.ACCOUNTS_APPROVED.value == "accounts_approved"
    assert SeparationStatus.HR_APPROVED.value == "hr_approved"
