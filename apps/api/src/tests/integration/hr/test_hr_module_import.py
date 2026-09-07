"""Integration smoke: HR module imports and router mount."""

from modules.hr.models import HrAttendance, HrEmployment, HrLeaveRequest, HrSeparation
from modules.hr.router import hr_router
from modules.hr.service import (
    EmploymentService,
    HRApplicationService,
    LeaveService,
    SeparationService,
)
from modules.hr.service.engines import EmploymentEngine, LeaveRequestEngine, SeparationEngine


def test_hr_models_importable():
    assert HrEmployment.__tablename__ == "hr_employment"
    assert HrLeaveRequest.__tablename__ == "hr_leave_request"
    assert HrAttendance.__tablename__ == "hr_attendance"
    assert HrSeparation.__tablename__ == "hr_separation"


def test_hr_router_mounted():
    assert hr_router.prefix == "/hrms"
    assert len(hr_router.routes) > 20


def test_hr_services_and_engines_importable():
    assert EmploymentService is not None
    assert LeaveService is not None
    assert SeparationService is not None
    assert HRApplicationService is not None
    assert EmploymentEngine is not None
    assert LeaveRequestEngine is not None
    assert SeparationEngine is not None
