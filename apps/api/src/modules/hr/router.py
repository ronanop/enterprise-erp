"""HR module router aggregation."""

from fastapi import APIRouter

from modules.hr.routers import (
    appraisals_router,
    attendance_router,
    department_assignments_router,
    designation_assignments_router,
    designations_router,
    employee_documents_router,
    employee_profiles_router,
    employment_router,
    goals_router,
    holiday_calendars_router,
    leave_balances_router,
    leave_requests_router,
    leave_types_router,
    performance_reviews_router,
    reports_router,
    separation_router,
    shift_assignments_router,
    shifts_router,
    training_attendance_router,
    training_requests_router,
    training_rooms_router,
    training_router,
)

hr_router = APIRouter(prefix="/hr")
hr_router.include_router(designations_router)
hr_router.include_router(employee_profiles_router)
hr_router.include_router(employment_router)
hr_router.include_router(department_assignments_router)
hr_router.include_router(designation_assignments_router)
hr_router.include_router(shifts_router)
hr_router.include_router(shift_assignments_router)
hr_router.include_router(holiday_calendars_router)
hr_router.include_router(leave_types_router)
hr_router.include_router(leave_balances_router)
hr_router.include_router(leave_requests_router)
hr_router.include_router(attendance_router)
hr_router.include_router(employee_documents_router)
hr_router.include_router(performance_reviews_router)
hr_router.include_router(goals_router)
hr_router.include_router(appraisals_router)
hr_router.include_router(training_router)
hr_router.include_router(training_attendance_router)
hr_router.include_router(training_rooms_router)
hr_router.include_router(training_requests_router)
hr_router.include_router(separation_router)
hr_router.include_router(reports_router)
