"""Project module router aggregation."""

from fastapi import APIRouter

from modules.project.routers.follow_ups import follow_ups_router
from modules.project.routers.my_jobs import my_jobs_router
from modules.project.routers.members import members_router
from modules.project.routers.purchase_orders import purchase_orders_router
from modules.project.routers.stage_alerts import stage_alerts_router
from modules.project.routers.customer_trackers import customer_trackers_router
from modules.project.routers import (
    change_requests_router,
    project_budgets_router,
    project_comments_router,
    project_costs_router,
    project_documents_router,
    project_issues_router,
    project_milestones_router,
    project_notifications_router,
    project_phases_router,
    project_risks_router,
    project_status_history_router,
    project_tasks_router,
    projects_router,
    reports_router,
    resource_allocations_router,
    resource_plans_router,
    site_installations_router,
    task_assignments_router,
    task_dependencies_router,
    timesheet_entries_router,
    timesheets_router,
)

project_router = APIRouter(prefix="/projects")
project_router.include_router(projects_router)
project_router.include_router(project_phases_router)
project_router.include_router(project_milestones_router)
project_router.include_router(project_tasks_router)
project_router.include_router(task_dependencies_router)
project_router.include_router(task_assignments_router)
project_router.include_router(timesheets_router)
project_router.include_router(timesheet_entries_router)
project_router.include_router(resource_plans_router)
project_router.include_router(resource_allocations_router)
project_router.include_router(project_budgets_router)
project_router.include_router(project_costs_router)
project_router.include_router(project_issues_router)
project_router.include_router(project_risks_router)
project_router.include_router(change_requests_router)
project_router.include_router(project_documents_router)
project_router.include_router(project_comments_router)
project_router.include_router(project_status_history_router)
project_router.include_router(project_notifications_router)
project_router.include_router(reports_router)
project_router.include_router(site_installations_router)
project_router.include_router(members_router)
project_router.include_router(my_jobs_router)
project_router.include_router(follow_ups_router)
project_router.include_router(stage_alerts_router)
project_router.include_router(purchase_orders_router)
project_router.include_router(customer_trackers_router)
