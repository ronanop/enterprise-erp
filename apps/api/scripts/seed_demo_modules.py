"""Seed sample rows for every major ERP module so list pages show data.

Prereqs:
  - alembic upgrade head
  - python -m scripts.seed_demo_data
  - python -m scripts.seed_all_permissions

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.seed_demo_modules
"""

from __future__ import annotations

import sys
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import select, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.master_data.models.category import MasterProductCategory  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.master_data.models.party import MasterCustomer, MasterVendor  # noqa: E402
from modules.master_data.models.product import MasterProduct  # noqa: E402
from modules.master_data.models.reference import MasterCurrency, MasterTax, MasterUom  # noqa: E402
from modules.master_data.models.warehouse import MasterWarehouse  # noqa: E402
from modules.master_data.models.asset import MasterAsset  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.organization.models.hierarchy import (  # noqa: E402
    OrgBusinessUnit,
    OrgCostCenter,
    OrgDepartment,
    OrgLocation,
    OrgProfitCenter,
)

# Finance
from modules.finance.models.coa import FinAccountGroup, FinChartOfAccount  # noqa: E402
from modules.finance.models.fiscal import FinFiscalYear, FinPeriod  # noqa: E402
from modules.finance.models.journal import FinJournalHeader  # noqa: E402
from modules.finance.models.ledger import FinCustomerLedger, FinVendorLedger  # noqa: E402
from modules.finance.models.currency import FinCurrencyRate  # noqa: E402
from modules.finance.models.asset import FinAssetTransaction  # noqa: E402

# HR
from modules.hr.models.attendance import HrAttendance  # noqa: E402
from modules.hr.models.designation import HrDesignation  # noqa: E402
from modules.hr.models.employee_profile import HrEmployeeProfile  # noqa: E402
from modules.hr.models.leave_request import HrLeaveRequest  # noqa: E402
from modules.hr.models.leave_type import HrLeaveType  # noqa: E402
from modules.hr.models.shift import HrShift  # noqa: E402
from modules.hr.models.employment import HrEmployment  # noqa: E402
from modules.hr.models.holiday_calendar import HrHolidayCalendar  # noqa: E402
from modules.hr.models.performance_review import HrPerformanceReview  # noqa: E402
from modules.hr.models.training import HrTraining  # noqa: E402
from modules.hr.models.separation import HrSeparation  # noqa: E402
from modules.hr.models.leave_balance import HrLeaveBalance  # noqa: E402
from modules.hr.models.shift_assignment import HrShiftAssignment  # noqa: E402
from modules.hr.models.employee_document import HrEmployeeDocument  # noqa: E402
from modules.hr.models.goal import HrGoal  # noqa: E402
from modules.hr.models.appraisal import HrAppraisal  # noqa: E402

# CRM
from modules.crm.models.campaign import CrmCampaign  # noqa: E402
from modules.crm.models.lead import CrmLead  # noqa: E402
from modules.crm.models.lead_source import CrmLeadSource  # noqa: E402
from modules.crm.models.opportunity import CrmOpportunity  # noqa: E402
from modules.crm.models.pipeline import CrmPipeline  # noqa: E402
from modules.crm.models.interaction import CrmInteraction  # noqa: E402
from modules.crm.models.task import CrmTask  # noqa: E402
from modules.crm.models.followup import CrmFollowup  # noqa: E402
from modules.crm.models.meeting import CrmMeeting  # noqa: E402
from modules.crm.models.call_log import CrmCallLog  # noqa: E402
from modules.crm.models.email_log import CrmEmailLog  # noqa: E402
from modules.crm.models.visit_log import CrmVisitLog  # noqa: E402
from modules.crm.models.customer_feedback import CrmCustomerFeedback  # noqa: E402
from modules.crm.models.customer_satisfaction import CrmCustomerSatisfaction  # noqa: E402
from modules.crm.models.lead_assignment import CrmLeadAssignment  # noqa: E402
from modules.crm.models.lead_activity import CrmLeadActivity  # noqa: E402
from modules.crm.models.opportunity_stage import CrmOpportunityStage  # noqa: E402

# Sales
from modules.sales.models.invoice import SalesInvoiceHeader  # noqa: E402
from modules.sales.models.order import SalesOrderHeader, SalesOrderLine  # noqa: E402
from modules.sales.models.pricing import SalesPriceList, SalesDiscountRule  # noqa: E402
from modules.sales.models.quotation import SalesQuotationHeader  # noqa: E402
from modules.sales.models.credit import SalesCustomerCredit  # noqa: E402
from modules.sales.models.delivery import SalesDeliveryHeader, SalesDeliveryLine  # noqa: E402
from modules.sales.models.return_doc import SalesReturnHeader, SalesReturnLine  # noqa: E402

# Helpdesk
from modules.helpdesk.models.ticket import HdTicket  # noqa: E402
from modules.helpdesk.models.ticket_category import HdTicketCategory  # noqa: E402
from modules.helpdesk.models.ticket_priority import HdTicketPriority  # noqa: E402
from modules.helpdesk.models.ticket_sla import HdTicketSla  # noqa: E402
from modules.helpdesk.models.knowledge_base import HdKnowledgeBase  # noqa: E402
from modules.helpdesk.models.knowledge_article import HdKnowledgeArticle  # noqa: E402
from modules.helpdesk.models.resolution import HdResolution  # noqa: E402
from modules.helpdesk.models.support_team import HdSupportTeam  # noqa: E402
from modules.helpdesk.models.support_shift import HdSupportShift  # noqa: E402
from modules.helpdesk.models.support_schedule import HdSupportSchedule  # noqa: E402
from modules.helpdesk.models.customer_feedback import HdCustomerFeedback  # noqa: E402
from modules.helpdesk.models.ticket_assignment import HdTicketAssignment  # noqa: E402
from modules.helpdesk.models.ticket_comment import HdTicketComment  # noqa: E402
from modules.helpdesk.models.ticket_escalation import HdTicketEscalation  # noqa: E402

# Quality
from modules.quality.models.defect_type import QmDefectType  # noqa: E402
from modules.quality.models.inspection_plan import QmInspectionPlan  # noqa: E402
from modules.quality.models.sampling_plan import QmSamplingPlan  # noqa: E402
from modules.quality.models.characteristic import QmQualityCharacteristic  # noqa: E402
from modules.quality.models.incoming_inspection import QmIncomingInspection  # noqa: E402
from modules.quality.models.inprocess_inspection import QmInprocessInspection  # noqa: E402
from modules.quality.models.final_inspection import QmFinalInspection  # noqa: E402
from modules.quality.models.ncr import QmNcr  # noqa: E402
from modules.quality.models.capa import QmCapa  # noqa: E402
from modules.quality.models.supplier_quality import QmSupplierQuality  # noqa: E402
from modules.quality.models.customer_complaint import QmCustomerComplaint  # noqa: E402
from modules.quality.models.quality_audit import QmQualityAudit  # noqa: E402
from modules.quality.models.quality_score import QmQualityScore  # noqa: E402
from modules.quality.models.defect import QmDefect  # noqa: E402

# Payroll
from modules.payroll.models.earning_type import PayEarningType  # noqa: E402
from modules.payroll.models.payroll_period import PayPayrollPeriod  # noqa: E402
from modules.payroll.models.salary_structure import PaySalaryStructure  # noqa: E402
from modules.payroll.models.salary_component import PaySalaryComponent  # noqa: E402
from modules.payroll.models.employee_salary import PayEmployeeSalary  # noqa: E402
from modules.payroll.models.deduction_type import PayDeductionType  # noqa: E402
from modules.payroll.models.tax_configuration import PayTaxConfiguration  # noqa: E402
from modules.payroll.models.statutory_contribution import PayStatutoryContribution  # noqa: E402
from modules.payroll.models.payroll_run import PayPayrollRun  # noqa: E402
from modules.payroll.models.bonus import PayBonus  # noqa: E402
from modules.payroll.models.reimbursement import PayReimbursement  # noqa: E402
from modules.payroll.models.loan import PayLoan  # noqa: E402
from modules.payroll.models.payroll_adjustment import PayPayrollAdjustment  # noqa: E402

# Asset
from modules.asset.models.asset import AstAsset  # noqa: E402
from modules.asset.models.asset_category import AstAssetCategory  # noqa: E402
from modules.asset.models.asset_location import AstAssetLocation  # noqa: E402
from modules.asset.models.asset_warranty import AstAssetWarranty  # noqa: E402
from modules.asset.models.asset_insurance import AstAssetInsurance  # noqa: E402
from modules.asset.models.asset_maintenance_plan import AstAssetMaintenancePlan  # noqa: E402
from modules.asset.models.asset_assignment import AstAssetAssignment  # noqa: E402
from modules.asset.models.asset_component import AstAssetComponent  # noqa: E402
from modules.asset.models.asset_meter_reading import AstAssetMeterReading  # noqa: E402
from modules.asset.models.asset_maintenance import AstAssetMaintenance  # noqa: E402
from modules.asset.models.asset_depreciation import AstAssetDepreciation  # noqa: E402
from modules.asset.models.asset_disposal import AstAssetDisposal  # noqa: E402
from modules.asset.models.asset_audit import AstAssetAudit  # noqa: E402
from modules.asset.models.asset_transfer import AstAssetTransfer  # noqa: E402

# Project
from modules.project.models.project import PrjProject  # noqa: E402
from modules.project.models.project_task import PrjProjectTask  # noqa: E402
from modules.project.models.timesheet import PrjTimesheet  # noqa: E402
from modules.project.models.project_phase import PrjProjectPhase  # noqa: E402
from modules.project.models.project_milestone import PrjProjectMilestone  # noqa: E402
from modules.project.models.resource_plan import PrjResourcePlan  # noqa: E402
from modules.project.models.project_budget import PrjProjectBudget  # noqa: E402
from modules.project.models.project_issue import PrjProjectIssue  # noqa: E402
from modules.project.models.project_risk import PrjProjectRisk  # noqa: E402
from modules.project.models.change_request import PrjChangeRequest  # noqa: E402
from modules.project.models.project_document import PrjProjectDocument  # noqa: E402
from modules.project.models.project_cost import PrjProjectCost  # noqa: E402
from modules.project.models.resource_allocation import PrjResourceAllocation  # noqa: E402
from modules.project.models.timesheet_entry import PrjTimesheetEntry  # noqa: E402

# Service
from modules.service.models.service_category import SvcServiceCategory  # noqa: E402
from modules.service.models.service_request import SvcServiceRequest  # noqa: E402
from modules.service.models.service_ticket import SvcServiceTicket  # noqa: E402
from modules.service.models.service_work_order import SvcServiceWorkOrder  # noqa: E402
from modules.service.models.service_schedule import SvcServiceSchedule  # noqa: E402
from modules.service.models.service_visit import SvcServiceVisit  # noqa: E402
from modules.service.models.service_sla import SvcServiceSla  # noqa: E402
from modules.service.models.service_escalation import SvcServiceEscalation  # noqa: E402
from modules.service.models.service_contract import SvcServiceContract  # noqa: E402
from modules.service.models.service_feedback import SvcServiceFeedback  # noqa: E402
from modules.service.models.service_assignment import SvcServiceAssignment  # noqa: E402
from modules.service.models.service_material import SvcServiceMaterial  # noqa: E402
from modules.service.models.service_task import SvcServiceTask  # noqa: E402
from modules.service.models.service_time_entry import SvcServiceTimeEntry  # noqa: E402

# Document
from modules.document.models.document import DocDocument  # noqa: E402
from modules.document.models.folder import DocFolder  # noqa: E402
from modules.document.models.template import DocTemplate  # noqa: E402
from modules.document.models.retention_policy import DocRetentionPolicy  # noqa: E402
from modules.document.models.archive import DocArchive  # noqa: E402
from modules.document.models.document_version import DocDocumentVersion  # noqa: E402
from modules.document.models.document_tag import DocDocumentTag  # noqa: E402
from modules.document.models.document_share import DocDocumentShare  # noqa: E402
from modules.document.models.document_permission import DocDocumentPermission  # noqa: E402
from modules.document.models.document_approval import DocDocumentApproval  # noqa: E402
from modules.document.models.document_workflow import DocDocumentWorkflow  # noqa: E402

# GRC
from modules.grc.models.policy import GrcPolicy  # noqa: E402
from modules.grc.models.risk_category import GrcRiskCategory  # noqa: E402
from modules.grc.models.risk_register import GrcRiskRegister  # noqa: E402
from modules.grc.models.control import GrcControl  # noqa: E402
from modules.grc.models.compliance_framework import GrcComplianceFramework  # noqa: E402
from modules.grc.models.compliance_requirement import GrcComplianceRequirement  # noqa: E402
from modules.grc.models.compliance_assessment import GrcComplianceAssessment  # noqa: E402
from modules.grc.models.audit_plan import GrcAuditPlan  # noqa: E402
from modules.grc.models.audit import GrcAudit  # noqa: E402
from modules.grc.models.corrective_action import GrcCorrectiveAction  # noqa: E402
from modules.grc.models.exception import GrcException  # noqa: E402
from modules.grc.models.incident import GrcIncident  # noqa: E402
from modules.grc.models.policy_version import GrcPolicyVersion  # noqa: E402
from modules.grc.models.control_test import GrcControlTest  # noqa: E402
from modules.grc.models.risk_assessment import GrcRiskAssessment  # noqa: E402
from modules.grc.models.risk_treatment import GrcRiskTreatment  # noqa: E402
from modules.grc.models.audit_finding import GrcAuditFinding  # noqa: E402

# Recruitment
from modules.recruitment.models.candidate import RecCandidate  # noqa: E402
from modules.recruitment.models.job_posting import RecJobPosting  # noqa: E402
from modules.recruitment.models.job_requisition import RecJobRequisition  # noqa: E402
from modules.recruitment.models.recruitment_source import RecRecruitmentSource  # noqa: E402
from modules.recruitment.models.recruiter import RecRecruiter  # noqa: E402
from modules.recruitment.models.application import RecApplication  # noqa: E402
from modules.recruitment.models.application_stage import RecApplicationStage  # noqa: E402
from modules.recruitment.models.interview import RecInterview  # noqa: E402
from modules.recruitment.models.interview_feedback import RecInterviewFeedback  # noqa: E402
from modules.recruitment.models.offer import RecOffer  # noqa: E402
from modules.recruitment.models.background_verification import RecBackgroundVerification  # noqa: E402
from modules.recruitment.models.talent_pool import RecTalentPool  # noqa: E402
from modules.recruitment.models.onboarding import RecOnboarding  # noqa: E402
from modules.recruitment.models.onboarding_task import RecOnboardingTask  # noqa: E402

# Manufacturing
from modules.manufacturing.models.bom import MfgBom  # noqa: E402
from modules.manufacturing.models.production_order import MfgProductionOrder  # noqa: E402
from modules.manufacturing.models.work_center import MfgWorkCenter  # noqa: E402
from modules.manufacturing.models.routing import MfgRouting, MfgRoutingOperation  # noqa: E402
from modules.manufacturing.models.machine import MfgMachine  # noqa: E402
from modules.manufacturing.models.material_issue import MfgMaterialIssue  # noqa: E402
from modules.manufacturing.models.material_return import MfgMaterialReturn  # noqa: E402
from modules.manufacturing.models.production_receipt import MfgProductionReceipt  # noqa: E402
from modules.manufacturing.models.scrap import MfgScrap  # noqa: E402
from modules.manufacturing.models.wip import MfgWip  # noqa: E402
from modules.manufacturing.models.variance import MfgVariance  # noqa: E402

# Inventory
from modules.inventory.models.balance import InvStockBalance  # noqa: E402
from modules.inventory.models.bin import InvBin  # noqa: E402
from modules.inventory.models.batch import InvBatch  # noqa: E402
from modules.inventory.models.serial import InvSerial  # noqa: E402
from modules.inventory.models.reservation import InvReservation  # noqa: E402
from modules.inventory.models.transfer import InvTransferHeader  # noqa: E402
from modules.inventory.models.adjustment import InvAdjustmentHeader  # noqa: E402
from modules.inventory.models.cycle_count import InvCycleCountHeader  # noqa: E402
from modules.inventory.models.reorder_policy import InvReorderPolicy  # noqa: E402

# Procurement
from modules.procurement.models.order import ProcOrderHeader  # noqa: E402
from modules.procurement.models.requisition import ProcRequisitionHeader  # noqa: E402
from modules.procurement.models.rfq import ProcRfqHeader  # noqa: E402
from modules.procurement.models.vendor_quotation import ProcVendorQuotationHeader  # noqa: E402
from modules.procurement.models.grn import ProcGrnHeader  # noqa: E402
from modules.procurement.models.invoice import ProcInvoiceHeader  # noqa: E402
from modules.procurement.models.return_doc import ProcReturnHeader  # noqa: E402
from modules.procurement.models.contract import ProcVendorContract  # noqa: E402
from modules.procurement.models.performance import ProcVendorPerformance  # noqa: E402

# Analytics / Integration / Ecommerce / Portal
from modules.analytics.models.dashboard import BiDashboard  # noqa: E402
from modules.analytics.models.kpi import BiKpi  # noqa: E402
from modules.analytics.models.metric import BiMetric  # noqa: E402
from modules.analytics.models.dataset import BiDataset  # noqa: E402
from modules.analytics.models.dimension import BiDimension  # noqa: E402
from modules.analytics.models.report import BiReport  # noqa: E402
from modules.analytics.models.alert_rule import BiAlertRule  # noqa: E402
from modules.analytics.models.dashboard_widget import BiDashboardWidget  # noqa: E402
from modules.analytics.models.subscription import BiSubscription  # noqa: E402
from modules.analytics.models.report_schedule import BiReportSchedule  # noqa: E402
from modules.analytics.models.data_import import BiDataImport  # noqa: E402
from modules.analytics.models.data_export import BiDataExport  # noqa: E402
from modules.ecommerce.models.product_listing import EcProductListing  # noqa: E402
from modules.ecommerce.models.sales_channel import EcSalesChannel  # noqa: E402
from modules.ecommerce.models.store import EcStore  # noqa: E402
from modules.ecommerce.models.customer_cart import EcCustomerCart  # noqa: E402
from modules.ecommerce.models.order import EcOrder  # noqa: E402
from modules.ecommerce.models.payment import EcPayment  # noqa: E402
from modules.ecommerce.models.shipment import EcShipment  # noqa: E402
from modules.ecommerce.models.return_request import EcReturnRequest  # noqa: E402
from modules.ecommerce.models.coupon import EcCoupon  # noqa: E402
from modules.ecommerce.models.promotion import EcPromotion  # noqa: E402
from modules.ecommerce.models.marketplace_connector import EcMarketplaceConnector  # noqa: E402
from modules.integration.models.connector import IntConnector  # noqa: E402
from modules.integration.models.external_system import IntExternalSystem  # noqa: E402
from modules.integration.models.api_credential import IntApiCredential  # noqa: E402
from modules.integration.models.oauth_client import IntOauthClient  # noqa: E402
from modules.integration.models.webhook import IntWebhook  # noqa: E402
from modules.integration.models.event_definition import IntEventDefinition  # noqa: E402
from modules.integration.models.message_queue import IntMessageQueue  # noqa: E402
from modules.integration.models.data_mapping import IntDataMapping  # noqa: E402
from modules.integration.models.sync_job import IntSyncJob  # noqa: E402
from modules.integration.models.rate_limit import IntRateLimit  # noqa: E402
from modules.portal.models.portal_account import PtPortalAccount  # noqa: E402
from modules.portal.models.customer_profile import PtCustomerProfile  # noqa: E402
from modules.portal.models.dashboard import PtDashboard  # noqa: E402
from modules.portal.models.notification import PtNotification  # noqa: E402
from modules.portal.models.message_thread import PtMessageThread  # noqa: E402
from modules.portal.models.support_ticket import PtSupportTicket  # noqa: E402
from modules.portal.models.service_request import PtServiceRequest  # noqa: E402
from modules.portal.models.document_access import PtDocumentAccess  # noqa: E402
from modules.portal.models.invoice_view import PtInvoiceView  # noqa: E402
from modules.portal.models.order_view import PtOrderView  # noqa: E402
from modules.portal.models.portal_session import PtPortalSession  # noqa: E402
from modules.portal.models.preference import PtPreference  # noqa: E402
from modules.portal.models.login_audit import PtLoginAudit  # noqa: E402

# Foundation extras
from modules.foundation.models.notification import NtfTemplate  # noqa: E402
from modules.foundation.models.config import CfgSetting  # noqa: E402
from modules.foundation.models.workflow import WfDefinition, WfInstance, WfStep  # noqa: E402


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_one(db, model, **filters):
    stmt = select(model)
    for k, v in filters.items():
        stmt = stmt.where(getattr(model, k) == v)
    if hasattr(model, "is_deleted"):
        stmt = stmt.where(model.is_deleted.is_(False))
    return db.scalar(stmt)


def ensure(db, model, unique: dict, defaults: dict):
    row = get_one(db, model, **unique)
    if row:
        return row
    valid = {c.key for c in model.__table__.columns}
    payload = {**unique, **{k: v for k, v in defaults.items() if v is not None and k in valid}}
    # Drop unique keys not on table (shouldn't happen)
    payload = {k: v for k, v in payload.items() if k in valid or k == "id"}
    row = model(id=uuid4(), **{k: v for k, v in payload.items() if k != "id"})
    db.add(row)
    db.flush()
    return row


def safe(db, label: str, fn):
    """Run a risky single-resource insert inside a SAVEPOINT so a failure
    (bad enum, missing FK, etc.) only rolls back that one resource instead
    of the whole enclosing module transaction."""
    try:
        with db.begin_nested():
            return fn()
    except Exception as exc:  # noqa: BLE001
        print(f"      · skipped {label}: {exc}")
        return None


def touch_names(db, model, unique: dict, name_fields: dict):
    """Backfill human-readable name/title fields on an already-seeded row.

    `ensure()` is idempotent and never updates existing rows, so rows that were
    originally seeded with only a generic code/name need this helper to pick up
    friendlier display names without duplicating the unique key.
    """
    row = get_one(db, model, **unique)
    if row:
        for key, value in name_fields.items():
            if value is not None and hasattr(row, key):
                setattr(row, key, value)
        db.flush()
    return row


def seed_org(db, tenant_id: UUID, company_id: UUID, branch_id: UUID, admin_id: UUID):
    dept = ensure(
        db,
        OrgDepartment,
        {"tenant_id": tenant_id, "company_id": company_id, "department_code": "HR"},
        {
            "branch_id": branch_id,
            "department_name": "Human Resources",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        OrgDepartment,
        {"tenant_id": tenant_id, "company_id": company_id, "department_code": "FIN"},
        {
            "branch_id": branch_id,
            "department_name": "Finance",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        OrgDepartment,
        {"tenant_id": tenant_id, "company_id": company_id, "department_code": "SALES"},
        {
            "branch_id": branch_id,
            "department_name": "Sales",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    bu = ensure(
        db,
        OrgBusinessUnit,
        {"tenant_id": tenant_id, "company_id": company_id, "business_unit_code": "BU-CORP"},
        {
            "branch_id": branch_id,
            "business_unit_name": "Corporate BU",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    loc = ensure(
        db,
        OrgLocation,
        {"tenant_id": tenant_id, "company_id": company_id, "location_code": "LOC-HQ"},
        {
            "branch_id": branch_id,
            "location_name": "HQ Campus",
            "location_type": "office",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    cc = ensure(
        db,
        OrgCostCenter,
        {"tenant_id": tenant_id, "company_id": company_id, "cost_center_code": "CC-100"},
        {
            "cost_center_name": "Admin Cost Center",
            "valid_from": date(2026, 1, 1),
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    pc = safe(
        db,
        "organization.profit-centers",
        lambda: ensure(
            db,
            OrgProfitCenter,
            {"tenant_id": tenant_id, "company_id": company_id, "profit_center_code": "PC-100"},
            {
                "branch_id": branch_id,
                "department_id": dept.id,
                "profit_center_name": "Corporate Profit Center",
                "valid_from": date(2026, 1, 1),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    return dept, bu, loc, cc, pc


def seed_master(db, tenant_id, company_id, branch_id, admin_id, dept_id):
    uom = ensure(
        db,
        MasterUom,
        {"tenant_id": tenant_id, "company_id": company_id, "uom_code": "EA"},
        {
            "uom_name": "Each",
            "uom_type": "count",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        MasterUom,
        {"tenant_id": tenant_id, "company_id": company_id, "uom_code": "KG"},
        {
            "uom_name": "Kilogram",
            "uom_type": "weight",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        MasterCurrency,
        {"tenant_id": tenant_id, "company_id": company_id, "currency_code": "INR"},
        {
            "currency_name": "Indian Rupee",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        MasterCurrency,
        {"tenant_id": tenant_id, "company_id": company_id, "currency_code": "USD"},
        {
            "currency_name": "US Dollar",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        MasterTax,
        {"tenant_id": tenant_id, "company_id": company_id, "tax_code": "GST18"},
        {
            "tax_name": "GST 18%",
            "tax_type": "gst",
            "rate_percent": Decimal("18.00"),
            "effective_from": date(2026, 1, 1),
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    cat = ensure(
        db,
        MasterProductCategory,
        {"tenant_id": tenant_id, "company_id": company_id, "category_code": "CAT-GEN"},
        {
            "category_name": "General Goods",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    product = ensure(
        db,
        MasterProduct,
        {"tenant_id": tenant_id, "company_id": company_id, "product_code": "PRD-1001"},
        {
            "product_name": "Demo Widget",
            "product_type": "goods",
            "uom_id": uom.id,
            "category_id": cat.id if hasattr(MasterProduct, "category_id") else None,
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    # category_id may not exist on product - strip if AttributeError on flush
    product2 = ensure(
        db,
        MasterProduct,
        {"tenant_id": tenant_id, "company_id": company_id, "product_code": "PRD-1002"},
        {
            "product_name": "Demo Service Pack",
            "product_type": "service",
            "uom_id": uom.id,
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    extra_products = []
    for code, name, ptype in [
        ("PRD-1003", "Industrial Sensor Kit", "goods"),
        ("PRD-1004", "Premium Support Plan", "service"),
        ("PRD-1005", "Stainless Fastener Pack", "goods"),
        ("PRD-1006", "ERP Training Hours", "service"),
        ("PRD-1007", "Safety Helmet", "goods"),
    ]:
        extra_products.append(
            ensure(
                db,
                MasterProduct,
                {"tenant_id": tenant_id, "company_id": company_id, "product_code": code},
                {
                    "product_name": name,
                    "product_type": ptype,
                    "uom_id": uom.id,
                    "category_id": cat.id if hasattr(MasterProduct, "category_id") else None,
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            )
        )
    wh = ensure(
        db,
        MasterWarehouse,
        {"tenant_id": tenant_id, "company_id": company_id, "warehouse_code": "WH-HQ"},
        {
            "branch_id": branch_id,
            "warehouse_name": "HQ Warehouse",
            "warehouse_type": "central",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    wh2 = ensure(
        db,
        MasterWarehouse,
        {"tenant_id": tenant_id, "company_id": company_id, "warehouse_code": "WH-2"},
        {
            "branch_id": branch_id,
            "warehouse_name": "Secondary Warehouse",
            "warehouse_type": "transit",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    employees = []
    for idx, (code, first, last, email, desig, mobile_suffix) in enumerate(
        [
            ("EMP-001", "Asha", "Nair", "asha.nair@example.com", "HR Manager", "0001"),
            ("EMP-002", "Rohan", "Mehta", "rohan.mehta@example.com", "Accountant", "0002"),
            ("EMP-003", "Neha", "Kapoor", "neha.kapoor@example.com", "Sales Executive", "0003"),
            ("EMP-004", "Priya", "Sharma", "priya.sharma@example.com", "Software Engineer", "0004"),
            ("EMP-005", "Arjun", "Patel", "arjun.patel@example.com", "Warehouse Supervisor", "0005"),
            ("EMP-006", "Meera", "Iyer", "meera.iyer@example.com", "Quality Analyst", "0006"),
            ("EMP-007", "Kabir", "Singh", "kabir.singh@example.com", "Project Manager", "0007"),
            ("EMP-008", "Sana", "Qureshi", "sana.qureshi@example.com", "Customer Support Lead", "0008"),
        ]
    ):
        emp = ensure(
            db,
            MasterEmployee,
            {"tenant_id": tenant_id, "company_id": company_id, "employee_code": code},
            {
                "branch_id": branch_id,
                "department_id": dept_id,
                "first_name": first,
                "last_name": last,
                "email": email,
                "mobile": f"+91-90000{mobile_suffix}",
                "designation": desig,
                "date_of_joining": date(2024, 4, 1),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
        employees.append(emp)

    extra_customers = []
    for code, name, ctype, email, mobile in [
        ("CUST-004", "Horizon Traders", "corporate", "accounts@horizontraders.example", "+91-90000-10004"),
        ("CUST-005", "BluePeak Industries", "corporate", "billing@bluepeak.example", "+91-90000-10005"),
        ("CUST-006", "Metro Hospitality", "corporate", "finance@metrohospitality.example", "+91-90000-10006"),
        ("CUST-007", "GreenLeaf Foods", "corporate", "ap@greenleaffoods.example", "+91-90000-10007"),
        ("CUST-008", "Apex Logistics", "corporate", "billing@apexlogistics.example", "+91-90000-10008"),
    ]:
        extra_customers.append(
            ensure(
                db,
                MasterCustomer,
                {"tenant_id": tenant_id, "company_id": company_id, "customer_code": code},
                {
                    "branch_id": branch_id,
                    "customer_name": name,
                    "customer_type": ctype,
                    "email": email,
                    "mobile": mobile,
                    "billing_address_json": {
                        "line1": "Sample Street",
                        "city": "Bengaluru",
                        "country_code": "IN",
                    },
                    "shipping_address_json": {
                        "line1": "Warehouse Road",
                        "city": "Bengaluru",
                        "country_code": "IN",
                    },
                    "credit_limit": Decimal("250000.00"),
                    "currency_code": "INR",
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            )
        )

    extra_vendors = []
    for code, name, vtype, email in [
        ("VEND-004", "TechnoParts Supply", "domestic", "sales@technoparts.example"),
        ("VEND-005", "OfficeEssentials Co", "domestic", "orders@officeessentials.example"),
        ("VEND-006", "Precision Tools Ltd", "domestic", "sales@precisiontools.example"),
        ("VEND-007", "CloudSoft Services", "service", "accounts@cloudsoft.example"),
        ("VEND-008", "PackRight Packaging", "domestic", "orders@packright.example"),
    ]:
        extra_vendors.append(
            ensure(
                db,
                MasterVendor,
                {"tenant_id": tenant_id, "company_id": company_id, "vendor_code": code},
                {
                    "branch_id": branch_id,
                    "vendor_name": name,
                    "vendor_type": vtype,
                    "email": email,
                    "mobile": "+91-80000-00000",
                    "payment_terms": "Net 30",
                    "address_json": {"line1": "Vendor Lane", "city": "Chennai", "country_code": "IN"},
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            )
        )

    return uom, product, product2, wh, employees, wh2, extra_products, extra_customers, extra_vendors


def seed_master_asset(db, tenant_id, company_id, branch_id, admin_id, location_id, employees):
    return safe(
        db,
        "master.assets",
        lambda: ensure(
            db,
            MasterAsset,
            {"tenant_id": tenant_id, "company_id": company_id, "asset_code": "DEMO-MASSET-0001"},
            {
                "branch_id": branch_id,
                "asset_name": "Demo Office Laptop",
                "asset_category": "IT Equipment",
                "serial_number": "SN-DEMO-0001",
                "purchase_date": date(2025, 1, 15),
                "purchase_value": Decimal("85000.00"),
                "location_id": location_id,
                "custodian_employee_id": employees[0].id,
                "depreciation_method": "straight_line",
                "useful_life_months": 36,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )


def seed_finance(db, tenant_id, company_id, branch_id, admin_id):
    groups = []
    for code, name, atype in [
        ("AST", "Assets", "asset"),
        ("LIA", "Liabilities", "liability"),
        ("REV", "Revenue", "revenue"),
        ("EXP", "Expenses", "expense"),
    ]:
        groups.append(
            ensure(
                db,
                FinAccountGroup,
                {"tenant_id": tenant_id, "company_id": company_id, "group_code": code},
                {
                    "group_name": name,
                    "account_type": atype,
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            )
        )
    for code, name, grp, atype, bal in [
        ("1000", "Cash", groups[0], "asset", "debit"),
        ("2000", "Accounts Payable", groups[1], "liability", "credit"),
        ("4000", "Sales Revenue", groups[2], "revenue", "credit"),
        ("5000", "Office Expense", groups[3], "expense", "debit"),
    ]:
        ensure(
            db,
            FinChartOfAccount,
            {"tenant_id": tenant_id, "company_id": company_id, "account_code": code},
            {
                "account_group_id": grp.id,
                "account_name": name,
                "account_type": atype,
                "normal_balance": bal,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
    fy = ensure(
        db,
        FinFiscalYear,
        {"tenant_id": tenant_id, "company_id": company_id, "fiscal_year_code": "FY2026"},
        {
            "fiscal_year_name": "FY 2025-26",
            "start_date": date(2025, 4, 1),
            "end_date": date(2026, 3, 31),
            "status": "open",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    period = ensure(
        db,
        FinPeriod,
        {"tenant_id": tenant_id, "company_id": company_id, "fiscal_year_id": fy.id, "period_number": 1},
        {
            "period_name": "Apr 2025",
            "start_date": date(2025, 4, 1),
            "end_date": date(2025, 4, 30),
            "status": "open",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        FinJournalHeader,
        {"tenant_id": tenant_id, "company_id": company_id, "journal_number": "JV-0001"},
        {
            "branch_id": branch_id,
            "journal_date": date(2025, 4, 10),
            "journal_type": "manual",
            "description": "Opening demo journal",
            "fiscal_year_id": fy.id,
            "period_id": period.id,
            "currency_code": "INR",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    return fy, period


def seed_finance_extra(
    db, tenant_id, company_id, branch_id, admin_id, customer, vendor, fy, period, master_asset_id
):
    """AR/AP subledgers, currency rates, and asset transactions (needs master asset)."""
    safe(
        db,
        "finance.ar",
        lambda: ensure(
            db,
            FinCustomerLedger,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-FIN-AR-0001"},
            {
                "branch_id": branch_id,
                "customer_id": customer.id,
                "document_date": date.today(),
                "due_date": date.today() + timedelta(days=30),
                "document_type": "invoice",
                "debit_amount": Decimal("50000.00"),
                "balance_amount": Decimal("50000.00"),
                "currency_code": "INR",
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "finance.ap",
        lambda: ensure(
            db,
            FinVendorLedger,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-FIN-AP-0001"},
            {
                "branch_id": branch_id,
                "vendor_id": vendor.id,
                "document_date": date.today(),
                "due_date": date.today() + timedelta(days=30),
                "document_type": "bill",
                "credit_amount": Decimal("30000.00"),
                "balance_amount": Decimal("30000.00"),
                "currency_code": "INR",
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "finance.currency-rates",
        lambda: ensure(
            db,
            FinCurrencyRate,
            {"tenant_id": tenant_id, "company_id": company_id, "currency_code": "USD", "effective_from": date(2026, 1, 1)},
            {
                "currency_id": get_one(db, MasterCurrency, tenant_id=tenant_id, company_id=company_id, currency_code="USD").id,
                "base_currency_code": "INR",
                "exchange_rate": Decimal("83.25"),
                "rate_type": "daily",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if master_asset_id:
        safe(
            db,
            "finance.asset-transactions",
            lambda: ensure(
                db,
                FinAssetTransaction,
                {"tenant_id": tenant_id, "company_id": company_id, "transaction_number": "DEMO-FIN-AST-0001"},
                {
                    "branch_id": branch_id,
                    "transaction_date": date.today(),
                    "asset_id": master_asset_id,
                    "transaction_type": "acquisition",
                    "amount": Decimal("85000.00"),
                    "currency_code": "INR",
                    "period_id": period.id,
                    "status": "posted",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )


def seed_hr(db, tenant_id, company_id, branch_id, admin_id, employees):
    desig = ensure(
        db,
        HrDesignation,
        {"tenant_id": tenant_id, "company_id": company_id, "designation_code": "DES-MGR"},
        {
            "designation_name": "Manager",
            "job_level": "mid",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        HrDesignation,
        {"tenant_id": tenant_id, "company_id": company_id, "designation_code": "DES-EXE"},
        {
            "designation_name": "Executive",
            "job_level": "junior",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    for code, name, level in [
        ("DES-SWE", "Software Engineer", "mid"),
        ("DES-WHS", "Warehouse Supervisor", "mid"),
        ("DES-QA", "Quality Analyst", "junior"),
        ("DES-PM", "Project Manager", "senior"),
        ("DES-CSL", "Customer Support Lead", "mid"),
    ]:
        ensure(
            db,
            HrDesignation,
            {"tenant_id": tenant_id, "company_id": company_id, "designation_code": code},
            {
                "designation_name": name,
                "job_level": level,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
    leave = ensure(
        db,
        HrLeaveType,
        {"tenant_id": tenant_id, "company_id": company_id, "leave_type_code": "CL"},
        {
            "leave_type_name": "Casual Leave",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        HrLeaveType,
        {"tenant_id": tenant_id, "company_id": company_id, "leave_type_code": "SL"},
        {
            "leave_type_name": "Sick Leave",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    shift = ensure(
        db,
        HrShift,
        {"tenant_id": tenant_id, "company_id": company_id, "shift_code": "GEN"},
        {
            "shift_name": "General Shift",
            "shift_type": "general",
            "start_time": time(9, 0),
            "end_time": time(18, 0),
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    emergency_contacts = {
        "EMP-001": ("Deepa Nair", "+91-90000-20001"),
        "EMP-002": ("Sunil Mehta", "+91-90000-20002"),
        "EMP-003": ("Anjali Kapoor", "+91-90000-20003"),
        "EMP-004": ("Rajesh Sharma", "+91-90000-20004"),
        "EMP-005": ("Kavita Patel", "+91-90000-20005"),
        "EMP-006": ("Suresh Iyer", "+91-90000-20006"),
        "EMP-007": ("Simran Singh", "+91-90000-20007"),
        "EMP-008": ("Imran Qureshi", "+91-90000-20008"),
    }
    for emp in employees:
        contact_name, contact_mobile = emergency_contacts.get(
            getattr(emp, "employee_code", None), (None, None)
        )
        ensure(
            db,
            HrEmployeeProfile,
            {"tenant_id": tenant_id, "employee_id": emp.id},
            {
                "company_id": company_id,
                "branch_id": branch_id,
                "gender": "other",
                "nationality": "Indian",
                "emergency_contact_name": contact_name,
                "emergency_contact_mobile": contact_mobile,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
        # Backfill emergency contact on profiles seeded before this field existed.
        touch_names(
            db,
            HrEmployeeProfile,
            {"tenant_id": tenant_id, "employee_id": emp.id},
            {"emergency_contact_name": contact_name, "emergency_contact_mobile": contact_mobile},
        )
        ensure(
            db,
            HrAttendance,
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "employee_id": emp.id,
                "attendance_date": date.today(),
            },
            {
                "branch_id": branch_id,
                "attendance_status": "present",
                "status": "recorded",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
    ensure(
        db,
        HrLeaveRequest,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "LR-0001"},
        {
            "branch_id": branch_id,
            "employee_id": employees[0].id,
            "leave_type_id": leave.id,
            "start_date": date.today() + timedelta(days=7),
            "end_date": date.today() + timedelta(days=8),
            "days_count": Decimal("2"),
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New HR resources ---
    employment = safe(
        db,
        "hr.employment",
        lambda: ensure(
            db,
            HrEmployment,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-HR-EMPL-0001"},
            {
                "branch_id": branch_id,
                "employee_id": employees[0].id,
                "employment_type": "permanent",
                "date_of_joining": date(2024, 4, 1),
                "ctc_amount": Decimal("600000.00"),
                "currency_code": "INR",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "hr.holiday-calendars",
        lambda: ensure(
            db,
            HrHolidayCalendar,
            {"tenant_id": tenant_id, "company_id": company_id, "calendar_code": "HOL-2026"},
            {
                "branch_id": branch_id,
                "calendar_name": "India National Holidays 2026",
                "calendar_year": 2026,
                "holidays_json": [{"date": "2026-01-26", "name": "Republic Day"}],
                "status": "published",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    # Rename a previously-seeded generic calendar name, if present.
    touch_names(
        db,
        HrHolidayCalendar,
        {"tenant_id": tenant_id, "company_id": company_id, "calendar_code": "HOL-2026"},
        {"calendar_name": "India National Holidays 2026"},
    )
    review = safe(
        db,
        "hr.performance-reviews",
        lambda: ensure(
            db,
            HrPerformanceReview,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-HR-PRF-0001"},
            {
                "branch_id": branch_id,
                "employee_id": employees[0].id,
                "reviewer_employee_id": employees[1].id,
                "review_cycle": "quarterly",
                "period_start": date(2026, 1, 1),
                "period_end": date(2026, 3, 31),
                "overall_rating": 4,
                "status": "in_progress",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if review:
        safe(
            db,
            "hr.goals",
            lambda: ensure(
                db,
                HrGoal,
                {"tenant_id": tenant_id, "company_id": company_id, "performance_review_id": review.id, "sequence_no": 1},
                {
                    "branch_id": branch_id,
                    "employee_id": employees[0].id,
                    "goal_title": "Improve onboarding TAT",
                    "target_value": Decimal("10"),
                    "actual_value": Decimal("7"),
                    "weight_percent": Decimal("30"),
                    "status": "open",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        safe(
            db,
            "hr.appraisals",
            lambda: ensure(
                db,
                HrAppraisal,
                {"tenant_id": tenant_id, "company_id": company_id, "performance_review_id": review.id, "sequence_no": 1},
                {
                    "branch_id": branch_id,
                    "employee_id": employees[0].id,
                    "appraisal_area": "goals",
                    "rating": 4,
                    "comments": "Strong quarter overall.",
                    "status": "final",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    safe(
        db,
        "hr.training",
        lambda: ensure(
            db,
            HrTraining,
            {"tenant_id": tenant_id, "company_id": company_id, "training_code": "TRN-0001"},
            {
                "branch_id": branch_id,
                "training_name": "Workplace Safety Orientation",
                "training_type": "compliance",
                "trainer_name": "External Trainer",
                "start_date": date.today() + timedelta(days=14),
                "end_date": date.today() + timedelta(days=14),
                "status": "planned",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    touch_names(
        db,
        HrTraining,
        {"tenant_id": tenant_id, "company_id": company_id, "training_code": "TRN-0001"},
        {"training_name": "Workplace Safety Orientation"},
    )
    safe(
        db,
        "hr.training",
        lambda: ensure(
            db,
            HrTraining,
            {"tenant_id": tenant_id, "company_id": company_id, "training_code": "TRN-0002"},
            {
                "branch_id": branch_id,
                "training_name": "Advanced Excel for Finance Teams",
                "training_type": "technical",
                "trainer_name": "Internal L&D Team",
                "start_date": date.today() + timedelta(days=21),
                "end_date": date.today() + timedelta(days=21),
                "status": "planned",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "hr.separation",
        lambda: ensure(
            db,
            HrSeparation,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-HR-SEP-0001"},
            {
                "branch_id": branch_id,
                "employee_id": employees[2].id,
                "separation_type": "resignation",
                "requested_last_working_date": date.today() + timedelta(days=30),
                "reason": "Personal reasons",
                "status": "submitted",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "hr.leave-balances",
        lambda: ensure(
            db,
            HrLeaveBalance,
            {
                "company_id": company_id,
                "employee_id": employees[0].id,
                "leave_type_id": leave.id,
                "balance_year": 2026,
            },
            {
                "tenant_id": tenant_id,
                "branch_id": branch_id,
                "opening_balance": Decimal("12"),
                "accrued": Decimal("6"),
                "used": Decimal("2"),
                "closing_balance": Decimal("16"),
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "hr.shift-assignments",
        lambda: ensure(
            db,
            HrShiftAssignment,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-HR-SFA-0001"},
            {
                "branch_id": branch_id,
                "employee_id": employees[0].id,
                "shift_id": shift.id,
                "effective_from": date.today(),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "hr.employee-documents",
        lambda: ensure(
            db,
            HrEmployeeDocument,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-HR-EDOC-0001"},
            {
                "branch_id": branch_id,
                "employee_id": employees[0].id,
                "document_type": "id_proof",
                "document_name": "PAN Card",
                "storage_uri": "https://files.example.com/demo/emp-doc-0001.pdf",
                "issued_on": date(2020, 1, 1),
                "verification_status": "verified",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    return desig, employment


def seed_crm(db, tenant_id, company_id, branch_id, admin_id, employees, customer):
    source = ensure(
        db,
        CrmLeadSource,
        {"tenant_id": tenant_id, "company_id": company_id, "source_code": "WEB"},
        {
            "source_name": "Website",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    for code, name in [
        ("PHONE", "Phone"),
        ("EMAIL", "Email"),
        ("VERBAL", "Verbal Communication"),
        ("REF", "Reference"),
    ]:
        ensure(
            db,
            CrmLeadSource,
            {"tenant_id": tenant_id, "company_id": company_id, "source_code": code},
            {
                "source_name": name,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
    pipeline = ensure(
        db,
        CrmPipeline,
        {"tenant_id": tenant_id, "company_id": company_id, "pipeline_code": "STD"},
        {
            "pipeline_name": "Standard Pipeline",
            "stages_json": [
                {"code": "qualification", "name": "Qualification"},
                {"code": "proposal", "name": "Proposal"},
                {"code": "won", "name": "Won"},
            ],
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    lead = ensure(
        db,
        CrmLead,
        {"tenant_id": tenant_id, "company_id": company_id, "lead_code": "LEAD-001"},
        {
            "branch_id": branch_id,
            "document_date": date.today(),
            "first_name": "Vikram",
            "last_name": "Shah",
            "company_name": "Shah Retail Ventures",
            "mobile": "+91-9888800001",
            "email": "vikram@prospect.example.com",
            "lead_source_id": source.id,
            "owner_employee_id": employees[2].id,
            "status": "new",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    for code, first, last, company_name, mobile, email in [
        ("LEAD-002", "Ritu", "Malhotra", "Horizon Traders", "+91-9888800002", "ritu.malhotra@horizontraders.example"),
        ("LEAD-003", "Farhan", "Ansari", "BluePeak Industries", "+91-9888800003", "farhan.ansari@bluepeak.example"),
        ("LEAD-004", "Divya", "Krishnan", "Metro Hospitality", "+91-9888800004", "divya.krishnan@metrohospitality.example"),
        ("LEAD-005", "Aditya", "Rao", "GreenLeaf Foods", "+91-9888800005", "aditya.rao@greenleaffoods.example"),
    ]:
        ensure(
            db,
            CrmLead,
            {"tenant_id": tenant_id, "company_id": company_id, "lead_code": code},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "first_name": first,
                "last_name": last,
                "company_name": company_name,
                "mobile": mobile,
                "email": email,
                "lead_source_id": source.id,
                "owner_employee_id": employees[2].id,
                "status": "new",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
    opportunity = ensure(
        db,
        CrmOpportunity,
        {"tenant_id": tenant_id, "company_id": company_id, "opportunity_code": "OPP-001"},
        {
            "branch_id": branch_id,
            "opportunity_name": "ERP Expansion Deal",
            "document_date": date.today(),
            "pipeline_id": pipeline.id,
            "owner_employee_id": employees[2].id,
            "current_stage": "qualification",
            "status": "open",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        CrmOpportunity,
        {"tenant_id": tenant_id, "company_id": company_id, "opportunity_code": "OPP-002"},
        {
            "branch_id": branch_id,
            "opportunity_name": "Warehouse Automation Upsell",
            "document_date": date.today(),
            "pipeline_id": pipeline.id,
            "owner_employee_id": employees[2].id,
            "current_stage": "proposal",
            "status": "open",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        CrmCampaign,
        {"tenant_id": tenant_id, "company_id": company_id, "campaign_code": "CAMP-Q2"},
        {
            "campaign_name": "Q2 Outreach",
            "campaign_type": "email",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        CrmCampaign,
        {"tenant_id": tenant_id, "company_id": company_id, "campaign_code": "CAMP-WEBINAR"},
        {
            "campaign_name": "ERP Modernization Webinar Series",
            "campaign_type": "event",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New CRM resources ---
    safe(
        db,
        "crm.interactions",
        lambda: ensure(
            db,
            CrmInteraction,
            {"tenant_id": tenant_id, "company_id": company_id, "interaction_code": "DEMO-CRM-INT-0001"},
            {
                "branch_id": branch_id,
                "interaction_type": "call",
                "interaction_at": utcnow(),
                "lead_id": lead.id,
                "owner_employee_id": employees[2].id,
                "channel": "phone",
                "direction": "outbound",
                "subject": "Intro call",
                "status": "completed",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "crm.tasks",
        lambda: ensure(
            db,
            CrmTask,
            {"tenant_id": tenant_id, "company_id": company_id, "task_code": "DEMO-CRM-TASK-0001"},
            {
                "branch_id": branch_id,
                "title": "Prepare proposal",
                "lead_id": lead.id,
                "owner_employee_id": employees[2].id,
                "due_at": utcnow() + timedelta(days=3),
                "priority": "medium",
                "status": "pending",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "crm.followups",
        lambda: ensure(
            db,
            CrmFollowup,
            {"tenant_id": tenant_id, "company_id": company_id, "followup_code": "DEMO-CRM-FU-0001"},
            {
                "branch_id": branch_id,
                "lead_id": lead.id,
                "owner_employee_id": employees[2].id,
                "followup_at": utcnow() + timedelta(days=2),
                "followup_type": "call",
                "notes": "Check on proposal feedback",
                "status": "scheduled",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "crm.meetings",
        lambda: ensure(
            db,
            CrmMeeting,
            {"tenant_id": tenant_id, "company_id": company_id, "meeting_code": "DEMO-CRM-MTG-0001"},
            {
                "branch_id": branch_id,
                "title": "Discovery Meeting",
                "meeting_date": date.today() + timedelta(days=1),
                "start_time": time(11, 0),
                "end_time": time(12, 0),
                "meeting_mode": "video",
                "opportunity_id": opportunity.id,
                "organizer_employee_id": employees[2].id,
                "status": "scheduled",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "crm.call-logs",
        lambda: ensure(
            db,
            CrmCallLog,
            {"tenant_id": tenant_id, "company_id": company_id, "lead_id": lead.id, "employee_id": employees[2].id, "called_at": utcnow()},
            {
                "branch_id": branch_id,
                "duration_seconds": 300,
                "direction": "outbound",
                "phone_number": "+91-9888800001",
                "outcome": "connected",
                "status": "completed",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "crm.email-logs",
        lambda: ensure(
            db,
            CrmEmailLog,
            {"tenant_id": tenant_id, "company_id": company_id, "lead_id": lead.id, "employee_id": employees[2].id, "sent_at": utcnow()},
            {
                "branch_id": branch_id,
                "direction": "outbound",
                "from_address": "sales@democo.example.com",
                "to_address": "vikram@prospect.example.com",
                "subject": "Following up on our call",
                "status": "sent",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "crm.visit-logs",
        lambda: ensure(
            db,
            CrmVisitLog,
            {"tenant_id": tenant_id, "company_id": company_id, "employee_id": employees[2].id, "visited_at": utcnow()},
            {
                "branch_id": branch_id,
                "customer_id": customer.id,
                "location_text": "Customer HQ",
                "purpose": "Relationship visit",
                "status": "planned",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "crm.customer-feedback",
        lambda: ensure(
            db,
            CrmCustomerFeedback,
            {"tenant_id": tenant_id, "company_id": company_id, "feedback_code": "DEMO-CRM-FBK-0001"},
            {
                "branch_id": branch_id,
                "customer_id": customer.id,
                "feedback_date": date.today(),
                "feedback_type": "general",
                "rating": 4,
                "comments": "Happy with the service",
                "owner_employee_id": employees[2].id,
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "crm.customer-satisfaction",
        lambda: ensure(
            db,
            CrmCustomerSatisfaction,
            {"tenant_id": tenant_id, "company_id": company_id, "customer_id": customer.id, "score_period_start": date(2026, 1, 1)},
            {
                "branch_id": branch_id,
                "score_period_end": date(2026, 3, 31),
                "csat_score": Decimal("88.5"),
                "nps_score": Decimal("42"),
                "survey_count": 5,
                "status": "published",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "crm.lead-assignments",
        lambda: ensure(
            db,
            CrmLeadAssignment,
            {"tenant_id": tenant_id, "company_id": company_id, "lead_id": lead.id, "to_employee_id": employees[2].id},
            {
                "branch_id": branch_id,
                "assignment_type": "manual",
                "assigned_at": utcnow(),
                "assignment_reason": "territory",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "crm.lead-activities",
        lambda: ensure(
            db,
            CrmLeadActivity,
            {"tenant_id": tenant_id, "company_id": company_id, "lead_id": lead.id, "activity_type": "call"},
            {
                "branch_id": branch_id,
                "activity_at": utcnow(),
                "owner_employee_id": employees[2].id,
                "subject": "Intro call",
                "status": "completed",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "crm.opportunity-stages",
        lambda: ensure(
            db,
            CrmOpportunityStage,
            {"tenant_id": tenant_id, "company_id": company_id, "opportunity_id": opportunity.id, "sequence_no": 1},
            {
                "branch_id": branch_id,
                "stage_code": "qualification",
                "stage_name": "Qualification",
                "entered_at": utcnow(),
                "probability_percent": Decimal("20"),
                "changed_by_employee_id": employees[2].id,
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    return lead, opportunity


def seed_sales(db, tenant_id, company_id, branch_id, admin_id, customer, fy, period, product, uom):
    price_list = ensure(
        db,
        SalesPriceList,
        {"tenant_id": tenant_id, "company_id": company_id, "price_list_code": "PL-STD"},
        {
            "price_list_name": "Standard Price List",
            "currency_code": "INR",
            "effective_from": date(2025, 4, 1),
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        SalesQuotationHeader,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "QT-0001"},
        {
            "branch_id": branch_id,
            "document_date": date.today(),
            "valid_until": date.today() + timedelta(days=30),
            "customer_id": customer.id,
            "customer_name": customer.customer_name,
            "currency_code": "INR",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    order = ensure(
        db,
        SalesOrderHeader,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "SO-0001"},
        {
            "branch_id": branch_id,
            "document_date": date.today(),
            "customer_id": customer.id,
            "currency_code": "INR",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    invoice = ensure(
        db,
        SalesInvoiceHeader,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "INV-0001"},
        {
            "branch_id": branch_id,
            "document_date": date.today(),
            "due_date": date.today() + timedelta(days=15),
            "customer_id": customer.id,
            "fiscal_year_id": fy.id,
            "period_id": period.id,
            "currency_code": "INR",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New Sales resources ---
    order_line = safe(
        db,
        "sales.order-lines",
        lambda: ensure(
            db,
            SalesOrderLine,
            {"order_header_id": order.id, "line_number": 1},
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "branch_id": branch_id,
                "product_id": product.id,
                "product_code": product.product_code,
                "product_name": product.product_name,
                "quantity": Decimal("10"),
                "uom_id": uom.id,
                "unit_price": Decimal("500.00"),
                "line_total": Decimal("5000.00"),
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "sales.discount-rules",
        lambda: ensure(
            db,
            SalesDiscountRule,
            {"tenant_id": tenant_id, "company_id": company_id, "discount_code": "DISC-VOL10"},
            {
                "branch_id": branch_id,
                "discount_name": "Volume Discount 10%",
                "discount_type": "percent",
                "discount_value": Decimal("10.00"),
                "price_list_id": price_list.id,
                "effective_from": date(2026, 1, 1),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "sales.customer-credit",
        lambda: ensure(
            db,
            SalesCustomerCredit,
            {"tenant_id": tenant_id, "company_id": company_id, "customer_id": customer.id, "branch_id": branch_id},
            {
                "credit_limit": Decimal("500000.00"),
                "credit_used": Decimal("50000.00"),
                "credit_available": Decimal("450000.00"),
                "currency_code": "INR",
                "payment_terms_days": 30,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if order_line:
        delivery = safe(
            db,
            "sales.deliveries",
            lambda: ensure(
                db,
                SalesDeliveryHeader,
                {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-SALES-DLV-0001"},
                {
                    "branch_id": branch_id,
                    "document_date": date.today(),
                    "order_header_id": order.id,
                    "customer_id": customer.id,
                    "subtotal_amount": Decimal("5000.00"),
                    "status": "draft",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        if delivery:
            safe(
                db,
                "sales.delivery-lines",
                lambda: ensure(
                    db,
                    SalesDeliveryLine,
                    {"delivery_header_id": delivery.id, "line_number": 1},
                    {
                        "tenant_id": tenant_id,
                        "company_id": company_id,
                        "branch_id": branch_id,
                        "order_line_id": order_line.id,
                        "product_id": product.id,
                        "quantity": Decimal("10"),
                        "uom_id": uom.id,
                        "status": "pending",
                        "created_by": admin_id,
                        "updated_by": admin_id,
                    },
                ),
            )
    return_header = safe(
        db,
        "sales.returns",
        lambda: ensure(
            db,
            SalesReturnHeader,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-SALES-RTN-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "customer_id": customer.id,
                "invoice_header_id": invoice.id,
                "order_header_id": order.id,
                "fiscal_year_id": fy.id,
                "period_id": period.id,
                "return_type": "excess_qty",
                "currency_code": "INR",
                "subtotal_amount": Decimal("500.00"),
                "total_amount": Decimal("500.00"),
                "status": "draft",
                "reason": "Customer ordered excess quantity",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if return_header:
        safe(
            db,
            "sales.return-lines",
            lambda: ensure(
                db,
                SalesReturnLine,
                {"return_header_id": return_header.id, "line_number": 1},
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "branch_id": branch_id,
                    "product_id": product.id,
                    "quantity": Decimal("1"),
                    "uom_id": uom.id,
                    "unit_price": Decimal("500.00"),
                    "line_total": Decimal("500.00"),
                    "status": "requested",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )


def seed_procurement(db, tenant_id, company_id, branch_id, admin_id, vendor, employees, dept_id, cc_id):
    ensure(
        db,
        ProcRequisitionHeader,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "PR-0001"},
        {
            "branch_id": branch_id,
            "document_date": date.today(),
            "requester_id": employees[0].id,
            "department_id": dept_id,
            "cost_center_id": cc_id,
            "required_date": date.today() + timedelta(days=14),
            "currency_code": "INR",
            "priority": "medium",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    rfq = ensure(
        db,
        ProcRfqHeader,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "RFQ-0001"},
        {
            "branch_id": branch_id,
            "document_date": date.today(),
            "closing_date": date.today() + timedelta(days=10),
            "currency_code": "INR",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    po = ensure(
        db,
        ProcOrderHeader,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "PO-0001"},
        {
            "branch_id": branch_id,
            "document_date": date.today(),
            "vendor_id": vendor.id,
            "currency_code": "INR",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New Procurement resources ---
    safe(
        db,
        "procurement.vendor-quotations",
        lambda: ensure(
            db,
            ProcVendorQuotationHeader,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PROC-VQ-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "rfq_header_id": rfq.id,
                "vendor_id": vendor.id,
                "valid_until": date.today() + timedelta(days=30),
                "currency_code": "INR",
                "status": "submitted",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "procurement.grns",
        lambda: ensure(
            db,
            ProcGrnHeader,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PROC-GRN-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "order_header_id": po.id,
                "vendor_id": vendor.id,
                "warehouse_reference": uuid4(),
                "status": "received",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    invoice = safe(
        db,
        "procurement.invoices",
        lambda: ensure(
            db,
            ProcInvoiceHeader,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PROC-INV-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "due_date": date.today() + timedelta(days=30),
                "vendor_id": vendor.id,
                "vendor_invoice_number": "VINV-DEMO-0001",
                "order_header_id": po.id,
                "currency_code": "INR",
                "status": "posted",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if invoice:
        safe(
            db,
            "procurement.returns",
            lambda: ensure(
                db,
                ProcReturnHeader,
                {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PROC-RET-0001"},
                {
                    "branch_id": branch_id,
                    "document_date": date.today(),
                    "vendor_id": vendor.id,
                    "invoice_header_id": invoice.id,
                    "order_header_id": po.id,
                    "currency_code": "INR",
                    "status": "requested",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    safe(
        db,
        "procurement.contracts",
        lambda: ensure(
            db,
            ProcVendorContract,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PROC-CTR-0001"},
            {
                "branch_id": branch_id,
                "vendor_id": vendor.id,
                "contract_name": "Annual Supply Agreement",
                "start_date": date(2026, 1, 1),
                "end_date": date(2026, 12, 31),
                "contract_value": Decimal("500000.00"),
                "currency_code": "INR",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "procurement.performance",
        lambda: ensure(
            db,
            ProcVendorPerformance,
            {"tenant_id": tenant_id, "company_id": company_id, "vendor_id": vendor.id, "period_code": "2026-Q1"},
            {
                "branch_id": branch_id,
                "on_time_delivery_pct": Decimal("92.5"),
                "quality_rating": Decimal("88.0"),
                "cost_competitiveness_score": Decimal("80.0"),
                "contract_compliance_score": Decimal("90.0"),
                "overall_score": Decimal("87.6"),
                "calculated_at": utcnow(),
                "status": "current",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    return rfq, po


def seed_inventory(db, tenant_id, company_id, branch_id, admin_id, warehouse, product, uom, warehouse2):
    bin1 = ensure(
        db,
        InvBin,
        {"tenant_id": tenant_id, "company_id": company_id, "warehouse_id": warehouse.id, "bin_code": "A-01"},
        {
            "bin_name": "Aisle A Bin 01",
            "bin_type": "storage",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        InvStockBalance,
        {
            "tenant_id": tenant_id,
            "company_id": company_id,
            "warehouse_id": warehouse.id,
            "product_id": product.id,
        },
        {
            "branch_id": branch_id,
            "uom_id": uom.id,
            "quality_status": "available",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New Inventory resources ---
    batch = safe(
        db,
        "inventory.batches",
        lambda: ensure(
            db,
            InvBatch,
            {"tenant_id": tenant_id, "company_id": company_id, "product_id": product.id, "batch_number": "DEMO-BATCH-0001"},
            {
                "branch_id": branch_id,
                "manufacturing_date": date.today() - timedelta(days=30),
                "expiry_date": date.today() + timedelta(days=335),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "inventory.serials",
        lambda: ensure(
            db,
            InvSerial,
            {"tenant_id": tenant_id, "company_id": company_id, "product_id": product.id, "serial_number": "DEMO-SERIAL-0001"},
            {
                "branch_id": branch_id,
                "batch_id": batch.id if batch else None,
                "warehouse_id": warehouse.id,
                "bin_id": bin1.id,
                "status": "available",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "inventory.reservations",
        lambda: ensure(
            db,
            InvReservation,
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "warehouse_id": warehouse.id,
                "product_id": product.id,
                "source_module": "sales",
                "source_document_type": "sales_order",
                "source_document_id": uuid4(),
            },
            {
                "branch_id": branch_id,
                "uom_id": uom.id,
                "bin_id": bin1.id,
                "quantity_reserved": Decimal("10"),
                "status": "active",
                "reserved_at": utcnow(),
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "inventory.transfers",
        lambda: ensure(
            db,
            InvTransferHeader,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-INV-TRF-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "transfer_type": "warehouse",
                "from_warehouse_id": warehouse.id,
                "to_warehouse_id": warehouse2.id,
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "inventory.adjustments",
        lambda: ensure(
            db,
            InvAdjustmentHeader,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-INV-ADJ-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "warehouse_id": warehouse.id,
                "reason_code": "count_error",
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "inventory.cycle-counts",
        lambda: ensure(
            db,
            InvCycleCountHeader,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-INV-CC-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "count_type": "monthly",
                "warehouse_id": warehouse.id,
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "inventory.policies",
        lambda: ensure(
            db,
            InvReorderPolicy,
            {"tenant_id": tenant_id, "company_id": company_id, "warehouse_id": warehouse.id, "product_id": product.id},
            {
                "branch_id": branch_id,
                "reorder_point": Decimal("20"),
                "safety_stock": Decimal("5"),
                "reorder_qty": Decimal("50"),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )


def seed_mfg(db, tenant_id, company_id, branch_id, admin_id, product, warehouse, uom):
    wc = ensure(
        db,
        MfgWorkCenter,
        {"tenant_id": tenant_id, "company_id": company_id, "work_center_code": "WC-01"},
        {
            "work_center_name": "Assembly Line 1",
            "work_center_type": "machine",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    bom = ensure(
        db,
        MfgBom,
        {"tenant_id": tenant_id, "company_id": company_id, "bom_number": "BOM-0001"},
        {
            "product_id": product.id,
            "effective_from": date(2025, 4, 1),
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    mo = ensure(
        db,
        MfgProductionOrder,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "MO-0001"},
        {
            "branch_id": branch_id,
            "document_date": date.today(),
            "product_id": product.id,
            "bom_id": bom.id,
            "warehouse_id": warehouse.id,
            "planned_qty": Decimal("100"),
            "uom_id": uom.id,
            "status": "released",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New Manufacturing resources ---
    routing = safe(
        db,
        "manufacturing.routings",
        lambda: ensure(
            db,
            MfgRouting,
            {"tenant_id": tenant_id, "company_id": company_id, "routing_code": "RTG-0001"},
            {
                "branch_id": branch_id,
                "routing_name": "Widget Assembly Routing",
                "product_id": product.id,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if routing:
        safe(
            db,
            "manufacturing.routing-operations",
            lambda: ensure(
                db,
                MfgRoutingOperation,
                {"tenant_id": tenant_id, "company_id": company_id, "routing_id": routing.id, "operation_seq": 1},
                {
                    "branch_id": branch_id,
                    "operation_code": "OP-10",
                    "operation_name": "Assembly",
                    "work_center_id": wc.id,
                    "setup_time_minutes": Decimal("15"),
                    "run_time_minutes": Decimal("30"),
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    safe(
        db,
        "manufacturing.machines",
        lambda: ensure(
            db,
            MfgMachine,
            {"tenant_id": tenant_id, "company_id": company_id, "machine_code": "MCH-0001"},
            {
                "branch_id": branch_id,
                "machine_name": "CNC Machine 1",
                "work_center_id": wc.id,
                "status": "idle",
                "last_status_at": utcnow(),
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "manufacturing.material-issues",
        lambda: ensure(
            db,
            MfgMaterialIssue,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-MFG-MI-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "production_order_id": mo.id,
                "warehouse_id": warehouse.id,
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "manufacturing.material-returns",
        lambda: ensure(
            db,
            MfgMaterialReturn,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-MFG-MR-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "production_order_id": mo.id,
                "warehouse_id": warehouse.id,
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "manufacturing.production-receipts",
        lambda: ensure(
            db,
            MfgProductionReceipt,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-MFG-FGR-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "production_order_id": mo.id,
                "warehouse_id": warehouse.id,
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "manufacturing.scrap",
        lambda: ensure(
            db,
            MfgScrap,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-MFG-SCR-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "production_order_id": mo.id,
                "scrap_type": "process",
                "product_id": product.id,
                "quantity": Decimal("2"),
                "uom_id": uom.id,
                "reason_code": "process_loss",
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "manufacturing.wip",
        lambda: ensure(
            db,
            MfgWip,
            {"tenant_id": tenant_id, "company_id": company_id, "production_order_id": mo.id},
            {
                "branch_id": branch_id,
                "material_cost": Decimal("40000.00"),
                "labor_cost": Decimal("10000.00"),
                "overhead_cost": Decimal("5000.00"),
                "total_cost": Decimal("55000.00"),
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "manufacturing.variances",
        lambda: ensure(
            db,
            MfgVariance,
            {"tenant_id": tenant_id, "company_id": company_id, "production_order_id": mo.id, "variance_type": "material"},
            {
                "branch_id": branch_id,
                "standard_amount": Decimal("40000.00"),
                "actual_amount": Decimal("42000.00"),
                "variance_amount": Decimal("2000.00"),
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    return wc, mo


def seed_quality(
    db,
    tenant_id,
    company_id,
    branch_id,
    admin_id,
    warehouse,
    product,
    uom,
    vendor,
    customer,
    employees,
    production_order_id,
):
    plan = ensure(
        db,
        QmInspectionPlan,
        {"tenant_id": tenant_id, "company_id": company_id, "plan_code": "IP-IN"},
        {
            "plan_name": "Incoming Inspection",
            "inspection_type": "incoming",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    defect_type = ensure(
        db,
        QmDefectType,
        {"tenant_id": tenant_id, "company_id": company_id, "defect_type_code": "DT-SCR"},
        {
            "defect_type_name": "Surface Scratch",
            "severity_default": "minor",
            "category": "material",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New Quality resources ---
    safe(
        db,
        "quality.defects",
        lambda: ensure(
            db,
            QmDefect,
            {"tenant_id": tenant_id, "company_id": company_id, "defect_type_id": defect_type.id, "source_inspection_type": "incoming"},
            {
                "branch_id": branch_id,
                "severity": "minor",
                "quantity": Decimal("2"),
                "description": "Minor cosmetic scratch on surface",
                "product_id": product.id,
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "quality.sampling-plans",
        lambda: ensure(
            db,
            QmSamplingPlan,
            {"tenant_id": tenant_id, "company_id": company_id, "sampling_code": "SMP-0001"},
            {
                "branch_id": branch_id,
                "sampling_name": "Standard Sampling",
                "sample_size": Decimal("50"),
                "accept_count": 1,
                "reject_count": 2,
                "aql_percent": Decimal("1.5"),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "quality.characteristics",
        lambda: ensure(
            db,
            QmQualityCharacteristic,
            {"tenant_id": tenant_id, "company_id": company_id, "characteristic_code": "CHR-0001"},
            {
                "branch_id": branch_id,
                "inspection_plan_id": plan.id,
                "characteristic_name": "Dimensional Tolerance",
                "characteristic_type": "numeric",
                "uom_id": uom.id,
                "target_value": Decimal("10"),
                "min_value": Decimal("9.5"),
                "max_value": Decimal("10.5"),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "quality.incoming-inspections",
        lambda: ensure(
            db,
            QmIncomingInspection,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-QM-IQC-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "warehouse_id": warehouse.id,
                "inspection_plan_id": plan.id,
                "vendor_id": vendor.id,
                "product_id": product.id,
                "uom_id": uom.id,
                "inspected_qty": Decimal("100"),
                "accepted_qty": Decimal("95"),
                "rejected_qty": Decimal("5"),
                "result": "accepted",
                "status": "completed",
                "inspector_employee_id": employees[0].id,
                "inspected_at": utcnow(),
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if production_order_id:
        safe(
            db,
            "quality.inprocess-inspections",
            lambda: ensure(
                db,
                QmInprocessInspection,
                {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-QM-IPQC-0001"},
                {
                    "branch_id": branch_id,
                    "document_date": date.today(),
                    "production_order_id": production_order_id,
                    "product_id": product.id,
                    "inspection_plan_id": plan.id,
                    "inspector_employee_id": employees[0].id,
                    "result": "accepted",
                    "status": "completed",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        safe(
            db,
            "quality.final-inspections",
            lambda: ensure(
                db,
                QmFinalInspection,
                {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-QM-FQC-0001"},
                {
                    "branch_id": branch_id,
                    "document_date": date.today(),
                    "production_order_id": production_order_id,
                    "product_id": product.id,
                    "warehouse_id": warehouse.id,
                    "uom_id": uom.id,
                    "inspected_qty": Decimal("100"),
                    "inspection_plan_id": plan.id,
                    "inspector_employee_id": employees[0].id,
                    "result": "approved",
                    "status": "completed",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    ncr = safe(
        db,
        "quality.ncrs",
        lambda: ensure(
            db,
            QmNcr,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-QM-NCR-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "source": "incoming",
                "severity": "minor",
                "description": "Minor surface defect found during incoming inspection",
                "product_id": product.id,
                "vendor_id": vendor.id,
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if ncr:
        safe(
            db,
            "quality.capas",
            lambda: ensure(
                db,
                QmCapa,
                {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-QM-CAPA-0001"},
                {
                    "branch_id": branch_id,
                    "document_date": date.today(),
                    "ncr_id": ncr.id,
                    "capa_type": "corrective",
                    "status": "draft",
                    "owner_employee_id": employees[0].id,
                    "due_date": date.today() + timedelta(days=14),
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    safe(
        db,
        "quality.supplier-quality",
        lambda: ensure(
            db,
            QmSupplierQuality,
            {"tenant_id": tenant_id, "company_id": company_id, "vendor_id": vendor.id, "score_period_start": date(2026, 1, 1)},
            {
                "branch_id": branch_id,
                "score_period_end": date(2026, 3, 31),
                "incoming_accept_rate": Decimal("95.0"),
                "defect_rate": Decimal("2.5"),
                "ncr_count": Decimal("1"),
                "overall_score": Decimal("90.0"),
                "status": "published",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "quality.complaints",
        lambda: ensure(
            db,
            QmCustomerComplaint,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-QM-CMPL-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "customer_id": customer.id,
                "complaint_type": "defective_product",
                "product_id": product.id,
                "quantity": Decimal("2"),
                "description": "Customer reported minor defect",
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "quality.audits",
        lambda: ensure(
            db,
            QmQualityAudit,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-QM-AUD-0001"},
            {
                "branch_id": branch_id,
                "document_date": date.today(),
                "audit_type": "internal",
                "planned_start": date.today() + timedelta(days=7),
                "planned_end": date.today() + timedelta(days=8),
                "status": "planned",
                "lead_auditor_employee_id": employees[0].id,
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "quality.scores",
        lambda: ensure(
            db,
            QmQualityScore,
            {"tenant_id": tenant_id, "company_id": company_id, "score_dimension": "company", "period_start": date(2026, 1, 1)},
            {
                "branch_id": branch_id,
                "period_end": date(2026, 3, 31),
                "first_pass_yield": Decimal("96.5"),
                "defect_rate": Decimal("1.2"),
                "rework_rate": Decimal("0.8"),
                "complaint_rate": Decimal("0.3"),
                "supplier_quality_score": Decimal("90.0"),
                "status": "published",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )


def seed_payroll(db, tenant_id, company_id, branch_id, admin_id, employees, dept_id, employment_id):
    period = ensure(
        db,
        PayPayrollPeriod,
        {"tenant_id": tenant_id, "company_id": company_id, "period_code": "2026-04"},
        {
            "period_name": "April 2026",
            "payroll_year": 2026,
            "payroll_month": 4,
            "start_date": date(2026, 4, 1),
            "end_date": date(2026, 4, 30),
            "status": "open",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    structure = ensure(
        db,
        PaySalaryStructure,
        {"tenant_id": tenant_id, "company_id": company_id, "structure_code": "SS-STD"},
        {
            "structure_name": "Standard Structure",
            "effective_from": date(2025, 4, 1),
            "currency_code": "INR",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    earning_type = ensure(
        db,
        PayEarningType,
        {"tenant_id": tenant_id, "company_id": company_id, "earning_type_code": "BASIC"},
        {
            "earning_type_name": "Basic Pay",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New Payroll resources ---
    safe(
        db,
        "payroll.salary-components",
        lambda: ensure(
            db,
            PaySalaryComponent,
            {"tenant_id": tenant_id, "company_id": company_id, "component_code": "COMP-BASIC"},
            {
                "branch_id": branch_id,
                "component_name": "Basic Pay Component",
                "component_class": "earning",
                "earning_type_id": earning_type.id,
                "calculation_method": "fixed",
                "is_taxable": True,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if employment_id:
        safe(
            db,
            "payroll.employee-salaries",
            lambda: ensure(
                db,
                PayEmployeeSalary,
                {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PAY-ESAL-0001"},
                {
                    "branch_id": branch_id,
                    "employee_id": employees[0].id,
                    "salary_structure_id": structure.id,
                    "employment_id": employment_id,
                    "department_id": dept_id,
                    "effective_from": date(2026, 4, 1),
                    "ctc_amount": Decimal("600000.00"),
                    "gross_amount": Decimal("500000.00"),
                    "currency_code": "INR",
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    deduction_type = safe(
        db,
        "payroll.deduction-types",
        lambda: ensure(
            db,
            PayDeductionType,
            {"tenant_id": tenant_id, "company_id": company_id, "deduction_type_code": "PF"},
            {
                "branch_id": branch_id,
                "deduction_type_name": "Provident Fund",
                "is_statutory": True,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "payroll.tax-configurations",
        lambda: ensure(
            db,
            PayTaxConfiguration,
            {"tenant_id": tenant_id, "company_id": company_id, "tax_config_code": "TAX-IT-2026"},
            {
                "branch_id": branch_id,
                "tax_config_name": "Income Tax Slabs FY26",
                "tax_type": "income_tax",
                "effective_from": date(2026, 4, 1),
                "slabs_json": [{"upto": 500000, "rate": 0}],
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "payroll.statutory-contributions",
        lambda: ensure(
            db,
            PayStatutoryContribution,
            {"tenant_id": tenant_id, "company_id": company_id, "contribution_code": "PF-CONTRIB"},
            {
                "branch_id": branch_id,
                "contribution_name": "PF Contribution",
                "employee_rate_percent": Decimal("12.0000"),
                "employer_rate_percent": Decimal("12.0000"),
                "wage_ceiling_amount": Decimal("15000.00"),
                "effective_from": date(2026, 4, 1),
                "salary_component_id": None,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "payroll.payroll-runs",
        lambda: ensure(
            db,
            PayPayrollRun,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PAY-RUN-0001"},
            {
                "branch_id": branch_id,
                "payroll_period_id": period.id,
                "run_date": date(2026, 4, 30),
                "run_type": "regular",
                "employee_count": 3,
                "total_gross": Decimal("150000.00"),
                "total_deduction": Decimal("18000.00"),
                "total_net": Decimal("132000.00"),
                "total_employer_cost": Decimal("18000.00"),
                "currency_code": "INR",
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "payroll.bonuses",
        lambda: ensure(
            db,
            PayBonus,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PAY-BON-0001"},
            {
                "branch_id": branch_id,
                "employee_id": employees[0].id,
                "payroll_period_id": period.id,
                "bonus_type": "performance",
                "amount": Decimal("25000.00"),
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "payroll.reimbursements",
        lambda: ensure(
            db,
            PayReimbursement,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PAY-REIM-0001"},
            {
                "branch_id": branch_id,
                "employee_id": employees[0].id,
                "payroll_period_id": period.id,
                "reimbursement_type": "travel",
                "claim_amount": Decimal("3500.00"),
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "payroll.loans",
        lambda: ensure(
            db,
            PayLoan,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PAY-LOAN-0001"},
            {
                "branch_id": branch_id,
                "employee_id": employees[0].id,
                "loan_type": "personal",
                "principal_amount": Decimal("100000.00"),
                "emi_amount": Decimal("10000.00"),
                "interest_rate": Decimal("8.5"),
                "installment_count": 10,
                "start_date": date(2026, 4, 1),
                "outstanding_amount": Decimal("100000.00"),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "payroll.payroll-adjustments",
        lambda: ensure(
            db,
            PayPayrollAdjustment,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PAY-ADJ-0001"},
            {
                "branch_id": branch_id,
                "employee_id": employees[0].id,
                "payroll_period_id": period.id,
                "salary_component_id": None,
                "adjustment_type": "earning",
                "amount": Decimal("2000.00"),
                "reason": "One-off correction",
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    return period, structure


def seed_recruitment(db, tenant_id, company_id, branch_id, admin_id, dept_id, employees):
    req = ensure(
        db,
        RecJobRequisition,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "JR-0001"},
        {
            "branch_id": branch_id,
            "requisition_title": "Software Engineer",
            "department_id": dept_id,
            "employment_type": "permanent",
            "openings_count": 2,
            "hiring_manager_employee_id": employees[0].id,
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    posting = ensure(
        db,
        RecJobPosting,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "JP-0001"},
        {
            "job_requisition_id": req.id,
            "posting_title": "Software Engineer - Bengaluru",
            "channel": "career_site",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    req2 = ensure(
        db,
        RecJobRequisition,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "JR-0002"},
        {
            "branch_id": branch_id,
            "requisition_title": "Senior Backend Engineer",
            "department_id": dept_id,
            "employment_type": "permanent",
            "openings_count": 1,
            "hiring_manager_employee_id": employees[0].id,
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        RecJobPosting,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "JP-0002"},
        {
            "job_requisition_id": req2.id,
            "posting_title": "Senior Backend Engineer",
            "channel": "career_site",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    candidate = ensure(
        db,
        RecCandidate,
        {"tenant_id": tenant_id, "company_id": company_id, "candidate_code": "CAND-001"},
        {
            "first_name": "Ankit",
            "last_name": "Verma",
            "full_name": "Ankit Verma",
            "email": "ankit.verma@example.com",
            "status": "prospect",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    for code, first, last, email in [
        ("CAND-002", "Sneha", "Reddy", "sneha.reddy@example.com"),
        ("CAND-003", "Tarun", "Gupta", "tarun.gupta@example.com"),
        ("CAND-004", "Ishita", "Bose", "ishita.bose@example.com"),
    ]:
        ensure(
            db,
            RecCandidate,
            {"tenant_id": tenant_id, "company_id": company_id, "candidate_code": code},
            {
                "first_name": first,
                "last_name": last,
                "full_name": f"{first} {last}",
                "email": email,
                "status": "prospect",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )

    # --- New Recruitment resources ---
    source = safe(
        db,
        "recruitment.recruitment-sources",
        lambda: ensure(
            db,
            RecRecruitmentSource,
            {"tenant_id": tenant_id, "company_id": company_id, "source_code": "SRC-CAREER"},
            {
                "branch_id": branch_id,
                "source_name": "Career Site",
                "source_type": "organic",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    recruiter = safe(
        db,
        "recruitment.recruiters",
        lambda: ensure(
            db,
            RecRecruiter,
            {"tenant_id": tenant_id, "company_id": company_id, "employee_id": employees[0].id},
            {
                "branch_id": branch_id,
                "recruiter_code": "RCR-0001",
                "display_name": f"{employees[0].first_name} {employees[0].last_name}",
                "max_open_requisitions": 10,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    application = safe(
        db,
        "recruitment.applications",
        lambda: ensure(
            db,
            RecApplication,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-REC-APP-0001"},
            {
                "branch_id": branch_id,
                "candidate_id": candidate.id,
                "job_requisition_id": req.id,
                "job_posting_id": posting.id if posting else None,
                "recruitment_source_id": source.id if source else None,
                "recruiter_id": recruiter.id if recruiter else None,
                "applied_at": utcnow(),
                "current_stage_code": "screening",
                "status": "screening",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if application:
        safe(
            db,
            "recruitment.application-stages",
            lambda: ensure(
                db,
                RecApplicationStage,
                {"application_id": application.id, "stage_code": "applied"},
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "branch_id": branch_id,
                    "stage_name": "Applied",
                    "sequence_no": 1,
                    "entered_at": utcnow() - timedelta(days=2),
                    "changed_by_user_id": admin_id,
                    "status": "completed",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    interview = None
    if application:
        interview = safe(
            db,
            "recruitment.interviews",
            lambda: ensure(
                db,
                RecInterview,
                {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-REC-INT-0001"},
                {
                    "branch_id": branch_id,
                    "application_id": application.id,
                    "candidate_id": candidate.id,
                    "interview_type": "technical",
                    "scheduled_at": utcnow() + timedelta(days=2),
                    "duration_minutes": 45,
                    "interviewer_employee_id": employees[0].id,
                    "result": "pending",
                    "status": "scheduled",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    if interview:
        safe(
            db,
            "recruitment.interview-feedback",
            lambda: ensure(
                db,
                RecInterviewFeedback,
                {"interview_id": interview.id, "interviewer_employee_id": employees[0].id},
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "branch_id": branch_id,
                    "overall_score": Decimal("8.5"),
                    "recommendation": "hire",
                    "comments": "Strong problem solving skills",
                    "submitted_at": utcnow(),
                    "status": "submitted",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    offer = None
    if application:
        offer = safe(
            db,
            "recruitment.offers",
            lambda: ensure(
                db,
                RecOffer,
                {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-REC-OFR-0001"},
                {
                    "branch_id": branch_id,
                    "application_id": application.id,
                    "candidate_id": candidate.id,
                    "job_requisition_id": req.id,
                    "department_id": dept_id,
                    "offered_ctc": Decimal("1200000.00"),
                    "offered_gross": Decimal("100000.00"),
                    "currency_code": "INR",
                    "joining_date": date.today() + timedelta(days=30),
                    "offer_valid_until": date.today() + timedelta(days=14),
                    "employment_type": "permanent",
                    "status": "draft",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    safe(
        db,
        "recruitment.background-verifications",
        lambda: ensure(
            db,
            RecBackgroundVerification,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-REC-BGV-0001"},
            {
                "branch_id": branch_id,
                "candidate_id": candidate.id,
                "offer_id": offer.id if offer else None,
                "application_id": application.id if application else None,
                "vendor_name": "SecureCheck Verifications",
                "initiated_at": utcnow(),
                "result": "pending",
                "status": "in_progress",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "recruitment.talent-pools",
        lambda: ensure(
            db,
            RecTalentPool,
            {"tenant_id": tenant_id, "company_id": company_id, "pool_code": "TP-ENG", "candidate_id": candidate.id},
            {
                "branch_id": branch_id,
                "pool_name": "Engineering Talent Pool",
                "availability": "passive",
                "added_at": utcnow(),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    onboarding = None
    if offer:
        onboarding = safe(
            db,
            "recruitment.onboarding",
            lambda: ensure(
                db,
                RecOnboarding,
                {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-REC-ONB-0001"},
                {
                    "branch_id": branch_id,
                    "offer_id": offer.id,
                    "candidate_id": candidate.id,
                    "application_id": application.id,
                    "job_requisition_id": req.id,
                    "department_id": dept_id,
                    "planned_joining_date": offer.joining_date,
                    "payroll_handoff_status": "pending",
                    "status": "draft",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    if onboarding:
        safe(
            db,
            "recruitment.onboarding-tasks",
            lambda: ensure(
                db,
                RecOnboardingTask,
                {"onboarding_id": onboarding.id, "task_code": "IT-SETUP"},
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "branch_id": branch_id,
                    "task_name": "Provision laptop and accounts",
                    "sequence_no": 1,
                    "is_mandatory": True,
                    "due_date": date.today() + timedelta(days=25),
                    "assignee_employee_id": employees[0].id,
                    "status": "pending",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )


def seed_projects(db, tenant_id, company_id, branch_id, admin_id, employees):
    project = ensure(
        db,
        PrjProject,
        {"tenant_id": tenant_id, "company_id": company_id, "project_code": "PRJ-ERP"},
        {
            "branch_id": branch_id,
            "project_name": "ERP Rollout Phase 1",
            "project_type": "internal",
            "project_manager_employee_id": employees[0].id,
            "planned_start_date": date(2026, 1, 1),
            "planned_end_date": date(2026, 12, 31),
            "currency_code": "INR",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    # Rename a previously-seeded project with the old generic name.
    touch_names(
        db,
        PrjProject,
        {"tenant_id": tenant_id, "company_id": company_id, "project_code": "PRJ-ERP"},
        {"project_name": "ERP Rollout Phase 1"},
    )
    ensure(
        db,
        PrjProject,
        {"tenant_id": tenant_id, "company_id": company_id, "project_code": "PRJ-WMS"},
        {
            "branch_id": branch_id,
            "project_name": "Warehouse Digitization",
            "project_type": "internal",
            "project_manager_employee_id": employees[4].id if len(employees) > 4 else employees[0].id,
            "planned_start_date": date(2026, 2, 1),
            "planned_end_date": date(2026, 9, 30),
            "currency_code": "INR",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        PrjProject,
        {"tenant_id": tenant_id, "company_id": company_id, "project_code": "PRJ-PORTAL"},
        {
            "branch_id": branch_id,
            "project_name": "Customer Portal Revamp",
            "project_type": "customer",
            "project_manager_employee_id": employees[6].id if len(employees) > 6 else employees[0].id,
            "planned_start_date": date(2026, 3, 1),
            "planned_end_date": date(2026, 8, 31),
            "currency_code": "INR",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    task = ensure(
        db,
        PrjProjectTask,
        {"tenant_id": tenant_id, "company_id": company_id, "project_id": project.id, "task_name": "Discovery"},
        {
            "branch_id": branch_id,
            "priority": "medium",
            "status": "open",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ts = ensure(
        db,
        PrjTimesheet,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "TS-0001"},
        {
            "branch_id": branch_id,
            "employee_id": employees[0].id,
            "period_start": date.today() - timedelta(days=7),
            "period_end": date.today(),
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New Project resources ---
    phase = safe(
        db,
        "projects.project-phases",
        lambda: ensure(
            db,
            PrjProjectPhase,
            {"project_id": project.id, "phase_code": "PH-01"},
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "branch_id": branch_id,
                "phase_name": "Discovery & Planning",
                "sequence_no": 1,
                "planned_start_date": date(2026, 1, 1),
                "planned_end_date": date(2026, 2, 28),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "projects.project-milestones",
        lambda: ensure(
            db,
            PrjProjectMilestone,
            {"project_id": project.id, "milestone_code": "MS-01"},
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "branch_id": branch_id,
                "phase_id": phase.id if phase else None,
                "milestone_name": "Requirements Signed Off",
                "owner_employee_id": employees[0].id,
                "due_date": date(2026, 2, 15),
                "status": "planned",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    resource_plan = safe(
        db,
        "projects.resource-plans",
        lambda: ensure(
            db,
            PrjResourcePlan,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PRJ-RP-0001"},
            {
                "branch_id": branch_id,
                "project_id": project.id,
                "plan_name": "Core Team Allocation",
                "planned_from": date(2026, 1, 1),
                "planned_to": date(2026, 6, 30),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if resource_plan:
        safe(
            db,
            "projects.resource-allocations",
            lambda: ensure(
                db,
                PrjResourceAllocation,
                {"resource_plan_id": resource_plan.id, "project_id": project.id, "employee_id": employees[0].id},
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "branch_id": branch_id,
                    "resource_type": "employee",
                    "allocation_percent": Decimal("50.00"),
                    "start_date": date(2026, 1, 1),
                    "end_date": date(2026, 6, 30),
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    timesheet_entry = safe(
        db,
        "projects.timesheet-entries",
        lambda: ensure(
            db,
            PrjTimesheetEntry,
            {"timesheet_id": ts.id, "task_id": task.id, "work_date": date.today()},
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "branch_id": branch_id,
                "project_id": project.id,
                "employee_id": employees[0].id,
                "hours_worked": Decimal("8.00"),
                "description": "Discovery workshops with stakeholders",
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if timesheet_entry:
        safe(
            db,
            "projects.project-costs",
            lambda: ensure(
                db,
                PrjProjectCost,
                {"tenant_id": tenant_id, "company_id": company_id, "idempotency_key": "DEMO-PRJ-COST-0001"},
                {
                    "document_number": "DEMO-PRJ-COST-0001",
                    "branch_id": branch_id,
                    "project_id": project.id,
                    "cost_source": "payroll",
                    "cost_amount": Decimal("32000.00"),
                    "currency_code": "INR",
                    "cost_date": date.today(),
                    "employee_id": employees[0].id,
                    "timesheet_entry_id": timesheet_entry.id,
                    "status": "draft",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    safe(
        db,
        "projects.project-budgets",
        lambda: ensure(
            db,
            PrjProjectBudget,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PRJ-BUD-0001"},
            {
                "branch_id": branch_id,
                "project_id": project.id,
                "budget_type": "labor",
                "budget_amount": Decimal("2000000.00"),
                "currency_code": "INR",
                "status": "approved",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "projects.project-issues",
        lambda: ensure(
            db,
            PrjProjectIssue,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PRJ-ISS-0001"},
            {
                "branch_id": branch_id,
                "project_id": project.id,
                "issue_title": "Data migration delay risk",
                "severity": "medium",
                "owner_employee_id": employees[0].id,
                "opened_at": utcnow(),
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "projects.project-risks",
        lambda: ensure(
            db,
            PrjProjectRisk,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PRJ-RSK-0001"},
            {
                "branch_id": branch_id,
                "project_id": project.id,
                "risk_name": "Vendor delivery slippage",
                "impact": "medium",
                "probability": "medium",
                "risk_level": "medium",
                "owner_employee_id": employees[0].id,
                "mitigation_plan": "Weekly vendor checkpoint calls",
                "review_date": date.today() + timedelta(days=30),
                "status": "identified",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "projects.change-requests",
        lambda: ensure(
            db,
            PrjChangeRequest,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-PRJ-CR-0001"},
            {
                "branch_id": branch_id,
                "project_id": project.id,
                "change_title": "Add mobile app module",
                "change_type": "scope",
                "requested_by_employee_id": employees[0].id,
                "impact_summary": "Additional 6 weeks of effort",
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "projects.project-documents",
        lambda: ensure(
            db,
            PrjProjectDocument,
            {"tenant_id": tenant_id, "company_id": company_id, "project_id": project.id, "document_name": "ERP Rollout Charter.pdf"},
            {
                "branch_id": branch_id,
                "document_type": "brd",
                "storage_uri": "https://files.example.com/demo/erp-rollout-charter.pdf",
                "uploaded_by_employee_id": employees[0].id,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    return project


def seed_assets(db, tenant_id, company_id, branch_id, admin_id, dept_id, employees, vendor):
    cat = ensure(
        db,
        AstAssetCategory,
        {"tenant_id": tenant_id, "company_id": company_id, "category_code": "IT"},
        {
            "category_name": "IT Equipment",
            "default_useful_life_months": 36,
            "default_depreciation_method": "straight_line",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    laptop_custodian = employees[3] if len(employees) > 3 else employees[0]
    asset = ensure(
        db,
        AstAsset,
        {"tenant_id": tenant_id, "company_id": company_id, "asset_code": "AST-LAP-001"},
        {
            "branch_id": branch_id,
            "document_number": "AST-0001",
            "asset_name": f"Dell Latitude 5540 — {laptop_custodian.first_name}",
            "asset_category_id": cat.id,
            "asset_type": "fixed",
            "supplier_vendor_id": vendor.id,
            "serial_number": "SN-AST-0001",
            "purchase_date": date(2025, 6, 1),
            "purchase_cost": Decimal("95000.00"),
            "current_book_value": Decimal("85000.00"),
            "salvage_value": Decimal("5000.00"),
            "currency_code": "INR",
            "depreciation_method": "straight_line",
            "useful_life_months": 36,
            "department_id": dept_id,
            "custodian_employee_id": laptop_custodian.id,
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    # Rename a previously-seeded generic laptop asset name.
    touch_names(
        db,
        AstAsset,
        {"tenant_id": tenant_id, "company_id": company_id, "asset_code": "AST-LAP-001"},
        {"asset_name": f"Dell Latitude 5540 — {laptop_custodian.first_name}"},
    )
    ensure(
        db,
        AstAsset,
        {"tenant_id": tenant_id, "company_id": company_id, "asset_code": "AST-PROJ-001"},
        {
            "branch_id": branch_id,
            "document_number": "AST-0002",
            "asset_name": "Conference Room Projector",
            "asset_category_id": cat.id,
            "asset_type": "fixed",
            "supplier_vendor_id": vendor.id,
            "serial_number": "SN-AST-0002",
            "purchase_date": date(2025, 3, 10),
            "purchase_cost": Decimal("65000.00"),
            "current_book_value": Decimal("58000.00"),
            "salvage_value": Decimal("2000.00"),
            "currency_code": "INR",
            "depreciation_method": "straight_line",
            "useful_life_months": 60,
            "department_id": dept_id,
            "custodian_employee_id": employees[0].id,
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        AstAsset,
        {"tenant_id": tenant_id, "company_id": company_id, "asset_code": "AST-VEH-001"},
        {
            "branch_id": branch_id,
            "document_number": "AST-0003",
            "asset_name": "Toyota Innova Fleet Vehicle",
            "asset_category_id": cat.id,
            "asset_type": "fixed",
            "supplier_vendor_id": vendor.id,
            "serial_number": "SN-AST-0003",
            "purchase_date": date(2024, 11, 20),
            "purchase_cost": Decimal("1850000.00"),
            "current_book_value": Decimal("1600000.00"),
            "salvage_value": Decimal("200000.00"),
            "currency_code": "INR",
            "depreciation_method": "straight_line",
            "useful_life_months": 96,
            "department_id": dept_id,
            "custodian_employee_id": employees[4].id if len(employees) > 4 else employees[0].id,
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New Asset resources ---
    safe(
        db,
        "assets.asset-locations",
        lambda: ensure(
            db,
            AstAssetLocation,
            {"tenant_id": tenant_id, "company_id": company_id, "asset_id": asset.id, "location_label": "HQ - Floor 2"},
            {
                "branch_id": branch_id,
                "effective_from": utcnow() - timedelta(days=30),
                "is_current": True,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "assets.asset-warranties",
        lambda: ensure(
            db,
            AstAssetWarranty,
            {"tenant_id": tenant_id, "company_id": company_id, "asset_id": asset.id, "warranty_type": "manufacturer"},
            {
                "branch_id": branch_id,
                "vendor_id": vendor.id,
                "start_date": date(2025, 6, 1),
                "end_date": date(2028, 5, 31),
                "coverage_notes": "Standard manufacturer warranty",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "assets.asset-insurances",
        lambda: ensure(
            db,
            AstAssetInsurance,
            {"tenant_id": tenant_id, "company_id": company_id, "asset_id": asset.id, "policy_number": "POL-AST-0001"},
            {
                "branch_id": branch_id,
                "insurer_name": "Global Insurance Co",
                "vendor_id": vendor.id,
                "coverage_amount": Decimal("90000.00"),
                "start_date": date(2026, 1, 1),
                "end_date": date(2026, 12, 31),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    plan = safe(
        db,
        "assets.maintenance-plans",
        lambda: ensure(
            db,
            AstAssetMaintenancePlan,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-AST-MP-0001"},
            {
                "branch_id": branch_id,
                "asset_id": asset.id,
                "plan_name": "Annual Laptop Service",
                "maintenance_type": "annual_service",
                "frequency_days": 365,
                "next_due_date": date.today() + timedelta(days=180),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "assets.asset-assignments",
        lambda: ensure(
            db,
            AstAssetAssignment,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-AST-ASG-0001"},
            {
                "branch_id": branch_id,
                "asset_id": asset.id,
                "allocation_type": "employee",
                "employee_id": employees[0].id,
                "department_id": dept_id,
                "allocated_at": utcnow() - timedelta(days=30),
                "expected_return_at": date.today() + timedelta(days=335),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "assets.asset-components",
        lambda: ensure(
            db,
            AstAssetComponent,
            {"tenant_id": tenant_id, "company_id": company_id, "asset_id": asset.id, "component_code": "CMP-BATT"},
            {
                "branch_id": branch_id,
                "component_name": "Battery",
                "serial_number": "BATT-0001",
                "quantity": Decimal("1"),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "assets.meter-readings",
        lambda: ensure(
            db,
            AstAssetMeterReading,
            {"tenant_id": tenant_id, "company_id": company_id, "asset_id": asset.id, "reading_at": utcnow()},
            {
                "branch_id": branch_id,
                "meter_type": "runtime_hours",
                "reading_value": Decimal("1200.5"),
                "recorded_by_employee_id": employees[0].id,
                "status": "recorded",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "assets.asset-maintenances",
        lambda: ensure(
            db,
            AstAssetMaintenance,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-AST-MNT-0001"},
            {
                "branch_id": branch_id,
                "asset_id": asset.id,
                "maintenance_plan_id": plan.id if plan else None,
                "maintenance_type": "annual_service",
                "scheduled_date": date.today() + timedelta(days=30),
                "vendor_id": vendor.id,
                "cost_amount": Decimal("2500.00"),
                "technician_employee_id": employees[0].id,
                "status": "scheduled",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "assets.asset-depreciations",
        lambda: ensure(
            db,
            AstAssetDepreciation,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-AST-DEP-0001"},
            {
                "branch_id": branch_id,
                "asset_id": asset.id,
                "period_year": 2026,
                "period_month": 1,
                "method": "straight_line",
                "depreciation_amount": Decimal("2500.00"),
                "book_value_after": Decimal("82500.00"),
                "idempotency_key": "DEMO-AST-DEP-2026-01",
                "status": "calculated",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "assets.asset-disposals",
        lambda: ensure(
            db,
            AstAssetDisposal,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-AST-DSP-0001"},
            {
                "branch_id": branch_id,
                "asset_id": asset.id,
                "disposal_type": "sale",
                "disposal_date": date.today() + timedelta(days=700),
                "proceeds_amount": Decimal("20000.00"),
                "book_value_at_disposal": Decimal("15000.00"),
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "assets.asset-audits",
        lambda: ensure(
            db,
            AstAssetAudit,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-AST-AUD-0001"},
            {
                "branch_id": branch_id,
                "asset_id": asset.id,
                "audit_date": date.today(),
                "auditor_employee_id": employees[0].id,
                "found_status": "found",
                "notes": "Asset verified at assigned location",
                "status": "completed",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "assets.asset-transfers",
        lambda: ensure(
            db,
            AstAssetTransfer,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-AST-TRF-0001"},
            {
                "branch_id": branch_id,
                "asset_id": asset.id,
                "from_branch_id": branch_id,
                "to_branch_id": branch_id,
                "from_department_id": dept_id,
                "to_department_id": dept_id,
                "from_employee_id": employees[0].id,
                "to_employee_id": employees[0].id,
                "transferred_at": utcnow(),
                "reason": "Internal transfer for demo purposes",
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )


def seed_service(db, tenant_id, company_id, branch_id, admin_id, customer, employees, product):
    cat = ensure(
        db,
        SvcServiceCategory,
        {"tenant_id": tenant_id, "company_id": company_id, "category_code": "SVC-GEN"},
        {
            "category_name": "General Service",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    req = ensure(
        db,
        SvcServiceRequest,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "SR-0001"},
        {
            "branch_id": branch_id,
            "category_id": cat.id,
            "customer_id": customer.id,
            "service_type": "corrective",
            "subject": "Machine not starting",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        SvcServiceTicket,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "ST-0001"},
        {
            "branch_id": branch_id,
            "request_id": req.id,
            "ticket_type": "incident",
            "status": "open",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    for doc_number, subject, service_type in [
        ("SR-0002", "AC repair — Floor 2", "corrective"),
        ("SR-0003", "Laptop screen replacement", "corrective"),
    ]:
        ensure(
            db,
            SvcServiceRequest,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": doc_number},
            {
                "branch_id": branch_id,
                "category_id": cat.id,
                "customer_id": customer.id,
                "service_type": service_type,
                "subject": subject,
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )

    # --- New Service resources ---
    work_order = safe(
        db,
        "service.work-orders",
        lambda: ensure(
            db,
            SvcServiceWorkOrder,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-SVC-WO-0001"},
            {
                "branch_id": branch_id,
                "request_id": req.id,
                "work_order_type": "corrective",
                "primary_technician_id": employees[0].id,
                "scheduled_date": date.today() + timedelta(days=1),
                "status": "assigned",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if work_order:
        safe(
            db,
            "service.service-schedules",
            lambda: ensure(
                db,
                SvcServiceSchedule,
                {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-SVC-SCH-0001"},
                {
                    "branch_id": branch_id,
                    "work_order_id": work_order.id,
                    "technician_employee_id": employees[0].id,
                    "planned_start": utcnow() + timedelta(days=1),
                    "planned_end": utcnow() + timedelta(days=1, hours=2),
                    "status": "planned",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        safe(
            db,
            "service.service-visits",
            lambda: ensure(
                db,
                SvcServiceVisit,
                {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-SVC-VST-0001"},
                {
                    "branch_id": branch_id,
                    "work_order_id": work_order.id,
                    "technician_employee_id": employees[0].id,
                    "site_address": "Customer Site",
                    "status": "planned",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    sla = safe(
        db,
        "service.service-slas",
        lambda: ensure(
            db,
            SvcServiceSla,
            {"tenant_id": tenant_id, "company_id": company_id, "sla_code": "SVC-SLA-STD"},
            {
                "branch_id": branch_id,
                "sla_name": "Standard SLA",
                "priority": "medium",
                "response_minutes": 60,
                "resolution_minutes": 480,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "service.service-escalations",
        lambda: ensure(
            db,
            SvcServiceEscalation,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-SVC-ESC-0001"},
            {
                "branch_id": branch_id,
                "request_id": req.id,
                "sla_id": sla.id if sla else None,
                "escalation_level": 1,
                "reason_code": "sla_at_risk",
                "escalated_to_employee_id": employees[0].id,
                "escalated_at": utcnow(),
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "service.service-contracts",
        lambda: ensure(
            db,
            SvcServiceContract,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-SVC-CTR-0001"},
            {
                "branch_id": branch_id,
                "customer_id": customer.id,
                "contract_type": "amc",
                "start_date": date(2026, 1, 1),
                "end_date": date(2026, 12, 31),
                "coverage_notes": "Annual maintenance contract",
                "default_sla_id": sla.id if sla else None,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "service.service-feedback",
        lambda: ensure(
            db,
            SvcServiceFeedback,
            {"tenant_id": tenant_id, "company_id": company_id, "request_id": req.id, "customer_id": customer.id},
            {
                "branch_id": branch_id,
                "work_order_id": work_order.id if work_order else None,
                "rating": 5,
                "comments": "Great service",
                "captured_at": utcnow(),
                "channel": "email",
                "status": "captured",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if work_order:
        safe(
            db,
            "service.service-assignments",
            lambda: ensure(
                db,
                SvcServiceAssignment,
                {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-SVC-ASG-0001"},
                {
                    "branch_id": branch_id,
                    "request_id": req.id,
                    "work_order_id": work_order.id,
                    "technician_employee_id": employees[0].id,
                    "role_on_job": "primary",
                    "assigned_at": utcnow(),
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        safe(
            db,
            "service.service-materials",
            lambda: ensure(
                db,
                SvcServiceMaterial,
                {"work_order_id": work_order.id, "product_id": product.id},
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "branch_id": branch_id,
                    "quantity": Decimal("2"),
                    "unit_cost": Decimal("150.00"),
                    "line_amount": Decimal("300.00"),
                    "status": "reserved",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        task = safe(
            db,
            "service.service-tasks",
            lambda: ensure(
                db,
                SvcServiceTask,
                {"work_order_id": work_order.id, "task_code": "TASK-DIAG"},
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "branch_id": branch_id,
                    "task_name": "Diagnose fault",
                    "sequence_no": 1,
                    "assignee_employee_id": employees[0].id,
                    "planned_hours": Decimal("2.00"),
                    "status": "pending",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        safe(
            db,
            "service.time-entries",
            lambda: ensure(
                db,
                SvcServiceTimeEntry,
                {"work_order_id": work_order.id, "employee_id": employees[0].id, "entry_date": date.today()},
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "branch_id": branch_id,
                    "task_id": task.id if task else None,
                    "hours": Decimal("2.00"),
                    "is_billable": True,
                    "labor_rate": Decimal("500.00"),
                    "amount": Decimal("1000.00"),
                    "status": "draft",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )


def seed_helpdesk(db, tenant_id, company_id, branch_id, admin_id, employees, customer):
    cat = ensure(
        db,
        HdTicketCategory,
        {"tenant_id": tenant_id, "company_id": company_id, "category_code": "IT"},
        {
            "category_name": "IT Support",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    pri = ensure(
        db,
        HdTicketPriority,
        {"tenant_id": tenant_id, "company_id": company_id, "priority_code": "P2"},
        {
            "priority_name": "Medium",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ticket = ensure(
        db,
        HdTicket,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "HD-0001"},
        {
            "branch_id": branch_id,
            "category_id": cat.id,
            "priority_id": pri.id,
            "ticket_type": "incident",
            "subject": "Request VPN access",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    # Rename a previously-seeded generic ticket subject.
    touch_names(
        db,
        HdTicket,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "HD-0001"},
        {"subject": "Request VPN access"},
    )
    for doc_number, subject in [
        ("HD-0002", "Cannot reset password"),
        ("HD-0003", "Printer offline in Finance"),
    ]:
        ensure(
            db,
            HdTicket,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": doc_number},
            {
                "branch_id": branch_id,
                "category_id": cat.id,
                "priority_id": pri.id,
                "ticket_type": "incident",
                "subject": subject,
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )

    # --- New Helpdesk resources ---
    safe(
        db,
        "helpdesk.ticket-slas",
        lambda: ensure(
            db,
            HdTicketSla,
            {"tenant_id": tenant_id, "company_id": company_id, "sla_code": "HD-SLA-STD"},
            {
                "branch_id": branch_id,
                "sla_name": "Standard Ticket SLA",
                "priority_id": pri.id,
                "response_minutes": 30,
                "resolution_minutes": 240,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    kb = safe(
        db,
        "helpdesk.knowledge-bases",
        lambda: ensure(
            db,
            HdKnowledgeBase,
            {"tenant_id": tenant_id, "company_id": company_id, "kb_code": "KB-IT"},
            {
                "branch_id": branch_id,
                "kb_name": "IT Knowledge Base",
                "owner_employee_id": employees[0].id,
                "is_public": False,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if kb:
        safe(
            db,
            "helpdesk.knowledge-articles",
            lambda: ensure(
                db,
                HdKnowledgeArticle,
                {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-HD-KA-0001"},
                {
                    "branch_id": branch_id,
                    "knowledge_base_id": kb.id,
                    "article_code": "KA-VPN-001",
                    "title": "How to reset VPN access",
                    "body": "Steps to reset VPN access for employees.",
                    "category_id": cat.id,
                    "author_employee_id": employees[0].id,
                    "published_at": utcnow(),
                    "status": "published",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    safe(
        db,
        "helpdesk.resolutions",
        lambda: ensure(
            db,
            HdResolution,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-HD-RES-0001"},
            {
                "branch_id": branch_id,
                "ticket_id": ticket.id,
                "resolution_code": "workaround",
                "resolution_summary": "Reset VPN credentials",
                "resolved_by_employee_id": employees[0].id,
                "resolved_at": utcnow(),
                "first_time_fix": True,
                "status": "completed",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    team = safe(
        db,
        "helpdesk.support-teams",
        lambda: ensure(
            db,
            HdSupportTeam,
            {"tenant_id": tenant_id, "company_id": company_id, "team_code": "TEAM-IT"},
            {
                "branch_id": branch_id,
                "team_name": "IT Support Team",
                "lead_employee_id": employees[0].id,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    shift = None
    if team:
        shift = safe(
            db,
            "helpdesk.support-shifts",
            lambda: ensure(
                db,
                HdSupportShift,
                {"support_team_id": team.id, "shift_code": "SHIFT-DAY"},
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "branch_id": branch_id,
                    "shift_name": "Day Shift",
                    "start_time": time(9, 0),
                    "end_time": time(18, 0),
                    "timezone": "Asia/Kolkata",
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        if shift:
            safe(
                db,
                "helpdesk.support-schedules",
                lambda: ensure(
                    db,
                    HdSupportSchedule,
                    {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-HD-SCH-0001"},
                    {
                        "branch_id": branch_id,
                        "support_team_id": team.id,
                        "support_shift_id": shift.id,
                        "employee_id": employees[0].id,
                        "schedule_date": date.today(),
                        "planned_start": utcnow(),
                        "planned_end": utcnow() + timedelta(hours=8),
                        "status": "planned",
                        "created_by": admin_id,
                        "updated_by": admin_id,
                    },
                ),
            )
    safe(
        db,
        "helpdesk.ticket-assignments",
        lambda: ensure(
            db,
            HdTicketAssignment,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-HD-ASG-0001"},
            {
                "branch_id": branch_id,
                "ticket_id": ticket.id,
                "assignee_employee_id": employees[0].id,
                "support_team_id": team.id if team else None,
                "role_on_ticket": "primary",
                "assigned_at": utcnow(),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "helpdesk.ticket-comments",
        lambda: ensure(
            db,
            HdTicketComment,
            {"tenant_id": tenant_id, "company_id": company_id, "ticket_id": ticket.id, "commented_at": utcnow()},
            {
                "branch_id": branch_id,
                "author_employee_id": employees[0].id,
                "is_public": True,
                "body": "Investigating VPN connectivity issue.",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "helpdesk.ticket-escalations",
        lambda: ensure(
            db,
            HdTicketEscalation,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-HD-ESC-0001"},
            {
                "branch_id": branch_id,
                "ticket_id": ticket.id,
                "escalation_level": 1,
                "reason_code": "sla_at_risk",
                "escalated_to_employee_id": employees[0].id,
                "escalated_at": utcnow(),
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "helpdesk.customer-feedback",
        lambda: ensure(
            db,
            HdCustomerFeedback,
            {"tenant_id": tenant_id, "company_id": company_id, "ticket_id": ticket.id, "customer_id": customer.id},
            {
                "branch_id": branch_id,
                "rating": 4,
                "comments": "Issue resolved quickly",
                "captured_at": utcnow(),
                "channel": "portal",
                "status": "captured",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )


def seed_documents(db, tenant_id, company_id, branch_id, admin_id, employees):
    folder = ensure(
        db,
        DocFolder,
        {"tenant_id": tenant_id, "company_id": company_id, "folder_code": "POL"},
        {
            "folder_name": "HR Policies",
            "folder_type": "business",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    # Rename a previously-seeded generic folder name.
    touch_names(
        db,
        DocFolder,
        {"tenant_id": tenant_id, "company_id": company_id, "folder_code": "POL"},
        {"folder_name": "HR Policies"},
    )
    document = ensure(
        db,
        DocDocument,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DOC-0001"},
        {
            "branch_id": branch_id,
            "folder_id": folder.id if hasattr(DocDocument, "folder_id") else None,
            "title": "Employee Handbook 2026",
            "owner_employee_id": employees[0].id,
            "classification": "internal",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    # Rename a previously-seeded generic document title.
    touch_names(
        db,
        DocDocument,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DOC-0001"},
        {"title": "Employee Handbook 2026"},
    )
    ensure(
        db,
        DocDocument,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DOC-0002"},
        {
            "branch_id": branch_id,
            "folder_id": folder.id if hasattr(DocDocument, "folder_id") else None,
            "title": "HR Policies Master Index",
            "owner_employee_id": employees[0].id,
            "classification": "internal",
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New Document resources ---
    safe(
        db,
        "documents.templates",
        lambda: ensure(
            db,
            DocTemplate,
            {"tenant_id": tenant_id, "company_id": company_id, "template_code": "TPL-OFFER"},
            {
                "template_name": "Offer Letter Template",
                "category": "hr",
                "storage_uri": "https://files.example.com/demo/offer-letter-template.docx",
                "owner_employee_id": employees[0].id,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    retention = safe(
        db,
        "documents.retention-policies",
        lambda: ensure(
            db,
            DocRetentionPolicy,
            {"tenant_id": tenant_id, "company_id": company_id, "policy_code": "RET-7Y"},
            {
                "policy_name": "7 Year Retention",
                "retention_days": 2555,
                "action_on_expiry": "archive",
                "applies_to_category": "business",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "documents.archives",
        lambda: ensure(
            db,
            DocArchive,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-DOC-ARC-0001"},
            {
                "branch_id": branch_id,
                "document_id": document.id,
                "retention_policy_id": retention.id if retention else None,
                "archived_by_employee_id": employees[0].id,
                "archived_at": utcnow(),
                "archive_location_uri": "https://files.example.com/demo/archive/doc-0001.pdf",
                "reason": "End of active use",
                "status": "archived",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "documents.document-versions",
        lambda: ensure(
            db,
            DocDocumentVersion,
            {"document_id": document.id, "version_no": 1},
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "storage_uri": "https://files.example.com/demo/handbook-v1.pdf",
                "content_hash": "demo-hash-0001",
                "file_size_bytes": 204800,
                "change_summary": "Initial version",
                "created_by_employee_id": employees[0].id,
                "is_current": True,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "documents.document-tags",
        lambda: ensure(
            db,
            DocDocumentTag,
            {"tenant_id": tenant_id, "company_id": company_id, "tag_code": "TAG-HR"},
            {
                "tag_name": "HR",
                "tag_group": "department",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "documents.document-shares",
        lambda: ensure(
            db,
            DocDocumentShare,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-DOC-SHR-0001"},
            {
                "document_id": document.id,
                "shared_with_employee_id": employees[0].id,
                "expires_at": utcnow() + timedelta(days=30),
                "permission_level": "view",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "documents.document-permissions",
        lambda: ensure(
            db,
            DocDocumentPermission,
            {"tenant_id": tenant_id, "company_id": company_id, "document_id": document.id, "grantee_employee_id": employees[0].id},
            {
                "grantee_type": "employee",
                "permission_level": "edit",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "documents.document-approvals",
        lambda: ensure(
            db,
            DocDocumentApproval,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": "DEMO-DOC-APR-0001"},
            {
                "branch_id": branch_id,
                "document_id": document.id,
                "approval_type": "content_approval",
                "requested_by_employee_id": employees[0].id,
                "approver_employee_id": employees[0].id,
                "decision": "pending",
                "status": "submitted",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "documents.document-workflows",
        lambda: ensure(
            db,
            DocDocumentWorkflow,
            {"tenant_id": tenant_id, "company_id": company_id, "workflow_code": "WF-DOC-APPROVAL"},
            {
                "workflow_name": "Document Approval Workflow",
                "applies_to_category": "business",
                "foundation_workflow_code": "document_approval",
                "is_default": True,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )


def seed_grc(db, tenant_id, company_id, branch_id, admin_id, employees):
    policy = ensure(
        db,
        GrcPolicy,
        {"tenant_id": tenant_id, "company_id": company_id, "policy_code": "POL-IS"},
        {
            "policy_number": "POL-0001",
            "policy_name": "Information Security Policy",
            "policy_type": "it",
            "owner_employee_id": employees[0].id,
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        GrcPolicy,
        {"tenant_id": tenant_id, "company_id": company_id, "policy_code": "POL-DATA"},
        {
            "policy_number": "POL-0002",
            "policy_name": "Data Privacy and Protection Policy",
            "policy_type": "compliance",
            "owner_employee_id": employees[0].id,
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    cat = ensure(
        db,
        GrcRiskCategory,
        {"tenant_id": tenant_id, "company_id": company_id, "category_code": "OPS"},
        {
            "category_name": "Operational Risk",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    risk = ensure(
        db,
        GrcRiskRegister,
        {"tenant_id": tenant_id, "company_id": company_id, "risk_number": "RSK-0001"},
        {
            "branch_id": branch_id,
            "risk_title": "Data center outage",
            "risk_category_id": cat.id,
            "owner_employee_id": employees[0].id,
            "risk_level": "high",
            "status": "open",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New GRC resources ---
    control = safe(
        db,
        "grc.controls",
        lambda: ensure(
            db,
            GrcControl,
            {"tenant_id": tenant_id, "company_id": company_id, "control_number": "DEMO-GRC-CTL-0001"},
            {
                "branch_id": branch_id,
                "control_code": "CTL-0001",
                "control_name": "Access Review Control",
                "control_type": "preventive",
                "owner_employee_id": employees[0].id,
                "policy_id": policy.id,
                "risk_id": risk.id,
                "frequency": "quarterly",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    framework = safe(
        db,
        "grc.compliance-frameworks",
        lambda: ensure(
            db,
            GrcComplianceFramework,
            {"tenant_id": tenant_id, "company_id": company_id, "framework_code": "FW-ISO27001"},
            {
                "framework_name": "ISO 27001",
                "framework_type": "standard",
                "jurisdiction": "Global",
                "owner_employee_id": employees[0].id,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if framework:
        requirement = safe(
            db,
            "grc.compliance-requirements",
            lambda: ensure(
                db,
                GrcComplianceRequirement,
                {"framework_id": framework.id, "requirement_code": "REQ-A5"},
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "requirement_name": "Information Security Policies",
                    "compliance_area": "info_security",
                    "owner_employee_id": employees[0].id,
                    "due_date": date.today() + timedelta(days=60),
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        if requirement:
            safe(
                db,
                "grc.compliance-assessments",
                lambda: ensure(
                    db,
                    GrcComplianceAssessment,
                    {"tenant_id": tenant_id, "company_id": company_id, "assessment_number": "DEMO-GRC-ASM-0001"},
                    {
                        "branch_id": branch_id,
                        "requirement_id": requirement.id,
                        "assessed_by_employee_id": employees[0].id,
                        "assessed_at": utcnow(),
                        "compliance_status": "compliant",
                        "evidence_summary": "Policies reviewed and signed off",
                        "next_due_at": date.today() + timedelta(days=180),
                        "status": "completed",
                        "created_by": admin_id,
                        "updated_by": admin_id,
                    },
                ),
            )
    audit_plan = safe(
        db,
        "grc.audit-plans",
        lambda: ensure(
            db,
            GrcAuditPlan,
            {"tenant_id": tenant_id, "company_id": company_id, "plan_code": "AP-2026"},
            {
                "plan_name": "Annual Internal Audit Plan 2026",
                "plan_year": 2026,
                "owner_employee_id": employees[0].id,
                "period_start": date(2026, 1, 1),
                "period_end": date(2026, 12, 31),
                "status": "approved",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    audit = safe(
        db,
        "grc.audits",
        lambda: ensure(
            db,
            GrcAudit,
            {"tenant_id": tenant_id, "company_id": company_id, "audit_number": "DEMO-GRC-AUD-0001"},
            {
                "branch_id": branch_id,
                "audit_plan_id": audit_plan.id if audit_plan else None,
                "audit_type": "internal",
                "title": "Q1 IT Controls Audit",
                "lead_auditor_employee_id": employees[0].id,
                "planned_start": date.today() + timedelta(days=10),
                "planned_end": date.today() + timedelta(days=15),
                "status": "planned",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "grc.corrective-actions",
        lambda: ensure(
            db,
            GrcCorrectiveAction,
            {"tenant_id": tenant_id, "company_id": company_id, "capa_number": "DEMO-GRC-CAPA-0001"},
            {
                "branch_id": branch_id,
                "title": "Strengthen access review cadence",
                "owner_employee_id": employees[0].id,
                "due_date": date.today() + timedelta(days=30),
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "grc.exceptions",
        lambda: ensure(
            db,
            GrcException,
            {"tenant_id": tenant_id, "company_id": company_id, "exception_number": "DEMO-GRC-EXC-0001"},
            {
                "branch_id": branch_id,
                "exception_type": "policy_deviation",
                "title": "Temporary admin access grant",
                "requested_by_employee_id": employees[0].id,
                "policy_id": policy.id,
                "valid_from": date.today(),
                "valid_to": date.today() + timedelta(days=7),
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "grc.incidents",
        lambda: ensure(
            db,
            GrcIncident,
            {"tenant_id": tenant_id, "company_id": company_id, "incident_number": "DEMO-GRC-INC-0001"},
            {
                "branch_id": branch_id,
                "incident_type": "operational",
                "title": "Brief service disruption",
                "reported_by_employee_id": employees[0].id,
                "owner_employee_id": employees[0].id,
                "severity": "low",
                "occurred_at": utcnow(),
                "detected_at": utcnow(),
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "grc.policy-versions",
        lambda: ensure(
            db,
            GrcPolicyVersion,
            {"policy_id": policy.id, "version_no": 1},
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "title": "Information Security Policy v1",
                "summary": "Initial published version",
                "created_by_employee_id": employees[0].id,
                "is_current": True,
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if control:
        safe(
            db,
            "grc.control-tests",
            lambda: ensure(
                db,
                GrcControlTest,
                {"tenant_id": tenant_id, "company_id": company_id, "test_number": "DEMO-GRC-CT-0001"},
                {
                    "branch_id": branch_id,
                    "control_id": control.id,
                    "tested_by_employee_id": employees[0].id,
                    "tested_at": utcnow(),
                    "test_result": "effective",
                    "sample_size": 10,
                    "findings_summary": "No exceptions noted",
                    "status": "completed",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        safe(
            db,
            "grc.risk-treatments",
            lambda: ensure(
                db,
                GrcRiskTreatment,
                {"tenant_id": tenant_id, "company_id": company_id, "treatment_number": "DEMO-GRC-RT-0001"},
                {
                    "branch_id": branch_id,
                    "risk_id": risk.id,
                    "treatment_strategy": "reduce",
                    "action_plan": "Implement redundant power and failover site",
                    "owner_employee_id": employees[0].id,
                    "target_date": date.today() + timedelta(days=90),
                    "control_id": control.id,
                    "status": "planned",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    safe(
        db,
        "grc.risk-assessments",
        lambda: ensure(
            db,
            GrcRiskAssessment,
            {"tenant_id": tenant_id, "company_id": company_id, "assessment_number": "DEMO-GRC-RA-0001"},
            {
                "branch_id": branch_id,
                "risk_id": risk.id,
                "assessed_by_employee_id": employees[0].id,
                "assessed_at": utcnow(),
                "impact": 4,
                "probability": 3,
                "risk_score": 12,
                "risk_level": "high",
                "assessment_notes": "Assessed during Q1 risk review cycle",
                "status": "completed",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if audit:
        safe(
            db,
            "grc.audit-findings",
            lambda: ensure(
                db,
                GrcAuditFinding,
                {"tenant_id": tenant_id, "company_id": company_id, "finding_number": "DEMO-GRC-AF-0001"},
                {
                    "branch_id": branch_id,
                    "audit_id": audit.id,
                    "severity": "minor",
                    "title": "Access review evidence incomplete",
                    "description": "Some quarterly access reviews lacked sign-off records",
                    "action_required": "Retain signed evidence for each review cycle",
                    "owner_employee_id": employees[0].id,
                    "due_date": date.today() + timedelta(days=45),
                    "control_id": control.id if control else None,
                    "risk_id": risk.id,
                    "status": "open",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )


def seed_analytics(db, tenant_id, company_id, branch_id, admin_id, employees):
    dashboard = ensure(
        db,
        BiDashboard,
        {"tenant_id": tenant_id, "company_id": company_id, "dashboard_code": "EXEC"},
        {
            "dashboard_number": "DB-0001",
            "dashboard_name": "Executive Overview",
            "dashboard_type": "executive",
            "owner_employee_id": employees[0].id,
            "layout_json": {"widgets": []},
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    metric = ensure(
        db,
        BiMetric,
        {"tenant_id": tenant_id, "company_id": company_id, "metric_code": "REV"},
        {
            "metric_name": "Revenue",
            "metric_category": "financial",
            "aggregation": "sum",
            "expression_json": {"field": "amount"},
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    kpi = ensure(
        db,
        BiKpi,
        {"tenant_id": tenant_id, "company_id": company_id, "kpi_code": "NPS"},
        {
            "kpi_number": "KPI-0001",
            "kpi_name": "Net Promoter Score",
            "owner_employee_id": employees[0].id,
            "direction": "higher_better",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New Analytics resources ---
    dataset = safe(
        db,
        "analytics.datasets",
        lambda: ensure(
            db,
            BiDataset,
            {"tenant_id": tenant_id, "company_id": company_id, "dataset_number": "DEMO-BI-DS-0001"},
            {
                "branch_id": branch_id,
                "dataset_code": "DS-SALES",
                "dataset_name": "Sales Performance Dataset",
                "dataset_type": "operational",
                "description": "Aggregated sales order data for reporting",
                "owner_employee_id": employees[0].id,
                "grain_description": "One row per sales order",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if dataset:
        safe(
            db,
            "analytics.dimensions",
            lambda: ensure(
                db,
                BiDimension,
                {"tenant_id": tenant_id, "company_id": company_id, "dimension_code": "DIM-CUSTOMER"},
                {
                    "branch_id": branch_id,
                    "dimension_name": "Customer",
                    "dataset_id": dataset.id,
                    "dimension_type": "customer",
                    "source_module": "sales",
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    report = safe(
        db,
        "analytics.reports",
        lambda: ensure(
            db,
            BiReport,
            {"tenant_id": tenant_id, "company_id": company_id, "report_number": "DEMO-BI-RPT-0001"},
            {
                "branch_id": branch_id,
                "report_code": "RPT-SALES-SUMMARY",
                "report_name": "Sales Summary Report",
                "report_type": "operational",
                "owner_employee_id": employees[0].id,
                "dataset_id": dataset.id if dataset else None,
                "definition_json": {"columns": ["customer", "amount"]},
                "output_format": "pdf",
                "status": "draft",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "analytics.alert-rules",
        lambda: ensure(
            db,
            BiAlertRule,
            {"tenant_id": tenant_id, "company_id": company_id, "alert_number": "DEMO-BI-AR-0001"},
            {
                "branch_id": branch_id,
                "alert_code": "AR-REV-DROP",
                "alert_name": "Revenue Drop Alert",
                "metric_id": metric.id,
                "condition_operator": "lt",
                "threshold_value": Decimal("100000.00"),
                "severity": "warning",
                "owner_employee_id": employees[0].id,
                "is_enabled": True,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if dashboard:
        safe(
            db,
            "analytics.dashboard-widgets",
            lambda: ensure(
                db,
                BiDashboardWidget,
                {"dashboard_id": dashboard.id, "widget_code": "WGT-REV"},
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "branch_id": branch_id,
                    "widget_title": "Revenue KPI Tile",
                    "widget_type": "kpi_tile",
                    "metric_id": metric.id,
                    "kpi_id": kpi.id,
                    "config_json": {"color": "green"},
                    "sequence_no": 1,
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        safe(
            db,
            "analytics.subscriptions",
            lambda: ensure(
                db,
                BiSubscription,
                {"tenant_id": tenant_id, "company_id": company_id, "subscription_number": "DEMO-BI-SUB-0001"},
                {
                    "branch_id": branch_id,
                    "subscriber_employee_id": employees[0].id,
                    "target_type": "dashboard",
                    "dashboard_id": dashboard.id,
                    "channel": "email",
                    "frequency": "weekly",
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    if report:
        safe(
            db,
            "analytics.report-schedules",
            lambda: ensure(
                db,
                BiReportSchedule,
                {"report_id": report.id, "schedule_code": "SCH-WEEKLY"},
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "branch_id": branch_id,
                    "cron_expression": "0 8 * * MON",
                    "timezone": "Asia/Kolkata",
                    "next_run_at": utcnow() + timedelta(days=7),
                    "recipients_json": {"emails": ["admin@example.com"]},
                    "is_enabled": True,
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    if dataset:
        safe(
            db,
            "analytics.data-imports",
            lambda: ensure(
                db,
                BiDataImport,
                {"tenant_id": tenant_id, "company_id": company_id, "import_number": "DEMO-BI-IMP-0001"},
                {
                    "branch_id": branch_id,
                    "dataset_id": dataset.id,
                    "requested_by_employee_id": employees[0].id,
                    "source_uri": "https://files.example.com/demo/sales-import.csv",
                    "format": "csv",
                    "rows_loaded": 500,
                    "status": "succeeded",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        safe(
            db,
            "analytics.data-exports",
            lambda: ensure(
                db,
                BiDataExport,
                {"tenant_id": tenant_id, "company_id": company_id, "export_number": "DEMO-BI-EXP-0001"},
                {
                    "branch_id": branch_id,
                    "report_id": report.id if report else None,
                    "dataset_id": dataset.id,
                    "requested_by_employee_id": employees[0].id,
                    "format": "csv",
                    "storage_uri": "https://files.example.com/demo/sales-export.csv",
                    "started_at": utcnow() - timedelta(minutes=2),
                    "completed_at": utcnow(),
                    "status": "succeeded",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )


def seed_integration(db, tenant_id, company_id, admin_id, employees):
    system = ensure(
        db,
        IntExternalSystem,
        {"tenant_id": tenant_id, "company_id": company_id, "system_code": "BANK"},
        {
            "system_number": "SYS-0001",
            "system_name": "Demo Bank Gateway",
            "system_type": "bank",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    connector = ensure(
        db,
        IntConnector,
        {"tenant_id": tenant_id, "company_id": company_id, "connector_code": "BANK-REST"},
        {
            "connector_number": "CON-0001",
            "connector_name": "Bank REST Connector",
            "external_system_id": system.id,
            "connector_protocol": "rest",
            "direction": "outbound",
            "config_json": {"base_url": "https://bank.example.com"},
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New Integration resources ---
    safe(
        db,
        "integration.api-credentials",
        lambda: ensure(
            db,
            IntApiCredential,
            {"tenant_id": tenant_id, "company_id": company_id, "credential_number": "DEMO-INT-CRD-0001"},
            {
                "external_system_id": system.id,
                "credential_type": "api_key",
                "secret_vault_ref": "vault://demo/int-credential-0001",
                "key_hint": "****DEMO",
                "owner_employee_id": employees[0].id,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "integration.oauth-clients",
        lambda: ensure(
            db,
            IntOauthClient,
            {"tenant_id": tenant_id, "company_id": company_id, "client_number": "DEMO-INT-OAC-0001"},
            {
                "external_system_id": system.id,
                "client_id_public": "demo-client-id",
                "client_secret_vault_ref": "vault://demo/oauth-secret-0001",
                "token_url": "https://bank.example.com/oauth/token",
                "grant_type": "client_credentials",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "integration.webhooks",
        lambda: ensure(
            db,
            IntWebhook,
            {"tenant_id": tenant_id, "company_id": company_id, "webhook_number": "DEMO-INT-WH-0001"},
            {
                "external_system_id": system.id,
                "connector_id": connector.id,
                "direction": "outbound",
                "target_url": "https://bank.example.com/webhooks/erp",
                "owner_employee_id": employees[0].id,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "integration.event-definitions",
        lambda: ensure(
            db,
            IntEventDefinition,
            {"tenant_id": tenant_id, "company_id": company_id, "event_code": "finance.invoice.posted"},
            {
                "event_name": "Invoice Posted",
                "source_module": "finance",
                "payload_schema_json": {"type": "object"},
                "is_active": True,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "integration.message-queues",
        lambda: ensure(
            db,
            IntMessageQueue,
            {"tenant_id": tenant_id, "company_id": company_id, "queue_code": "Q-DEFAULT"},
            {
                "queue_name": "Default Queue",
                "queue_type": "standard",
                "max_retries": 3,
                "visibility_timeout_sec": 30,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "integration.data-mappings",
        lambda: ensure(
            db,
            IntDataMapping,
            {"tenant_id": tenant_id, "company_id": company_id, "mapping_code": "MAP-BANK-TXN"},
            {
                "mapping_name": "Bank Transaction Mapping",
                "connector_id": connector.id,
                "source_entity": "bank_transaction",
                "target_entity": "fin_journal_line",
                "mapping_json": {"fields": []},
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "integration.sync-jobs",
        lambda: ensure(
            db,
            IntSyncJob,
            {"tenant_id": tenant_id, "company_id": company_id, "sync_number": "DEMO-INT-SYNC-0001"},
            {
                "connector_id": connector.id,
                "sync_mode": "incremental",
                "direction": "pull",
                "requested_by_employee_id": employees[0].id,
                "started_at": utcnow() - timedelta(minutes=5),
                "completed_at": utcnow(),
                "rows_processed": 42,
                "status": "succeeded",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "integration.rate-limits",
        lambda: ensure(
            db,
            IntRateLimit,
            {"tenant_id": tenant_id, "company_id": company_id, "limit_code": "RL-BANK-DEFAULT"},
            {
                "external_system_id": system.id,
                "window_seconds": 60,
                "max_requests": 100,
                "burst_max": 20,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )


def seed_ecommerce(db, tenant_id, company_id, admin_id, product, employees, customer, extra_products=None):
    store = ensure(
        db,
        EcStore,
        {"tenant_id": tenant_id, "company_id": company_id, "store_code": "WEB"},
        {
            "store_number": "ST-0001",
            "store_name": "Demo Industries Online Store",
            "store_type": "b2c",
            "owner_employee_id": employees[2].id,
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    # Rename a previously-seeded generic store name.
    touch_names(
        db,
        EcStore,
        {"tenant_id": tenant_id, "company_id": company_id, "store_code": "WEB"},
        {"store_name": "Demo Industries Online Store"},
    )
    channel = ensure(
        db,
        EcSalesChannel,
        {"tenant_id": tenant_id, "company_id": company_id, "channel_code": "OWN"},
        {
            "channel_number": "CH-0001",
            "channel_name": "Own Website",
            "store_id": store.id,
            "channel_type": "website",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        EcProductListing,
        {"tenant_id": tenant_id, "company_id": company_id, "listing_number": "LST-0001"},
        {
            "sales_channel_id": channel.id,
            "product_id": product.id,
            "title": "Demo Widget — Online Store Listing",
            "attributes_json": {"color": "blue"},
            "status": "draft",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    if extra_products:
        sensor_kit = next((p for p in extra_products if p and p.product_code == "PRD-1003"), None)
        if sensor_kit:
            ensure(
                db,
                EcProductListing,
                {"tenant_id": tenant_id, "company_id": company_id, "listing_number": "LST-0002"},
                {
                    "sales_channel_id": channel.id,
                    "product_id": sensor_kit.id,
                    "title": "Industrial Sensor Kit — Online Store Listing",
                    "attributes_json": {"category": "industrial"},
                    "status": "draft",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            )

    # --- New Ecommerce resources ---
    cart = safe(
        db,
        "ecommerce.customer-carts",
        lambda: ensure(
            db,
            EcCustomerCart,
            {"tenant_id": tenant_id, "company_id": company_id, "cart_number": "DEMO-EC-CART-0001"},
            {
                "sales_channel_id": channel.id,
                "customer_id": customer.id,
                "currency": "INR",
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    order = safe(
        db,
        "ecommerce.orders",
        lambda: ensure(
            db,
            EcOrder,
            {"tenant_id": tenant_id, "company_id": company_id, "order_number": "DEMO-EC-ORD-0001"},
            {
                "sales_channel_id": channel.id,
                "store_id": store.id,
                "customer_id": customer.id,
                "cart_id": cart.id if cart else None,
                "currency": "INR",
                "subtotal_amount": Decimal("1500.00"),
                "tax_amount": Decimal("270.00"),
                "shipping_amount": Decimal("50.00"),
                "grand_total": Decimal("1820.00"),
                "placed_at": utcnow(),
                "status": "processing",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    if order:
        safe(
            db,
            "ecommerce.payments",
            lambda: ensure(
                db,
                EcPayment,
                {"tenant_id": tenant_id, "company_id": company_id, "payment_number": "DEMO-EC-PAY-0001"},
                {
                    "order_id": order.id,
                    "payment_method": "card",
                    "currency": "INR",
                    "amount": Decimal("1820.00"),
                    "gateway_code": "demo_gateway",
                    "captured_at": utcnow(),
                    "status": "captured",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        safe(
            db,
            "ecommerce.shipments",
            lambda: ensure(
                db,
                EcShipment,
                {"tenant_id": tenant_id, "company_id": company_id, "shipment_number": "DEMO-EC-SHP-0001"},
                {
                    "order_id": order.id,
                    "carrier_code": "delhivery",
                    "tracking_number": "TRK-DEMO-0001",
                    "shipped_at": utcnow(),
                    "status": "shipped",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
        safe(
            db,
            "ecommerce.return-requests",
            lambda: ensure(
                db,
                EcReturnRequest,
                {"tenant_id": tenant_id, "company_id": company_id, "return_number": "DEMO-EC-RET-0001"},
                {
                    "order_id": order.id,
                    "customer_id": customer.id,
                    "reason_code": "defective",
                    "requested_at": utcnow(),
                    "status": "requested",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    safe(
        db,
        "ecommerce.coupons",
        lambda: ensure(
            db,
            EcCoupon,
            {"tenant_id": tenant_id, "company_id": company_id, "coupon_number": "DEMO-EC-CPN-0001"},
            {
                "store_id": store.id,
                "coupon_code": "DEMO10",
                "discount_type": "percent",
                "discount_value": Decimal("10.00"),
                "max_redemptions": 100,
                "valid_from": utcnow(),
                "valid_to": utcnow() + timedelta(days=60),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "ecommerce.promotions",
        lambda: ensure(
            db,
            EcPromotion,
            {"tenant_id": tenant_id, "company_id": company_id, "promotion_number": "DEMO-EC-PROMO-0001"},
            {
                "store_id": store.id,
                "promotion_code": "SUMMER26",
                "promotion_name": "Summer Sale",
                "promotion_type": "percent",
                "valid_from": utcnow(),
                "valid_to": utcnow() + timedelta(days=30),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "ecommerce.marketplace-connectors",
        lambda: ensure(
            db,
            EcMarketplaceConnector,
            {"tenant_id": tenant_id, "company_id": company_id, "connector_binding_number": "DEMO-EC-MPC-0001"},
            {
                "sales_channel_id": channel.id,
                "marketplace_code": "amazon",
                "sync_mode": "scheduled",
                "last_sync_at": utcnow(),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )


def seed_foundation_extras(db, tenant_id, company_id, branch_id, admin_id):
    """Notification templates, settings, and workflow definitions/instances."""
    safe(
        db,
        "notifications.templates",
        lambda: ensure(
            db,
            NtfTemplate,
            {"tenant_id": tenant_id, "template_code": "DEMO-WELCOME", "channel": "email"},
            {
                "template_name": "Welcome Email",
                "subject_template": "Welcome to {{company_name}}",
                "body_template": "Hi {{first_name}}, welcome aboard!",
                "locale": "en",
                "is_active": True,
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "settings",
        lambda: ensure(
            db,
            CfgSetting,
            {"tenant_id": tenant_id, "company_id": company_id, "branch_id": None, "setting_key": "demo.feature_flag"},
            {
                "setting_value": "true",
                "value_type": "boolean",
                "scope": "company",
                "is_encrypted": False,
                "description": "Demo feature flag toggle for seeded data",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    definition = safe(
        db,
        "workflows.definitions",
        lambda: ensure(
            db,
            WfDefinition,
            {"tenant_id": tenant_id, "workflow_code": "DEMO-APPROVAL", "version_no": 1},
            {
                "workflow_name": "Demo Approval Workflow",
                "module": "finance",
                "document_type": "invoice",
                "is_active": True,
                "config_json": {"steps": 1},
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    step = None
    if definition:
        step = safe(
            db,
            "workflows.steps",
            lambda: ensure(
                db,
                WfStep,
                {"workflow_id": definition.id, "step_order": 1},
                {
                    "tenant_id": tenant_id,
                    "step_code": "MANAGER_APPROVAL",
                    "step_name": "Manager Approval",
                    "approver_type": "role",
                    "is_parallel": False,
                    "sla_hours": 24,
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )
    if definition:
        safe(
            db,
            "workflows.instances",
            lambda: ensure(
                db,
                WfInstance,
                {"tenant_id": tenant_id, "workflow_id": definition.id, "entity_name": "fin_journal_header", "entity_id": uuid4()},
                {
                    "company_id": company_id,
                    "current_step_id": step.id if step else None,
                    "status": "pending",
                    "started_at": utcnow(),
                    "started_by": admin_id,
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            ),
        )


def seed_portal(db, tenant_id, company_id, admin_id, customer, employees):
    account = ensure(
        db,
        PtPortalAccount,
        {"tenant_id": tenant_id, "company_id": company_id, "login_email": "portal.user@example.com"},
        {
            "account_number": "PA-0001",
            "customer_id": customer.id,
            "display_name": "Portal Demo User",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    # --- New Portal resources ---
    safe(
        db,
        "portal.customer-profiles",
        lambda: ensure(
            db,
            PtCustomerProfile,
            {"tenant_id": tenant_id, "company_id": company_id, "profile_number": "DEMO-PT-PROF-0001"},
            {
                "customer_id": customer.id,
                "display_name": customer.customer_name,
                "preferred_language": "en",
                "timezone": "Asia/Kolkata",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "portal.dashboards",
        lambda: ensure(
            db,
            PtDashboard,
            {"tenant_id": tenant_id, "company_id": company_id, "dashboard_number": "DEMO-PT-DASH-0001"},
            {
                "portal_account_id": account.id,
                "dashboard_code": "PT-DEFAULT",
                "dashboard_name": "My Dashboard",
                "layout_json": {"widgets": []},
                "is_default": True,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "portal.notifications",
        lambda: ensure(
            db,
            PtNotification,
            {"tenant_id": tenant_id, "company_id": company_id, "portal_account_id": account.id, "title": "Welcome to the portal"},
            {
                "notification_type": "system",
                "body": "Thanks for joining our customer portal.",
                "delivery_status": "sent",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "portal.message-threads",
        lambda: ensure(
            db,
            PtMessageThread,
            {"tenant_id": tenant_id, "company_id": company_id, "thread_number": "DEMO-PT-THR-0001"},
            {
                "portal_account_id": account.id,
                "subject": "Question about my invoice",
                "related_entity_type": "invoice_view",
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "portal.support-tickets",
        lambda: ensure(
            db,
            PtSupportTicket,
            {"tenant_id": tenant_id, "company_id": company_id, "ticket_number": "DEMO-PT-TKT-0001"},
            {
                "portal_account_id": account.id,
                "customer_id": customer.id,
                "subject": "Unable to download invoice",
                "description": "Getting an error when trying to download invoice PDF.",
                "priority": "medium",
                "assigned_employee_id": employees[0].id,
                "status": "open",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "portal.service-requests",
        lambda: ensure(
            db,
            PtServiceRequest,
            {"tenant_id": tenant_id, "company_id": company_id, "request_number": "DEMO-PT-SR-0001"},
            {
                "portal_account_id": account.id,
                "customer_id": customer.id,
                "request_type": "visit",
                "description": "Requesting an on-site maintenance visit",
                "status": "submitted",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "portal.document-accesses",
        lambda: ensure(
            db,
            PtDocumentAccess,
            {"tenant_id": tenant_id, "company_id": company_id, "access_number": "DEMO-PT-DA-0001"},
            {
                "portal_account_id": account.id,
                "access_level": "view",
                "granted_by_employee_id": employees[0].id,
                "granted_at": utcnow(),
                "expires_at": utcnow() + timedelta(days=90),
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "portal.invoice-views",
        lambda: ensure(
            db,
            PtInvoiceView,
            {"tenant_id": tenant_id, "company_id": company_id, "view_number": "DEMO-PT-IV-0001"},
            {
                "portal_account_id": account.id,
                "customer_id": customer.id,
                "invoice_ref": "INV-0001",
                "amount_due": Decimal("50000.00"),
                "currency": "INR",
                "due_at": utcnow() + timedelta(days=15),
                "last_synced_at": utcnow(),
                "status": "visible",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "portal.order-views",
        lambda: ensure(
            db,
            PtOrderView,
            {"tenant_id": tenant_id, "company_id": company_id, "view_number": "DEMO-PT-OV-0001"},
            {
                "portal_account_id": account.id,
                "customer_id": customer.id,
                "order_ref": "SO-0001",
                "order_status_text": "Processing",
                "ordered_at": utcnow(),
                "last_synced_at": utcnow(),
                "status": "visible",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "portal.portal-sessions",
        lambda: ensure(
            db,
            PtPortalSession,
            {"tenant_id": tenant_id, "company_id": company_id, "session_number": "DEMO-PT-SESS-0001"},
            {
                "portal_account_id": account.id,
                "started_at": utcnow() - timedelta(minutes=30),
                "expires_at": utcnow() + timedelta(hours=1),
                "ip_address": "203.0.113.10",
                "user_agent": "Mozilla/5.0 (Demo Seed Agent)",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "portal.preferences",
        lambda: ensure(
            db,
            PtPreference,
            {"portal_account_id": account.id, "preference_key": "notification_channel"},
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "preference_value_json": {"channel": "email"},
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )
    safe(
        db,
        "portal.login-audits",
        lambda: ensure(
            db,
            PtLoginAudit,
            {"tenant_id": tenant_id, "company_id": company_id, "audit_number": "DEMO-PT-LA-0001"},
            {
                "portal_account_id": account.id,
                "event_type": "login_success",
                "occurred_at": utcnow(),
                "ip_address": "203.0.113.10",
                "user_agent": "Mozilla/5.0 (Demo Seed Agent)",
                "status": "recorded",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        ),
    )


def main() -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if not tenant:
            raise RuntimeError("BOOTSTRAP tenant missing. Run seed_demo_data first.")
        company = db.scalar(
            select(OrgCompany).where(
                OrgCompany.tenant_id == tenant.id,
                OrgCompany.company_code == "DEMOCO",
                OrgCompany.is_deleted.is_(False),
            )
        )
        branch = db.scalar(
            select(OrgBranch).where(
                OrgBranch.company_id == company.id,
                OrgBranch.branch_code == "HQ",
                OrgBranch.is_deleted.is_(False),
            )
        )
        admin = db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.email == "admin@example.com",
                SecUser.is_deleted.is_(False),
            )
        )
        customer = db.scalar(
            select(MasterCustomer).where(
                MasterCustomer.company_id == company.id,
                MasterCustomer.customer_code == "CUST-001",
                MasterCustomer.is_deleted.is_(False),
            )
        )
        vendor = db.scalar(
            select(MasterVendor).where(
                MasterVendor.company_id == company.id,
                MasterVendor.vendor_code == "VEND-001",
                MasterVendor.is_deleted.is_(False),
            )
        )
        if not all([company, branch, admin, customer, vendor]):
            raise RuntimeError("Base demo org/master rows missing. Run seed_demo_data first.")

        print("Seeding organization…")
        dept, _bu, loc, cc, _pc = seed_org(db, tenant.id, company.id, branch.id, admin.id)
        print("Seeding master data…")
        (
            uom,
            product,
            _p2,
            warehouse,
            employees,
            warehouse2,
            extra_products,
            extra_customers,
            extra_vendors,
        ) = seed_master(db, tenant.id, company.id, branch.id, admin.id, dept.id)
        print(
            f"  + {len(employees) - 3} extra employees, {len(extra_customers)} extra customers, "
            f"{len(extra_vendors)} extra vendors, {len(extra_products)} extra products"
        )
        print("Seeding finance…")
        fy, period = seed_finance(db, tenant.id, company.id, branch.id, admin.id)
        db.commit()

        failures: list[str] = []

        def run(label: str, fn):
            print(f"Seeding {label}…")
            try:
                value = fn()
                db.commit()
                return value
            except Exception as exc:  # noqa: BLE001
                failures.append(f"{label}: {exc}")
                print(f"  ! skipped {label}: {exc}")
                db.rollback()
                return None

        master_asset = run(
            "master assets",
            lambda: seed_master_asset(db, tenant.id, company.id, branch.id, admin.id, loc.id, employees),
        )
        run(
            "finance receivables/payables",
            lambda: seed_finance_extra(
                db,
                tenant.id,
                company.id,
                branch.id,
                admin.id,
                customer,
                vendor,
                fy,
                period,
                master_asset.id if master_asset else None,
            ),
        )
        hr_result = run("hr", lambda: seed_hr(db, tenant.id, company.id, branch.id, admin.id, employees))
        employment = hr_result[1] if hr_result else None
        lead_result = run(
            "crm",
            lambda: seed_crm(db, tenant.id, company.id, branch.id, admin.id, employees, customer),
        )
        run(
            "sales",
            lambda: seed_sales(
                db, tenant.id, company.id, branch.id, admin.id, customer, fy, period, product, uom
            ),
        )
        run(
            "procurement",
            lambda: seed_procurement(
                db, tenant.id, company.id, branch.id, admin.id, vendor, employees, dept.id, cc.id
            ),
        )
        run(
            "inventory",
            lambda: seed_inventory(
                db, tenant.id, company.id, branch.id, admin.id, warehouse, product, uom, warehouse2
            ),
        )
        mfg_result = run(
            "manufacturing",
            lambda: seed_mfg(db, tenant.id, company.id, branch.id, admin.id, product, warehouse, uom),
        )
        production_order = mfg_result[1] if mfg_result else None
        run(
            "quality",
            lambda: seed_quality(
                db,
                tenant.id,
                company.id,
                branch.id,
                admin.id,
                warehouse,
                product,
                uom,
                vendor,
                customer,
                employees,
                production_order.id if production_order else None,
            ),
        )
        run(
            "payroll",
            lambda: seed_payroll(
                db,
                tenant.id,
                company.id,
                branch.id,
                admin.id,
                employees,
                dept.id,
                employment.id if employment else None,
            ),
        )
        run(
            "recruitment",
            lambda: seed_recruitment(
                db, tenant.id, company.id, branch.id, admin.id, dept.id, employees
            ),
        )
        run(
            "projects",
            lambda: seed_projects(db, tenant.id, company.id, branch.id, admin.id, employees),
        )
        run(
            "assets",
            lambda: seed_assets(
                db, tenant.id, company.id, branch.id, admin.id, dept.id, employees, vendor
            ),
        )
        run(
            "service",
            lambda: seed_service(
                db, tenant.id, company.id, branch.id, admin.id, customer, employees, product
            ),
        )
        run(
            "helpdesk",
            lambda: seed_helpdesk(db, tenant.id, company.id, branch.id, admin.id, employees, customer),
        )
        run(
            "documents",
            lambda: seed_documents(db, tenant.id, company.id, branch.id, admin.id, employees),
        )
        run("grc", lambda: seed_grc(db, tenant.id, company.id, branch.id, admin.id, employees))
        run(
            "analytics",
            lambda: seed_analytics(db, tenant.id, company.id, branch.id, admin.id, employees),
        )
        run("integration", lambda: seed_integration(db, tenant.id, company.id, admin.id, employees))
        run(
            "ecommerce",
            lambda: seed_ecommerce(
                db, tenant.id, company.id, admin.id, product, employees, customer, extra_products
            ),
        )
        run(
            "portal",
            lambda: seed_portal(db, tenant.id, company.id, admin.id, customer, employees),
        )
        run(
            "foundation extras",
            lambda: seed_foundation_extras(db, tenant.id, company.id, branch.id, admin.id),
        )

        print("=" * 60)
        print("Demo module data seeded.")
        if failures:
            print(f"Skipped {len(failures)} modules:")
            for item in failures:
                print(f"  - {item}")
        print("Refresh website pages to see records.")
        print("=" * 60)

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
