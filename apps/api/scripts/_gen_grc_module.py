"""Generate Sprint 19 GRC module. Run from apps/api:
.venv\\Scripts\\python.exe scripts/_gen_grc_module.py
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
GRC = SRC / "modules" / "grc"
ALEMBIC = ROOT / "alembic" / "versions"
TESTS = SRC / "tests"
SHARED = SRC / "shared"

FILES_WRITTEN: list[Path] = []

WF_FIELDS = """
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
"""

OPT_BRANCH = """
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
"""


def w(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not content.endswith("\n"):
        content += "\n"
    path.write_text(content, encoding="utf-8")
    FILES_WRITTEN.append(path)
    print("wrote", path.relative_to(ROOT))


def patch_file(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new.strip() in text:
        print("skip (already)", path.relative_to(ROOT))
        return
    if old not in text:
        raise SystemExit(f"patch failed in {path}: marker not found")
    path.write_text(text.replace(old, new), encoding="utf-8")
    print("patched", path.relative_to(ROOT))


# table_key, ORM class, stem, branch_scoped (required branch for repo filter)
TABLES: list[tuple[str, str, str, bool]] = [
    ("policy", "GrcPolicy", "Policy", False),
    ("policy_version", "GrcPolicyVersion", "PolicyVersion", False),
    ("policy_acknowledgement", "GrcPolicyAcknowledgement", "PolicyAcknowledgement", False),
    ("control", "GrcControl", "Control", False),
    ("control_test", "GrcControlTest", "ControlTest", True),
    ("risk_category", "GrcRiskCategory", "RiskCategory", False),
    ("risk_register", "GrcRiskRegister", "RiskRegister", True),
    ("risk_assessment", "GrcRiskAssessment", "RiskAssessment", True),
    ("risk_treatment", "GrcRiskTreatment", "RiskTreatment", True),
    ("compliance_framework", "GrcComplianceFramework", "ComplianceFramework", False),
    ("compliance_requirement", "GrcComplianceRequirement", "ComplianceRequirement", False),
    ("compliance_assessment", "GrcComplianceAssessment", "ComplianceAssessment", True),
    ("audit_plan", "GrcAuditPlan", "AuditPlan", False),
    ("audit", "GrcAudit", "Audit", True),
    ("audit_finding", "GrcAuditFinding", "AuditFinding", True),
    ("corrective_action", "GrcCorrectiveAction", "CorrectiveAction", True),
    ("exception", "GrcException", "Exception", True),
    ("incident", "GrcIncident", "Incident", True),
    ("notification", "GrcNotification", "Notification", False),
    ("report", "GrcReport", "Report", False),
]

CLASS_MAP = {t[0]: t[1] for t in TABLES}

MIGRATIONS: list[tuple[str, str | list[str], str]] = [
    ("0333_create_grc_schema", "schema", "0332_seed_document_workflows"),
    ("0334_grc_policy", "policy", "0333_create_grc_schema"),
    ("0335_grc_policy_version", "policy_version", "0334_grc_policy"),
    ("0336_grc_policy_acknowledgement", "policy_acknowledgement", "0335_grc_policy_version"),
    ("0337_grc_control", "control", "0336_grc_policy_acknowledgement"),
    ("0338_grc_control_test", "control_test", "0337_grc_control"),
    ("0339_grc_risk_category", "risk_category", "0338_grc_control_test"),
    ("0340_grc_risk_register", "risk_register", "0339_grc_risk_category"),
    ("0341_grc_risk_assessment", "risk_assessment", "0340_grc_risk_register"),
    ("0342_grc_risk_treatment", "risk_treatment", "0341_grc_risk_assessment"),
    ("0343_grc_compliance_fw_req", ["compliance_framework", "compliance_requirement"], "0342_grc_risk_treatment"),
    ("0344_grc_compliance_assessment", "compliance_assessment", "0343_grc_compliance_fw_req"),
    ("0345_grc_audit_plan", "audit_plan", "0344_grc_compliance_assessment"),
    ("0346_grc_audit", "audit", "0345_grc_audit_plan"),
    ("0347_grc_audit_finding", "audit_finding", "0346_grc_audit"),
    ("0348_grc_corrective_action", "corrective_action", "0347_grc_audit_finding"),
    ("0349_grc_exception", "exception", "0348_grc_corrective_action"),
    ("0350_grc_incident", "incident", "0349_grc_exception"),
    ("0351_grc_notification", "notification", "0350_grc_incident"),
    ("0352_grc_report", "report", "0351_grc_notification"),
    ("0353_seed_grc_permissions", "seed_perms", "0352_grc_report"),
    ("0354_seed_grc_workflows", "seed_wf", "0353_seed_grc_permissions"),
]

# route prefix, schema name, service class, perm resource, branch_required
ROUTE_SPECS: list[tuple[str, str, str, str, bool]] = [
    ("policies", "Policy", "PolicyService", "grc.policy", False),
    ("policy-versions", "PolicyVersion", "PolicyVersionService", "grc.policy_version", False),
    ("policy-acknowledgements", "PolicyAcknowledgement", "PolicyAcknowledgementService", "grc.acknowledgement", False),
    ("controls", "Control", "ControlService", "grc.control", False),
    ("control-tests", "ControlTest", "ControlTestService", "grc.control_test", True),
    ("risk-categories", "RiskCategory", "RiskCategoryService", "grc.risk_category", False),
    ("risk-registers", "RiskRegister", "RiskRegisterService", "grc.risk", True),
    ("risk-assessments", "RiskAssessment", "RiskAssessmentService", "grc.risk_assessment", True),
    ("risk-treatments", "RiskTreatment", "RiskTreatmentService", "grc.risk_treatment", True),
    ("compliance-frameworks", "ComplianceFramework", "ComplianceFrameworkService", "grc.compliance_framework", False),
    ("compliance-requirements", "ComplianceRequirement", "ComplianceRequirementService", "grc.compliance_requirement", False),
    ("compliance-assessments", "ComplianceAssessment", "ComplianceAssessmentService", "grc.compliance_assessment", True),
    ("audit-plans", "AuditPlan", "AuditPlanService", "grc.audit_plan", False),
    ("audits", "Audit", "GrcAuditService", "grc.audit", True),
    ("audit-findings", "AuditFinding", "AuditFindingService", "grc.finding", True),
    ("corrective-actions", "CorrectiveAction", "CorrectiveActionService", "grc.corrective_action", True),
    ("exceptions", "Exception", "ExceptionService", "grc.exception", True),
    ("incidents", "Incident", "IncidentService", "grc.incident", True),
    ("notifications", "Notification", "NotificationService", "grc.notification", False),
    ("reports", "Report", "GrcReportService", "grc.report", False),
]

ENGINE_NAMES = [
    "Policy",
    "PolicyVersion",
    "PolicyAcknowledgement",
    "Control",
    "ControlTest",
    "RiskCategory",
    "RiskRegister",
    "RiskAssessment",
    "RiskTreatment",
    "ComplianceFramework",
    "ComplianceRequirement",
    "ComplianceAssessment",
    "AuditPlan",
    "Audit",
    "AuditFinding",
    "CorrectiveAction",
    "Exception",
    "Incident",
    "Notification",
    "Report",
]

ENGINE_FILE_MAP = {
    "Policy": "policy",
    "PolicyVersion": "policy_version",
    "PolicyAcknowledgement": "policy_acknowledgement",
    "Control": "control",
    "ControlTest": "control_test",
    "RiskCategory": "risk_category",
    "RiskRegister": "risk_register",
    "RiskAssessment": "risk_assessment",
    "RiskTreatment": "risk_treatment",
    "ComplianceFramework": "compliance_framework",
    "ComplianceRequirement": "compliance_requirement",
    "ComplianceAssessment": "compliance_assessment",
    "AuditPlan": "audit_plan",
    "Audit": "audit",
    "AuditFinding": "audit_finding",
    "CorrectiveAction": "corrective_action",
    "Exception": "exception",
    "Incident": "incident",
    "Notification": "notification",
    "Report": "report",
}


def _emp_fk(col: str, nullable: bool = True) -> str:
    null = "True" if nullable else "False"
    mapped = "UUID | None" if nullable else "UUID"
    return f'''
    {col}: Mapped[{mapped}] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable={null},
        index=True,
    )'''


def _dept_fk(col: str = "department_id", nullable: bool = True) -> str:
    null = "True" if nullable else "False"
    mapped = "UUID | None" if nullable else "UUID"
    return f'''
    {col}: Mapped[{mapped}] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable={null},
        index=True,
    )'''


def _uuid_only(col: str) -> str:
    return f'''
    {col}: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)'''


MODELS: dict[str, str] = {}

MODELS["policy"] = f'''"""Policy ORM per ERD_19 section 6.1."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcMasterMixin


class GrcPolicy(Base, *GrcMasterMixin):
    __tablename__ = "grc_policy"
    __table_args__ = (
        UniqueConstraint("company_id", "policy_number", name="uk_grc_policy_number"),
        CheckConstraint(
            "policy_type IN ('hr','finance','it','security','procurement','compliance','other')",
            name="ck_grc_policy_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','published','superseded','retired','cancelled')",
            name="ck_grc_policy_status",
        ),
        Index("ix_grc_policy_tenant_co_status", "tenant_id", "company_id", "status"),
        Index("ix_grc_policy_review_due", "review_due_at"),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    policy_number: Mapped[str] = mapped_column(String(50), nullable=False)
    policy_code: Mapped[str] = mapped_column(String(50), nullable=False)
    policy_name: Mapped[str] = mapped_column(String(255), nullable=False)
    policy_type: Mapped[str] = mapped_column(String(40), nullable=False)
{_emp_fk("owner_employee_id", nullable=False)}
{_dept_fk()}
    current_version_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    review_due_at: Mapped[date | None] = mapped_column(Date, nullable=True)
{_uuid_only("document_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["policy_version"] = f'''"""Policy version ORM per ERD_19 section 6.2."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcDetailMixin


class GrcPolicyVersion(Base, *GrcDetailMixin):
    __tablename__ = "grc_policy_version"
    __table_args__ = (
        UniqueConstraint("policy_id", "version_no", name="uk_grc_policy_version_no"),
        CheckConstraint(
            "status IN ('draft','published','superseded')",
            name="ck_grc_policy_version_status",
        ),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    policy_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_policy.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
{_uuid_only("document_id")}
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
{_emp_fk("created_by_employee_id")}
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
'''

MODELS["policy_acknowledgement"] = f'''"""Policy acknowledgement ORM per ERD_19 section 6.3."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcDetailMixin


class GrcPolicyAcknowledgement(Base, *GrcDetailMixin):
    __tablename__ = "grc_policy_acknowledgement"
    __table_args__ = (
        UniqueConstraint(
            "policy_id", "employee_id", "policy_version_id",
            name="uk_grc_policy_acknowledgement",
        ),
        CheckConstraint(
            "acknowledgement_method IN ('portal','email','training','paper')",
            name="ck_grc_policy_ack_method",
        ),
        CheckConstraint(
            "status IN ('pending','acknowledged','overdue','waived')",
            name="ck_grc_policy_ack_status",
        ),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    policy_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_policy.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    policy_version_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_policy_version.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
{_emp_fk("employee_id", nullable=False)}
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledgement_method: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", index=True)
'''

MODELS["control"] = f'''"""Control ORM per ERD_19 section 6.4."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcMasterMixin


class GrcControl(Base, *GrcMasterMixin):
    __tablename__ = "grc_control"
    __table_args__ = (
        UniqueConstraint("company_id", "control_number", name="uk_grc_control_number"),
        UniqueConstraint("company_id", "control_code", name="uk_grc_control_code"),
        CheckConstraint(
            "control_type IN ('preventive','detective','corrective','compensating')",
            name="ck_grc_control_type",
        ),
        CheckConstraint(
            "frequency IN ('continuous','daily','weekly','monthly','quarterly','annual','ad_hoc')",
            name="ck_grc_control_frequency",
        ),
        CheckConstraint(
            "status IN ('draft','active','inactive','retired')",
            name="ck_grc_control_status",
        ),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    control_number: Mapped[str] = mapped_column(String(50), nullable=False)
    control_code: Mapped[str] = mapped_column(String(50), nullable=False)
    control_name: Mapped[str] = mapped_column(String(255), nullable=False)
    control_type: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
{_emp_fk("owner_employee_id", nullable=False)}
{_dept_fk()}
    policy_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_policy.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    risk_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "grc.grc_risk_register.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_grc_control_risk",
        ),
        nullable=True,
        index=True,
    )
    frequency: Mapped[str | None] = mapped_column(String(30), nullable=True)
{_uuid_only("document_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
'''

MODELS["control_test"] = f'''"""Control test ORM per ERD_19 section 6.5."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcControlTest(Base, *GrcTransactionMixin):
    __tablename__ = "grc_control_test"
    __table_args__ = (
        UniqueConstraint("company_id", "test_number", name="uk_grc_control_test_number"),
        CheckConstraint(
            "test_result IN ('effective','partially_effective','ineffective','not_tested')",
            name="ck_grc_control_test_result",
        ),
        CheckConstraint(
            "status IN ('draft','completed','archived')",
            name="ck_grc_control_test_status",
        ),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    control_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_control.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    test_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_emp_fk("tested_by_employee_id", nullable=False)}
    tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    test_result: Mapped[str | None] = mapped_column(String(40), nullable=True)
    sample_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    findings_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
{_uuid_only("document_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
'''

MODELS["risk_category"] = f'''"""Risk category ORM per ERD_19 section 6.6."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcMasterMixin


class GrcRiskCategory(Base, *GrcMasterMixin):
    __tablename__ = "grc_risk_category"
    __table_args__ = (
        UniqueConstraint("company_id", "category_code", name="uk_grc_risk_category_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_grc_risk_category_status"),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    category_code: Mapped[str] = mapped_column(String(50), nullable=False)
    category_name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_category_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_risk_category.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["risk_register"] = f'''"""Risk register ORM per ERD_19 section 6.7."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcRiskRegister(Base, *GrcTransactionMixin):
    __tablename__ = "grc_risk_register"
    __table_args__ = (
        UniqueConstraint("company_id", "risk_number", name="uk_grc_risk_register_number"),
        CheckConstraint(
            "inherent_impact IS NULL OR (inherent_impact BETWEEN 1 AND 5)",
            name="ck_grc_risk_inherent_impact",
        ),
        CheckConstraint(
            "inherent_probability IS NULL OR (inherent_probability BETWEEN 1 AND 5)",
            name="ck_grc_risk_inherent_prob",
        ),
        CheckConstraint(
            "residual_impact IS NULL OR (residual_impact BETWEEN 1 AND 5)",
            name="ck_grc_risk_residual_impact",
        ),
        CheckConstraint(
            "residual_probability IS NULL OR (residual_probability BETWEEN 1 AND 5)",
            name="ck_grc_risk_residual_prob",
        ),
        CheckConstraint(
            "risk_level IS NULL OR risk_level IN ('low','medium','high','critical')",
            name="ck_grc_risk_level",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','open','mitigated','closed',"
            "'accepted','cancelled')",
            name="ck_grc_risk_register_status",
        ),
        Index("ix_grc_risk_tenant_co_status", "tenant_id", "company_id", "status"),
        Index("ix_grc_risk_next_review", "next_review_at"),
        Index("ix_grc_risk_category_id", "risk_category_id"),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    risk_number: Mapped[str] = mapped_column(String(50), nullable=False)
    risk_title: Mapped[str] = mapped_column(String(255), nullable=False)
    risk_category_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_risk_category.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
{_emp_fk("owner_employee_id", nullable=False)}
{_dept_fk()}
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    inherent_impact: Mapped[int | None] = mapped_column(Integer, nullable=True)
    inherent_probability: Mapped[int | None] = mapped_column(Integer, nullable=True)
    inherent_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    residual_impact: Mapped[int | None] = mapped_column(Integer, nullable=True)
    residual_probability: Mapped[int | None] = mapped_column(Integer, nullable=True)
    residual_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
{_uuid_only("project_id")}
{_uuid_only("asset_id")}
{_uuid_only("crm_opportunity_id")}
{_uuid_only("inventory_ref_id")}
{_uuid_only("production_order_id")}
{_uuid_only("document_id")}
    next_review_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["risk_assessment"] = f'''"""Risk assessment ORM per ERD_19 section 6.8."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcRiskAssessment(Base, *GrcTransactionMixin):
    __tablename__ = "grc_risk_assessment"
    __table_args__ = (
        UniqueConstraint("company_id", "assessment_number", name="uk_grc_risk_assessment_number"),
        CheckConstraint("impact IS NULL OR (impact BETWEEN 1 AND 5)", name="ck_grc_ras_impact"),
        CheckConstraint(
            "probability IS NULL OR (probability BETWEEN 1 AND 5)",
            name="ck_grc_ras_probability",
        ),
        CheckConstraint(
            "risk_level IS NULL OR risk_level IN ('low','medium','high','critical')",
            name="ck_grc_ras_level",
        ),
        CheckConstraint(
            "status IN ('draft','completed','archived')",
            name="ck_grc_risk_assessment_status",
        ),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    risk_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_risk_register.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assessment_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_emp_fk("assessed_by_employee_id", nullable=False)}
    assessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    impact: Mapped[int | None] = mapped_column(Integer, nullable=True)
    probability: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    assessment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
'''

MODELS["risk_treatment"] = f'''"""Risk treatment ORM per ERD_19 section 6.9."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcRiskTreatment(Base, *GrcTransactionMixin):
    __tablename__ = "grc_risk_treatment"
    __table_args__ = (
        UniqueConstraint("company_id", "treatment_number", name="uk_grc_risk_treatment_number"),
        CheckConstraint(
            "treatment_strategy IN ('accept','avoid','reduce','transfer')",
            name="ck_grc_treatment_strategy",
        ),
        CheckConstraint(
            "status IN ('draft','planned','in_progress','completed','deferred','cancelled')",
            name="ck_grc_risk_treatment_status",
        ),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    risk_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_risk_register.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    treatment_number: Mapped[str] = mapped_column(String(50), nullable=False)
    treatment_strategy: Mapped[str] = mapped_column(String(30), nullable=False)
    action_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
{_emp_fk("owner_employee_id", nullable=False)}
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    control_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_control.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
'''

MODELS["compliance_framework"] = f'''"""Compliance framework ORM per ERD_19 section 6.10."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcMasterMixin


class GrcComplianceFramework(Base, *GrcMasterMixin):
    __tablename__ = "grc_compliance_framework"
    __table_args__ = (
        UniqueConstraint("company_id", "framework_code", name="uk_grc_compliance_framework_code"),
        CheckConstraint(
            "framework_type IN ('regulatory','standard','internal','contractual')",
            name="ck_grc_framework_type",
        ),
        CheckConstraint(
            "status IN ('active','inactive','retired')",
            name="ck_grc_compliance_framework_status",
        ),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    framework_code: Mapped[str] = mapped_column(String(50), nullable=False)
    framework_name: Mapped[str] = mapped_column(String(255), nullable=False)
    framework_type: Mapped[str] = mapped_column(String(40), nullable=False)
    jurisdiction: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
{_emp_fk("owner_employee_id")}
{_uuid_only("document_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["compliance_requirement"] = f'''"""Compliance requirement ORM per ERD_19 section 6.11."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcMasterMixin


class GrcComplianceRequirement(Base, *GrcMasterMixin):
    __tablename__ = "grc_compliance_requirement"
    __table_args__ = (
        UniqueConstraint(
            "framework_id", "requirement_code",
            name="uk_grc_compliance_requirement_code",
        ),
        CheckConstraint(
            "compliance_area IN ('tax','labor','financial','info_security',"
            "'environmental','industry','other')",
            name="ck_grc_compliance_area",
        ),
        CheckConstraint("status IN ('active','inactive')", name="ck_grc_compliance_req_status"),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    framework_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_compliance_framework.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    requirement_code: Mapped[str] = mapped_column(String(50), nullable=False)
    requirement_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    compliance_area: Mapped[str | None] = mapped_column(String(40), nullable=True)
{_emp_fk("owner_employee_id")}
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["compliance_assessment"] = f'''"""Compliance assessment ORM per ERD_19 section 6.12."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcComplianceAssessment(Base, *GrcTransactionMixin):
    __tablename__ = "grc_compliance_assessment"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "assessment_number",
            name="uk_grc_compliance_assessment_number",
        ),
        CheckConstraint(
            "compliance_status IN ('compliant','partially_compliant','non_compliant')",
            name="ck_grc_compliance_status",
        ),
        CheckConstraint(
            "status IN ('draft','completed','overdue','archived')",
            name="ck_grc_compliance_assessment_status",
        ),
        Index("ix_grc_compliance_status_col", "compliance_status"),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    requirement_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_compliance_requirement.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assessment_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_emp_fk("assessed_by_employee_id", nullable=False)}
    assessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    compliance_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    evidence_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
{_uuid_only("document_id")}
    next_due_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
'''

MODELS["audit_plan"] = f'''"""Audit plan ORM per ERD_19 section 6.13."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcMasterMixin


class GrcAuditPlan(Base, *GrcMasterMixin):
    __tablename__ = "grc_audit_plan"
    __table_args__ = (
        UniqueConstraint("company_id", "plan_code", name="uk_grc_audit_plan_code"),
        CheckConstraint(
            "status IN ('draft','approved','active','closed')",
            name="ck_grc_audit_plan_status",
        ),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    plan_code: Mapped[str] = mapped_column(String(50), nullable=False)
    plan_name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
{_emp_fk("owner_employee_id", nullable=False)}
    scope_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
'''

MODELS["audit"] = f'''"""Audit ORM per ERD_19 section 6.14."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcAudit(Base, *GrcTransactionMixin):
    __tablename__ = "grc_audit"
    __table_args__ = (
        UniqueConstraint("company_id", "audit_number", name="uk_grc_audit_number"),
        CheckConstraint(
            "audit_type IN ('internal','external','compliance','financial','operational','it')",
            name="ck_grc_audit_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','planned','in_progress',"
            "'completed','closed','cancelled')",
            name="ck_grc_audit_status",
        ),
        Index("ix_grc_audit_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    audit_number: Mapped[str] = mapped_column(String(50), nullable=False)
    audit_plan_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_audit_plan.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    audit_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
{_emp_fk("lead_auditor_employee_id", nullable=False)}
{_dept_fk()}
    planned_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_end: Mapped[date | None] = mapped_column(Date, nullable=True)
{_uuid_only("document_id")}
{_uuid_only("project_id")}
{_uuid_only("quality_nonconformance_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["audit_finding"] = f'''"""Audit finding ORM per ERD_19 section 6.15."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcAuditFinding(Base, *GrcTransactionMixin):
    __tablename__ = "grc_audit_finding"
    __table_args__ = (
        UniqueConstraint("company_id", "finding_number", name="uk_grc_audit_finding_number"),
        CheckConstraint(
            "severity IN ('observation','minor','major','critical')",
            name="ck_grc_finding_severity",
        ),
        CheckConstraint(
            "status IN ('open','in_remediation','closed','accepted')",
            name="ck_grc_audit_finding_status",
        ),
        Index("ix_grc_finding_severity", "severity"),
        Index("ix_grc_finding_due_date", "due_date"),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    audit_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_audit.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    finding_number: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_required: Mapped[str | None] = mapped_column(Text, nullable=True)
{_emp_fk("owner_employee_id")}
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    control_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_control.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    risk_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_risk_register.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
{_uuid_only("document_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)
'''

MODELS["corrective_action"] = f'''"""Corrective action ORM per ERD_19 section 6.16."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcCorrectiveAction(Base, *GrcTransactionMixin):
    __tablename__ = "grc_corrective_action"
    __table_args__ = (
        UniqueConstraint("company_id", "capa_number", name="uk_grc_corrective_action_number"),
        CheckConstraint(
            "effectiveness_result IS NULL OR effectiveness_result IN "
            "('effective','ineffective','pending')",
            name="ck_grc_capa_effectiveness",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','open','in_progress',"
            "'completed','verified','cancelled')",
            name="ck_grc_corrective_action_status",
        ),
        Index("ix_grc_capa_tenant_co_status", "tenant_id", "company_id", "status"),
        Index("ix_grc_capa_due_date", "due_date"),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    capa_number: Mapped[str] = mapped_column(String(50), nullable=False)
    finding_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_audit_finding.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    incident_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "grc.grc_incident.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_grc_capa_incident",
        ),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
{_emp_fk("owner_employee_id", nullable=False)}
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effectiveness_result: Mapped[str | None] = mapped_column(String(30), nullable=True)
{_uuid_only("document_id")}
{_uuid_only("quality_nonconformance_id")}
{_uuid_only("helpdesk_ticket_id")}
{_uuid_only("finance_journal_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["exception"] = f'''"""Exception ORM per ERD_19 section 6.17."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcException(Base, *GrcTransactionMixin):
    __tablename__ = "grc_exception"
    __table_args__ = (
        UniqueConstraint("company_id", "exception_number", name="uk_grc_exception_number"),
        CheckConstraint(
            "exception_type IN ('unauthorized_access','approval_bypass','process_violation',"
            "'security_exception','policy_deviation','other')",
            name="ck_grc_exception_type",
        ),
        CheckConstraint(
            "status IN ('draft','open','under_investigation','approved','rejected',"
            "'closed','expired')",
            name="ck_grc_exception_status",
        ),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    exception_number: Mapped[str] = mapped_column(String(50), nullable=False)
    exception_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
{_emp_fk("requested_by_employee_id", nullable=False)}
{_emp_fk("approver_employee_id")}
    policy_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_policy.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    control_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_control.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    risk_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_risk_register.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
{_uuid_only("document_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
'''

MODELS["incident"] = f'''"""Incident ORM per ERD_19 section 6.18."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcIncident(Base, *GrcTransactionMixin):
    __tablename__ = "grc_incident"
    __table_args__ = (
        UniqueConstraint("company_id", "incident_number", name="uk_grc_incident_number"),
        CheckConstraint(
            "incident_type IN ('compliance','security','operational','safety','fraud','other')",
            name="ck_grc_incident_type",
        ),
        CheckConstraint(
            "severity IS NULL OR severity IN ('low','medium','high','critical')",
            name="ck_grc_incident_severity",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','under_review','open','contained',"
            "'resolved','closed','cancelled')",
            name="ck_grc_incident_status",
        ),
        Index("ix_grc_incident_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    incident_number: Mapped[str] = mapped_column(String(50), nullable=False)
    incident_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
{_emp_fk("reported_by_employee_id", nullable=False)}
{_emp_fk("owner_employee_id")}
    customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
{_dept_fk()}
    risk_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_risk_register.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    control_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_control.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    detected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
{_uuid_only("helpdesk_ticket_id")}
{_uuid_only("service_request_id")}
{_uuid_only("project_id")}
{_uuid_only("quality_nonconformance_id")}
{_uuid_only("asset_id")}
{_uuid_only("document_id")}
{_uuid_only("finance_journal_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["notification"] = f'''"""GRC notification ORM per ERD_19 section 6.19."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcMasterMixin


class GrcNotification(Base, *GrcMasterMixin):
    __tablename__ = "grc_notification"
    __table_args__ = (
        CheckConstraint(
            "related_entity_type IN ('policy','risk','audit','capa','exception',"
            "'incident','compliance','other')",
            name="ck_grc_notification_entity",
        ),
        CheckConstraint(
            "notification_type IN ('policy_review_due','risk_review_due','audit_due',"
            "'capa_overdue','compliance_due','incident_escalation',"
            "'acknowledgement_overdue','other')",
            name="ck_grc_notification_type",
        ),
        CheckConstraint(
            "delivery_status IN ('pending','sent','failed','read')",
            name="ck_grc_notification_delivery",
        ),
        CheckConstraint("status IN ('active','archived')", name="ck_grc_notification_status"),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    related_entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    related_entity_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    notification_type: Mapped[str] = mapped_column(String(40), nullable=False)
    recipient_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
{_emp_fk("recipient_employee_id")}
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["report"] = f'''"""GRC report ORM per ERD_19 section 6.20."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcMasterMixin


class GrcReport(Base, *GrcMasterMixin):
    __tablename__ = "grc_report"
    __table_args__ = (
        UniqueConstraint("company_id", "report_code", name="uk_grc_report_code"),
        CheckConstraint(
            "report_type IN ('risk_heat_map','control_effectiveness','compliance_posture',"
            "'audit_status','capa_aging','incident_volume','exception_register',"
            "'policy_ack_rate')",
            name="ck_grc_report_type",
        ),
        CheckConstraint("status IN ('draft','finalized')", name="ck_grc_report_status"),
        {{"schema": "grc"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    report_code: Mapped[str] = mapped_column(String(50), nullable=False)
    report_type: Mapped[str] = mapped_column(String(40), nullable=False)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
{_dept_fk()}
    metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
'''

ENGINE_IMPORTS = """
from modules.grc.domain.enums import (
    AuditFindingStatus,
    AuditPlanStatus,
    AuditStatus,
    ComplianceAssessmentStatus,
    ComplianceFrameworkStatus,
    ComplianceRequirementStatus,
    ControlStatus,
    ControlTestStatus,
    CorrectiveActionStatus,
    ExceptionStatus,
    IncidentStatus,
    NotificationStatus,
    PolicyAcknowledgementStatus,
    PolicyStatus,
    PolicyVersionStatus,
    ReportStatus,
    RiskAssessmentStatus,
    RiskCategoryStatus,
    RiskRegisterStatus,
    RiskTreatmentStatus,
)
from modules.grc.domain.exceptions import (
    InvalidAuditState,
    InvalidCorrectiveActionState,
    InvalidExceptionState,
    InvalidIncidentState,
    InvalidPolicyState,
    InvalidRiskRegisterState,
)
"""

ENGINE_BODIES: dict[str, str] = {
    "Policy": '''
class PolicyEngine:
    def submit(self, row) -> None:
        if row.status != PolicyStatus.DRAFT.value:
            raise InvalidPolicyState("Only draft policies can be submitted")
        row.status = PolicyStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != PolicyStatus.SUBMITTED.value:
            raise InvalidPolicyState("Only submitted policies can be approved")
        row.status = PolicyStatus.APPROVED.value

    def publish(self, row) -> None:
        if row.status != PolicyStatus.APPROVED.value:
            raise InvalidPolicyState("Only approved policies can be published")
        row.status = PolicyStatus.PUBLISHED.value

    def supersede(self, row) -> None:
        row.status = PolicyStatus.SUPERSEDED.value

    def retire(self, row) -> None:
        row.status = PolicyStatus.RETIRED.value

    def cancel(self, row) -> None:
        row.status = PolicyStatus.CANCELLED.value
''',
    "PolicyVersion": '''
class PolicyVersionEngine:
    def publish(self, row) -> None:
        row.status = PolicyVersionStatus.PUBLISHED.value
        row.is_current = True

    def supersede(self, row) -> None:
        row.status = PolicyVersionStatus.SUPERSEDED.value
        row.is_current = False
''',
    "PolicyAcknowledgement": '''
class PolicyAcknowledgementEngine:
    def acknowledge(self, row) -> None:
        row.status = PolicyAcknowledgementStatus.ACKNOWLEDGED.value

    def mark_overdue(self, row) -> None:
        row.status = PolicyAcknowledgementStatus.OVERDUE.value

    def waive(self, row) -> None:
        row.status = PolicyAcknowledgementStatus.WAIVED.value
''',
    "Control": '''
class ControlEngine:
    def activate(self, row) -> None:
        row.status = ControlStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = ControlStatus.INACTIVE.value

    def retire(self, row) -> None:
        row.status = ControlStatus.RETIRED.value
''',
    "ControlTest": '''
class ControlTestEngine:
    def complete(self, row) -> None:
        row.status = ControlTestStatus.COMPLETED.value

    def archive(self, row) -> None:
        row.status = ControlTestStatus.ARCHIVED.value
''',
    "RiskCategory": '''
class RiskCategoryEngine:
    def activate(self, row) -> None:
        row.status = RiskCategoryStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = RiskCategoryStatus.INACTIVE.value
''',
    "RiskRegister": '''
class RiskRegisterEngine:
    def submit(self, row) -> None:
        if row.status != RiskRegisterStatus.DRAFT.value:
            raise InvalidRiskRegisterState("Only draft risks can be submitted")
        row.status = RiskRegisterStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != RiskRegisterStatus.SUBMITTED.value:
            raise InvalidRiskRegisterState("Only submitted risks can be approved")
        row.status = RiskRegisterStatus.APPROVED.value

    def open(self, row) -> None:
        row.status = RiskRegisterStatus.OPEN.value

    def mitigate(self, row) -> None:
        row.status = RiskRegisterStatus.MITIGATED.value

    def accept(self, row) -> None:
        row.status = RiskRegisterStatus.ACCEPTED.value

    def close(self, row) -> None:
        row.status = RiskRegisterStatus.CLOSED.value

    def cancel(self, row) -> None:
        row.status = RiskRegisterStatus.CANCELLED.value
''',
    "RiskAssessment": '''
class RiskAssessmentEngine:
    def complete(self, row) -> None:
        row.status = RiskAssessmentStatus.COMPLETED.value

    def archive(self, row) -> None:
        row.status = RiskAssessmentStatus.ARCHIVED.value
''',
    "RiskTreatment": '''
class RiskTreatmentEngine:
    def plan(self, row) -> None:
        row.status = RiskTreatmentStatus.PLANNED.value

    def start(self, row) -> None:
        row.status = RiskTreatmentStatus.IN_PROGRESS.value

    def complete(self, row) -> None:
        row.status = RiskTreatmentStatus.COMPLETED.value

    def defer(self, row) -> None:
        row.status = RiskTreatmentStatus.DEFERRED.value

    def cancel(self, row) -> None:
        row.status = RiskTreatmentStatus.CANCELLED.value
''',
    "ComplianceFramework": '''
class ComplianceFrameworkEngine:
    def activate(self, row) -> None:
        row.status = ComplianceFrameworkStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = ComplianceFrameworkStatus.INACTIVE.value

    def retire(self, row) -> None:
        row.status = ComplianceFrameworkStatus.RETIRED.value
''',
    "ComplianceRequirement": '''
class ComplianceRequirementEngine:
    def activate(self, row) -> None:
        row.status = ComplianceRequirementStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = ComplianceRequirementStatus.INACTIVE.value
''',
    "ComplianceAssessment": '''
class ComplianceAssessmentEngine:
    def complete(self, row) -> None:
        row.status = ComplianceAssessmentStatus.COMPLETED.value

    def mark_overdue(self, row) -> None:
        row.status = ComplianceAssessmentStatus.OVERDUE.value

    def archive(self, row) -> None:
        row.status = ComplianceAssessmentStatus.ARCHIVED.value
''',
    "AuditPlan": '''
class AuditPlanEngine:
    def approve(self, row) -> None:
        row.status = AuditPlanStatus.APPROVED.value

    def activate(self, row) -> None:
        row.status = AuditPlanStatus.ACTIVE.value

    def close(self, row) -> None:
        row.status = AuditPlanStatus.CLOSED.value
''',
    "Audit": '''
class AuditEngine:
    def submit(self, row) -> None:
        if row.status != AuditStatus.DRAFT.value:
            raise InvalidAuditState("Only draft audits can be submitted")
        row.status = AuditStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != AuditStatus.SUBMITTED.value:
            raise InvalidAuditState("Only submitted audits can be approved")
        row.status = AuditStatus.APPROVED.value

    def plan(self, row) -> None:
        row.status = AuditStatus.PLANNED.value

    def start(self, row) -> None:
        row.status = AuditStatus.IN_PROGRESS.value

    def complete(self, row) -> None:
        row.status = AuditStatus.COMPLETED.value

    def close(self, row) -> None:
        row.status = AuditStatus.CLOSED.value

    def cancel(self, row) -> None:
        row.status = AuditStatus.CANCELLED.value
''',
    "AuditFinding": '''
class AuditFindingEngine:
    def remediate(self, row) -> None:
        row.status = AuditFindingStatus.IN_REMEDIATION.value

    def close(self, row) -> None:
        row.status = AuditFindingStatus.CLOSED.value

    def accept(self, row) -> None:
        row.status = AuditFindingStatus.ACCEPTED.value
''',
    "CorrectiveAction": '''
class CorrectiveActionEngine:
    def submit(self, row) -> None:
        if row.status != CorrectiveActionStatus.DRAFT.value:
            raise InvalidCorrectiveActionState("Only draft CAPAs can be submitted")
        row.status = CorrectiveActionStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != CorrectiveActionStatus.SUBMITTED.value:
            raise InvalidCorrectiveActionState("Only submitted CAPAs can be approved")
        row.status = CorrectiveActionStatus.APPROVED.value

    def open(self, row) -> None:
        row.status = CorrectiveActionStatus.OPEN.value

    def start(self, row) -> None:
        row.status = CorrectiveActionStatus.IN_PROGRESS.value

    def complete(self, row) -> None:
        if row.status not in {
            CorrectiveActionStatus.APPROVED.value,
            CorrectiveActionStatus.OPEN.value,
            CorrectiveActionStatus.IN_PROGRESS.value,
        }:
            raise InvalidCorrectiveActionState("CAPA not completable")
        row.status = CorrectiveActionStatus.COMPLETED.value

    def verify(self, row) -> None:
        row.status = CorrectiveActionStatus.VERIFIED.value

    def cancel(self, row) -> None:
        row.status = CorrectiveActionStatus.CANCELLED.value
''',
    "Exception": '''
class ExceptionEngine:
    def open(self, row) -> None:
        row.status = ExceptionStatus.OPEN.value

    def investigate(self, row) -> None:
        row.status = ExceptionStatus.UNDER_INVESTIGATION.value

    def approve(self, row) -> None:
        if row.status not in {
            ExceptionStatus.DRAFT.value,
            ExceptionStatus.OPEN.value,
            ExceptionStatus.UNDER_INVESTIGATION.value,
        }:
            raise InvalidExceptionState("Exception not approvable")
        row.status = ExceptionStatus.APPROVED.value

    def reject(self, row) -> None:
        row.status = ExceptionStatus.REJECTED.value

    def close(self, row) -> None:
        row.status = ExceptionStatus.CLOSED.value

    def expire(self, row) -> None:
        row.status = ExceptionStatus.EXPIRED.value
''',
    "Incident": '''
class IncidentEngine:
    def submit(self, row) -> None:
        if row.status != IncidentStatus.DRAFT.value:
            raise InvalidIncidentState("Only draft incidents can be submitted")
        row.status = IncidentStatus.SUBMITTED.value

    def review(self, row) -> None:
        if row.status != IncidentStatus.SUBMITTED.value:
            raise InvalidIncidentState("Only submitted incidents can be reviewed")
        row.status = IncidentStatus.UNDER_REVIEW.value

    def open(self, row) -> None:
        row.status = IncidentStatus.OPEN.value

    def contain(self, row) -> None:
        row.status = IncidentStatus.CONTAINED.value

    def resolve(self, row) -> None:
        row.status = IncidentStatus.RESOLVED.value

    def close(self, row) -> None:
        if row.status not in {
            IncidentStatus.UNDER_REVIEW.value,
            IncidentStatus.OPEN.value,
            IncidentStatus.CONTAINED.value,
            IncidentStatus.RESOLVED.value,
        }:
            raise InvalidIncidentState("Incident not closable")
        row.status = IncidentStatus.CLOSED.value

    def cancel(self, row) -> None:
        row.status = IncidentStatus.CANCELLED.value
''',
    "Notification": '''
class NotificationEngine:
    def archive(self, row) -> None:
        row.status = NotificationStatus.ARCHIVED.value
''',
    "Report": '''
class ReportEngine:
    def finalize(self, row) -> None:
        row.status = ReportStatus.FINALIZED.value
''',
}


def gen_scaffold() -> None:
    w(GRC / "__init__.py", '"""Governance, Risk & Compliance module — Sprint 19."""\n')
    w(GRC / "domain" / "__init__.py", '"""GRC domain layer."""\n')
    w(GRC / "adapters" / "__init__.py", '"""GRC cross-module adapters."""\n')
    w(GRC / "service" / "__init__.py", '"""GRC services — populated after generation."""\n')
    w(GRC / "service" / "engines" / "__init__.py", '"""GRC engines — populated after generation."""\n')
    w(GRC / "repository" / "__init__.py", '"""GRC repositories."""\n')
    w(GRC / "models" / "__init__.py", '"""GRC models — populated after generation."""\n')
    w(
        GRC / "models" / "mixins.py",
        '''"""GRC ORM mixin bundles per ERD_19."""

from database.mixins import (
    AuditMixin,
    BranchMixin,
    CompanyMixin,
    SoftDeleteMixin,
    TenantMixin,
    VersionMixin,
)

GrcMasterMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    SoftDeleteMixin,
    VersionMixin,
)

GrcTransactionMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    BranchMixin,
    SoftDeleteMixin,
    VersionMixin,
)

GrcDetailMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    SoftDeleteMixin,
    VersionMixin,
)
''',
    )


def gen_domain() -> None:
    w(
        GRC / "domain" / "enums.py",
        '''"""GRC domain enums per ERD_19 section 11."""

from enum import Enum


class PolicyStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"
    SUPERSEDED = "superseded"
    RETIRED = "retired"
    CANCELLED = "cancelled"


class PolicyVersionStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    SUPERSEDED = "superseded"


class PolicyAcknowledgementStatus(str, Enum):
    PENDING = "pending"
    ACKNOWLEDGED = "acknowledged"
    OVERDUE = "overdue"
    WAIVED = "waived"


class ControlStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    RETIRED = "retired"


class ControlTestStatus(str, Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class RiskCategoryStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class RiskRegisterStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    OPEN = "open"
    MITIGATED = "mitigated"
    CLOSED = "closed"
    ACCEPTED = "accepted"
    CANCELLED = "cancelled"


class RiskAssessmentStatus(str, Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class RiskTreatmentStatus(str, Enum):
    DRAFT = "draft"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DEFERRED = "deferred"
    CANCELLED = "cancelled"


class ComplianceFrameworkStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    RETIRED = "retired"


class ComplianceRequirementStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ComplianceAssessmentStatus(str, Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    ARCHIVED = "archived"


class AuditPlanStatus(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    ACTIVE = "active"
    CLOSED = "closed"


class AuditStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class AuditFindingStatus(str, Enum):
    OPEN = "open"
    IN_REMEDIATION = "in_remediation"
    CLOSED = "closed"
    ACCEPTED = "accepted"


class CorrectiveActionStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    VERIFIED = "verified"
    CANCELLED = "cancelled"


class ExceptionStatus(str, Enum):
    DRAFT = "draft"
    OPEN = "open"
    UNDER_INVESTIGATION = "under_investigation"
    APPROVED = "approved"
    REJECTED = "rejected"
    CLOSED = "closed"
    EXPIRED = "expired"


class IncidentStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    OPEN = "open"
    CONTAINED = "contained"
    RESOLVED = "resolved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class NotificationStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class ReportStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class GrcEntityType(str, Enum):
    POLICY = "policy"
    CONTROL = "control"
    CONTROL_TEST = "control_test"
    RISK = "risk"
    RISK_ASSESSMENT = "risk_assessment"
    RISK_TREATMENT = "risk_treatment"
    COMPLIANCE_ASSESSMENT = "compliance_assessment"
    AUDIT = "audit"
    FINDING = "finding"
    CAPA = "capa"
    EXCEPTION = "exception"
    INCIDENT = "incident"
    CATEGORY = "category"
    FRAMEWORK = "framework"
    PLAN = "plan"
    REPORT = "report"


CODE_PREFIXES: dict[GrcEntityType, tuple[str, int, bool]] = {
    GrcEntityType.POLICY: ("POL-", 6, True),
    GrcEntityType.CONTROL: ("CTL-", 6, True),
    GrcEntityType.CONTROL_TEST: ("CTT-", 6, True),
    GrcEntityType.RISK: ("RSK-", 6, True),
    GrcEntityType.RISK_ASSESSMENT: ("RAS-", 6, True),
    GrcEntityType.RISK_TREATMENT: ("RTR-", 6, True),
    GrcEntityType.COMPLIANCE_ASSESSMENT: ("CMP-", 6, True),
    GrcEntityType.AUDIT: ("AUD-", 6, True),
    GrcEntityType.FINDING: ("FND-", 6, True),
    GrcEntityType.CAPA: ("CAPA-", 6, True),
    GrcEntityType.EXCEPTION: ("EXC-", 6, True),
    GrcEntityType.INCIDENT: ("INC-", 6, True),
    GrcEntityType.CATEGORY: ("RCAT-", 6, False),
    GrcEntityType.FRAMEWORK: ("CFW-", 6, False),
    GrcEntityType.PLAN: ("APLN-", 6, False),
    GrcEntityType.REPORT: ("GRPT-", 6, False),
}
''',
    )
    exc_lines = []
    for _, _, name, _ in TABLES:
        exc_lines.append(
            f'''
class Invalid{name}State(ConflictException):
    def __init__(self, message: str = "Invalid {name.lower()} state") -> None:
        super().__init__(message)
'''
        )
    w(
        GRC / "domain" / "exceptions.py",
        '"""GRC domain exceptions."""\n\nfrom core.exceptions import ConflictException\n'
        + "".join(exc_lines),
    )
    w(
        GRC / "domain" / "value_objects.py",
        '''"""GRC value objects."""

from dataclasses import dataclass


@dataclass(frozen=True)
class GrcCodes:
    document_number: str
''',
    )
    w(
        GRC / "domain" / "entities.py",
        '''"""GRC domain entity markers."""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class PolicyIdentity:
    policy_id: UUID
    policy_number: str
    owner_employee_id: UUID
''',
    )


def gen_models() -> None:
    for key, body in MODELS.items():
        w(GRC / "models" / f"{key}.py", body)
    imports = "\n".join(f"from modules.grc.models.{k} import {CLASS_MAP[k]}" for k in CLASS_MAP)
    all_names = ",\n    ".join(f'"{CLASS_MAP[k]}"' for k in CLASS_MAP)
    w(
        GRC / "models" / "__init__.py",
        f'"""GRC ORM models."""\n\n{imports}\n\n__all__ = [\n    {all_names},\n]\n',
    )


def gen_migrations() -> None:
    w(
        ALEMBIC / "0333_create_grc_schema.py",
        '''"""Create grc schema."""

from collections.abc import Sequence

from alembic import op

revision: str = "0333_create_grc_schema"
down_revision: str | None = "0332_seed_document_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS grc")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS grc CASCADE")
''',
    )
    for rev, target, down in MIGRATIONS:
        if target == "schema" or (isinstance(target, str) and target.startswith("seed")):
            continue
        if isinstance(target, list):
            imports = "\n".join(
                f"from modules.grc.models.{m} import {CLASS_MAP[m]}  # noqa: F401"
                for m in target
            )
            creates = "\n    ".join(
                f"{CLASS_MAP[m]}.__table__.create(bind=op.get_bind(), checkfirst=True)" for m in target
            )
            drops = "\n    ".join(
                f"{CLASS_MAP[m]}.__table__.drop(bind=op.get_bind(), checkfirst=True)"
                for m in reversed(target)
            )
            w(
                ALEMBIC / f"{rev}.py",
                f'''"""Create grc compliance framework and requirement tables."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

{imports}

revision: str = "{rev}"
down_revision: str | None = "{down}"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    {creates}


def downgrade() -> None:
    {drops}
''',
            )
        else:
            cls = CLASS_MAP[target]
            w(
                ALEMBIC / f"{rev}.py",
                f'''"""Create {cls} table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.grc.models.{target} import {cls}  # noqa: F401

revision: str = "{rev}"
down_revision: str | None = "{down}"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    {cls}.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    {cls}.__table__.drop(bind=op.get_bind(), checkfirst=True)
''',
            )

def repo_template(module: str, cls: str, name: str, branch: bool) -> str:
    return f'''"""GRC {cls} repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.grc.models import {cls}
from modules.grc.repository.base import GrcScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class {name}Repository(GrcScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> {cls} | None:
        stmt = select({cls}).where({cls}.id == row_id, {cls}.is_deleted.is_(False))
        stmt = self.apply_grc_filter(stmt, {cls}, ctx, branch_scoped={branch})
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select({cls}).where(
            {cls}.company_id == company_id,
            {cls}.is_deleted.is_(False),
        )
        stmt = self.apply_grc_filter(stmt, {cls}, ctx, branch_scoped={branch})
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> {cls}:
        row = {cls}(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> {cls} | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
'''


def gen_repos() -> None:
    w(
        GRC / "repository" / "base.py",
        '''"""GRC scoped repository base."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.base import OrgScopedRepository


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class GrcScopedRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    @staticmethod
    def apply_grc_filter(stmt, model, ctx: TenantContext, *, branch_scoped: bool = False):
        stmt = GrcScopedRepository.apply_tenant_filter(stmt, model, ctx)
        if ctx.company_id and ctx.user_type not in {"super_admin", "tenant_admin"}:
            stmt = stmt.where(model.company_id == ctx.company_id)
        if (
            branch_scoped
            and ctx.branch_id
            and ctx.user_type not in {"super_admin", "tenant_admin"}
            and hasattr(model, "branch_id")
        ):
            stmt = stmt.where(model.branch_id == ctx.branch_id)
        return stmt

    @staticmethod
    def resolve_company_id(ctx: TenantContext, company_id: UUID | None) -> UUID:
        if company_id is not None:
            GrcScopedRepository.ensure_company_access(ctx, company_id)
            return company_id
        if ctx.company_id is None:
            raise ForbiddenException("Company context required")
        return ctx.company_id
''',
    )
    w(
        GRC / "repository" / "code_sequence_repository.py",
        '''"""GRC code sequences."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.grc.domain.enums import CODE_PREFIXES, GrcEntityType


class CodeSequenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def next_code(self, entity: GrcEntityType, company_id: UUID, model, code_column: str) -> str:
        prefix, width, include_year = CODE_PREFIXES[entity]
        year = datetime.now(timezone.utc).year
        full_prefix = f"{prefix}{year}-" if include_year else prefix
        stmt = select(getattr(model, code_column)).where(
            model.company_id == company_id,
            getattr(model, code_column).like(f"{full_prefix}%"),
            model.is_deleted.is_(False),
        )
        existing = list(self.db.scalars(stmt).all())
        seq = 1
        if existing:
            nums = []
            for code in existing:
                try:
                    nums.append(int(str(code).rsplit("-", 1)[-1]))
                except ValueError:
                    continue
            if nums:
                seq = max(nums) + 1
        return f"{full_prefix}{seq:0{width}d}"
''',
    )
    for module, cls, name, branch in TABLES:
        w(GRC / "repository" / f"{module}_repository.py", repo_template(module, cls, name, branch))


def gen_engines() -> None:
    for eng_name, body in ENGINE_BODIES.items():
        fname = ENGINE_FILE_MAP[eng_name]
        w(
            GRC / "service" / "engines" / f"{fname}_engine.py",
            f'"""{eng_name} lifecycle engine."""\n{ENGINE_IMPORTS}\n{body}\n',
        )
    lines = [
        f"from modules.grc.service.engines.{ENGINE_FILE_MAP[n]}_engine import {n}Engine"
        for n in ENGINE_NAMES
    ]
    all_names = ",\n    ".join(f'"{n}Engine"' for n in ENGINE_NAMES)
    w(
        GRC / "service" / "engines" / "__init__.py",
        '"""GRC business engines."""\n\n'
        + "\n".join(lines)
        + f"\n\n__all__ = [\n    {all_names},\n]\n",
    )


def catalog_service(
    svc_name: str,
    cls: str,
    repo_name: str,
    entity: str,
    branch: bool,
    engine_name: str,
) -> str:
    branch_arg = ", *, branch_id: UUID | None = None" if branch else ""
    branch_fields = (
        "\n        if branch_id is not None:\n"
        "            self._scope.validate_branch_access(ctx, branch_id)\n"
        if branch
        else ""
    )
    branch_create = "branch_id=branch_id," if branch else ""
    return f'''"""{svc_name} application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.grc.models import {cls}
from modules.grc.repository.{entity}_repository import {repo_name}Repository
from modules.grc.service.grc_scope_validator import GrcScopeValidator
from modules.grc.service.engines import {engine_name}Engine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class {svc_name}:
    def __init__(self, db: Session) -> None:
        self._repo = {repo_name}Repository(db)
        self._scope = GrcScopeValidator(db)
        self._engine = {engine_name}Engine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> {cls}:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("{svc_name} not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None{branch_arg}, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
{branch_fields}
        row = self._repo.create(ctx, company_id=cid, {branch_create} **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="grc_{entity}",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("{svc_name} not found")
        return row
'''


def numbered_service(
    svc_name: str,
    cls: str,
    repo_name: str,
    entity: str,
    entity_type: str,
    code_col: str,
    branch_required: bool,
    engine_name: str,
    actions: list[str],
) -> str:
    if branch_required:
        create_body = f'''
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(GrcEntityType.{entity_type}, cid, {cls}, "{code_col}")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, {code_col}=doc, **fields)
'''
        create_sig = "self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields"
    else:
        create_body = f'''
        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(GrcEntityType.{entity_type}, cid, {cls}, "{code_col}")
        return self._repo.create(ctx, company_id=cid, {code_col}=doc, **fields)
'''
        create_sig = "self, ctx: TenantContext, company_id: UUID | None = None, **fields"

    action_methods = ""
    for act in actions:
        action_methods += f'''
    def {act}(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.{act}(row)
        return self._repo.update(ctx, row_id, status=row.status)
'''

    return f'''"""{svc_name}."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.grc.domain.enums import GrcEntityType
from modules.grc.models import {cls}
from modules.grc.repository.{entity}_repository import {repo_name}Repository
from modules.grc.service.grc_number_service import GrcNumberService
from modules.grc.service.grc_scope_validator import GrcScopeValidator
from modules.grc.service.engines import {engine_name}Engine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class {svc_name}:
    def __init__(self, db: Session) -> None:
        self._repo = {repo_name}Repository(db)
        self._scope = GrcScopeValidator(db)
        self._numbers = GrcNumberService(db)
        self._engine = {engine_name}Engine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> {cls}:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("{svc_name} not found")
        return row

    def create({create_sig}):
{create_body}
    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("{svc_name} not found")
        return row
{action_methods}
'''


def gen_services() -> None:
    w(
        GRC / "service" / "grc_scope_validator.py",
        '''"""GRC scope validator."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.grc.repository.base import GrcScopedRepository
from modules.foundation.domain.value_objects import TenantContext


class GrcScopeValidator(GrcScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        self.ensure_company_access(ctx, company_id)

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID) -> None:
        self.ensure_branch_access(ctx, branch_id)
''',
    )
    w(
        GRC / "service" / "grc_number_service.py",
        '''"""GRC numbering."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.grc.domain.enums import GrcEntityType
from modules.grc.repository.code_sequence_repository import CodeSequenceRepository


class GrcNumberService:
    def __init__(self, db: Session) -> None:
        self._seq = CodeSequenceRepository(db)

    def generate(self, entity: GrcEntityType, company_id: UUID, model, code_column: str) -> str:
        return self._seq.next_code(entity, company_id, model, code_column)
''',
    )

    simple_specs = [
        ("PolicyVersionService", "GrcPolicyVersion", "PolicyVersion", "policy_version", False, "PolicyVersion", "policy_version_service.py"),
        ("PolicyAcknowledgementService", "GrcPolicyAcknowledgement", "PolicyAcknowledgement", "policy_acknowledgement", False, "PolicyAcknowledgement", "policy_acknowledgement_service.py"),
        ("ControlService", "GrcControl", "Control", "control", False, "Control", "control_service.py"),
        ("RiskCategoryService", "GrcRiskCategory", "RiskCategory", "risk_category", False, "RiskCategory", "risk_category_service.py"),
        ("ComplianceFrameworkService", "GrcComplianceFramework", "ComplianceFramework", "compliance_framework", False, "ComplianceFramework", "compliance_framework_service.py"),
        ("ComplianceRequirementService", "GrcComplianceRequirement", "ComplianceRequirement", "compliance_requirement", False, "ComplianceRequirement", "compliance_requirement_service.py"),
        ("AuditPlanService", "GrcAuditPlan", "AuditPlan", "audit_plan", False, "AuditPlan", "audit_plan_service.py"),
        ("NotificationService", "GrcNotification", "Notification", "notification", False, "Notification", "notification_service.py"),
    ]
    for svc, cls, repo, entity, branch, eng, fname in simple_specs:
        w(GRC / "service" / fname, catalog_service(svc, cls, repo, entity, branch, eng))

    w(
        GRC / "service" / "policy_service.py",
        numbered_service(
            "PolicyService", "GrcPolicy", "Policy", "policy", "POLICY",
            "policy_number", False, "Policy", ["submit", "approve", "publish"],
        ),
    )
    w(
        GRC / "service" / "control_test_service.py",
        numbered_service(
            "ControlTestService", "GrcControlTest", "ControlTest", "control_test",
            "CONTROL_TEST", "test_number", True, "ControlTest", [],
        ),
    )
    w(
        GRC / "service" / "risk_register_service.py",
        numbered_service(
            "RiskRegisterService", "GrcRiskRegister", "RiskRegister", "risk_register",
            "RISK", "risk_number", True, "RiskRegister", ["submit", "approve"],
        ),
    )
    w(
        GRC / "service" / "risk_assessment_service.py",
        numbered_service(
            "RiskAssessmentService", "GrcRiskAssessment", "RiskAssessment", "risk_assessment",
            "RISK_ASSESSMENT", "assessment_number", True, "RiskAssessment", [],
        ),
    )
    w(
        GRC / "service" / "risk_treatment_service.py",
        numbered_service(
            "RiskTreatmentService", "GrcRiskTreatment", "RiskTreatment", "risk_treatment",
            "RISK_TREATMENT", "treatment_number", True, "RiskTreatment", [],
        ),
    )
    w(
        GRC / "service" / "compliance_assessment_service.py",
        numbered_service(
            "ComplianceAssessmentService", "GrcComplianceAssessment", "ComplianceAssessment",
            "compliance_assessment", "COMPLIANCE_ASSESSMENT", "assessment_number", True,
            "ComplianceAssessment", [],
        ),
    )
    w(
        GRC / "service" / "grc_audit_service.py",
        numbered_service(
            "GrcAuditService", "GrcAudit", "Audit", "audit", "AUDIT",
            "audit_number", True, "Audit", ["submit", "approve"],
        ),
    )
    w(
        GRC / "service" / "audit_finding_service.py",
        numbered_service(
            "AuditFindingService", "GrcAuditFinding", "AuditFinding", "audit_finding",
            "FINDING", "finding_number", True, "AuditFinding", [],
        ),
    )
    w(
        GRC / "service" / "corrective_action_service.py",
        numbered_service(
            "CorrectiveActionService", "GrcCorrectiveAction", "CorrectiveAction",
            "corrective_action", "CAPA", "capa_number", True, "CorrectiveAction",
            ["submit", "approve", "complete"],
        ),
    )
    w(
        GRC / "service" / "exception_service.py",
        numbered_service(
            "ExceptionService", "GrcException", "Exception", "exception",
            "EXCEPTION", "exception_number", True, "Exception", ["approve"],
        ),
    )
    w(
        GRC / "service" / "incident_service.py",
        numbered_service(
            "IncidentService", "GrcIncident", "Incident", "incident",
            "INCIDENT", "incident_number", True, "Incident", ["submit", "review", "close"],
        ),
    )
    w(
        GRC / "service" / "grc_report_service.py",
        numbered_service(
            "GrcReportService", "GrcReport", "Report", "report", "REPORT",
            "report_code", False, "Report", ["finalize"],
        ),
    )

    w(
        GRC / "service" / "integration_service.py",
        '''"""GRC integration — cross-module reads / UUID stubs; no peer ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.grc.adapters.document_port import GrcDocumentAdapter
from modules.grc.adapters.helpdesk_port import GrcHelpdeskAdapter
from modules.grc.adapters.master_data_port import GrcMasterDataAdapter
from modules.grc.adapters.organization_port import GrcOrganizationAdapter
from modules.grc.adapters.payroll_port import GrcPayrollAdapter
from modules.foundation.domain.value_objects import TenantContext


class GrcIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = GrcMasterDataAdapter(db)
        self._org = GrcOrganizationAdapter(db)
        self._payroll = GrcPayrollAdapter(db)
        self._document = GrcDocumentAdapter()
        self._helpdesk = GrcHelpdeskAdapter()

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._master.get_employee(ctx, employee_id)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._master.get_customer(ctx, customer_id)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        return self._org.get_department(ctx, department_id)

    def resolve_document(self, document_id: UUID | None) -> UUID | None:
        return self._document.resolve_document_uuid(document_id)

    def resolve_helpdesk_ticket(self, helpdesk_ticket_id: UUID | None) -> UUID | None:
        return self._helpdesk.resolve_ticket_uuid(helpdesk_ticket_id)

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID) -> None:
        return self._payroll.labor_cost_hint(ctx, employee_id)
''',
    )

    w(
        GRC / "service" / "application_service.py",
        '''"""GRC application service facade."""

from sqlalchemy.orm import Session

from modules.grc.service.audit_finding_service import AuditFindingService
from modules.grc.service.audit_plan_service import AuditPlanService
from modules.grc.service.compliance_assessment_service import ComplianceAssessmentService
from modules.grc.service.compliance_framework_service import ComplianceFrameworkService
from modules.grc.service.compliance_requirement_service import ComplianceRequirementService
from modules.grc.service.control_service import ControlService
from modules.grc.service.control_test_service import ControlTestService
from modules.grc.service.corrective_action_service import CorrectiveActionService
from modules.grc.service.exception_service import ExceptionService
from modules.grc.service.grc_audit_service import GrcAuditService
from modules.grc.service.grc_report_service import GrcReportService
from modules.grc.service.incident_service import IncidentService
from modules.grc.service.integration_service import GrcIntegrationService
from modules.grc.service.notification_service import NotificationService
from modules.grc.service.policy_acknowledgement_service import PolicyAcknowledgementService
from modules.grc.service.policy_service import PolicyService
from modules.grc.service.policy_version_service import PolicyVersionService
from modules.grc.service.risk_assessment_service import RiskAssessmentService
from modules.grc.service.risk_category_service import RiskCategoryService
from modules.grc.service.risk_register_service import RiskRegisterService
from modules.grc.service.risk_treatment_service import RiskTreatmentService


class GrcApplicationService:
    def __init__(self, db: Session) -> None:
        self.policies = PolicyService(db)
        self.policy_versions = PolicyVersionService(db)
        self.policy_acknowledgements = PolicyAcknowledgementService(db)
        self.controls = ControlService(db)
        self.control_tests = ControlTestService(db)
        self.risk_categories = RiskCategoryService(db)
        self.risk_registers = RiskRegisterService(db)
        self.risk_assessments = RiskAssessmentService(db)
        self.risk_treatments = RiskTreatmentService(db)
        self.compliance_frameworks = ComplianceFrameworkService(db)
        self.compliance_requirements = ComplianceRequirementService(db)
        self.compliance_assessments = ComplianceAssessmentService(db)
        self.audit_plans = AuditPlanService(db)
        self.audits = GrcAuditService(db)
        self.audit_findings = AuditFindingService(db)
        self.corrective_actions = CorrectiveActionService(db)
        self.exceptions = ExceptionService(db)
        self.incidents = IncidentService(db)
        self.notifications = NotificationService(db)
        self.reports = GrcReportService(db)
        self.integration = GrcIntegrationService(db)
''',
    )

    w(
        GRC / "service" / "__init__.py",
        '''"""GRC services."""

from modules.grc.service.application_service import GrcApplicationService
from modules.grc.service.audit_finding_service import AuditFindingService
from modules.grc.service.audit_plan_service import AuditPlanService
from modules.grc.service.compliance_assessment_service import ComplianceAssessmentService
from modules.grc.service.compliance_framework_service import ComplianceFrameworkService
from modules.grc.service.compliance_requirement_service import ComplianceRequirementService
from modules.grc.service.control_service import ControlService
from modules.grc.service.control_test_service import ControlTestService
from modules.grc.service.corrective_action_service import CorrectiveActionService
from modules.grc.service.exception_service import ExceptionService
from modules.grc.service.grc_audit_service import GrcAuditService
from modules.grc.service.grc_report_service import GrcReportService
from modules.grc.service.incident_service import IncidentService
from modules.grc.service.integration_service import GrcIntegrationService
from modules.grc.service.notification_service import NotificationService
from modules.grc.service.policy_acknowledgement_service import PolicyAcknowledgementService
from modules.grc.service.policy_service import PolicyService
from modules.grc.service.policy_version_service import PolicyVersionService
from modules.grc.service.risk_assessment_service import RiskAssessmentService
from modules.grc.service.risk_category_service import RiskCategoryService
from modules.grc.service.risk_register_service import RiskRegisterService
from modules.grc.service.risk_treatment_service import RiskTreatmentService

__all__ = [
    "AuditFindingService",
    "AuditPlanService",
    "ComplianceAssessmentService",
    "ComplianceFrameworkService",
    "ComplianceRequirementService",
    "ControlService",
    "ControlTestService",
    "CorrectiveActionService",
    "ExceptionService",
    "GrcApplicationService",
    "GrcAuditService",
    "GrcIntegrationService",
    "GrcReportService",
    "IncidentService",
    "NotificationService",
    "PolicyAcknowledgementService",
    "PolicyService",
    "PolicyVersionService",
    "RiskAssessmentService",
    "RiskCategoryService",
    "RiskRegisterService",
    "RiskTreatmentService",
]
''',
    )

def gen_adapters() -> None:
    w(
        GRC / "adapters" / "master_data_port.py",
        '''"""Master Data port — employee / customer only (C-01)."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.customer_service import CustomerService
from modules.master_data.service.employee_service import EmployeeService


class GrcMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._customers = CustomerService(db)
        self._employees = EmployeeService(db)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._customers.get_customer(ctx, customer_id)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._employees.get_employee(ctx, employee_id)
''',
    )
    w(
        GRC / "adapters" / "organization_port.py",
        '''"""Organization port — read org_department only."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.hierarchy_repository import DepartmentRepository


class GrcOrganizationAdapter:
    def __init__(self, db: Session) -> None:
        self._departments = DepartmentRepository(db)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        department = self._departments.get_by_id(ctx, department_id)
        if department is None:
            raise NotFoundException("Department not found")
        return department
''',
    )
    w(
        GRC / "adapters" / "finance_port.py",
        '''"""Finance port — PostingService.post_system_journal only; store finance_journal_id."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.finance.domain.enums import JournalType
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.domain.value_objects import TenantContext
from modules.grc.models import GrcCorrectiveAction, GrcIncident


class GrcFinanceAdapter:
    def __init__(self, db: Session) -> None:
        self._journals = JournalService(db)
        self._posting = PostingService(db)

    def post_incident_cost(
        self,
        ctx: TenantContext,
        row: GrcIncident,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        return self._post_cost(
            ctx,
            company_id=row.company_id,
            branch_id=row.branch_id,
            document_label=f"Incident {row.incident_number}",
            amount=amount,
            debit_account_id=debit_account_id,
            credit_account_id=credit_account_id,
            fiscal_year_id=fiscal_year_id,
        )

    def post_capa_cost(
        self,
        ctx: TenantContext,
        row: GrcCorrectiveAction,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        return self._post_cost(
            ctx,
            company_id=row.company_id,
            branch_id=row.branch_id,
            document_label=f"CAPA {row.capa_number}",
            amount=amount,
            debit_account_id=debit_account_id,
            credit_account_id=credit_account_id,
            fiscal_year_id=fiscal_year_id,
        )

    def _post_cost(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID | None,
        document_label: str,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None,
    ) -> UUID:
        amount = amount.quantize(Decimal("0.0001"))
        resolved_branch_id = branch_id if branch_id is not None else ctx.branch_id
        if resolved_branch_id is None:
            msg = "branch_id is required for GRC finance posting"
            raise ValueError(msg)
        journal = self._journals.create_journal(
            ctx,
            company_id=company_id,
            branch_id=resolved_branch_id,
            journal_date=date.today(),
            description=f"GRC charge {document_label}",
            journal_type=JournalType.SYSTEM.value,
            fiscal_year_id=fiscal_year_id,
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=1,
            account_id=debit_account_id,
            debit_amount=float(amount),
            credit_amount=0,
            description="GRC charge debit",
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=2,
            account_id=credit_account_id,
            debit_amount=0,
            credit_amount=float(amount),
            description="GRC charge credit",
        )
        self._posting.post_system_journal(ctx, journal.id)
        return journal.id
''',
    )
    w(
        GRC / "adapters" / "document_port.py",
        '''"""Document port — UUID-only stubs; no doc_* FK / ORM writes."""

from uuid import UUID


class GrcDocumentAdapter:
    def resolve_document_uuid(self, document_id: UUID | None) -> UUID | None:
        return document_id
''',
    )
    w(
        GRC / "adapters" / "helpdesk_port.py",
        '''"""Helpdesk port — UUID-only stubs; no hd_* FK / ORM writes."""

from uuid import UUID


class GrcHelpdeskAdapter:
    def resolve_ticket_uuid(self, helpdesk_ticket_id: UUID | None) -> UUID | None:
        return helpdesk_ticket_id
''',
    )
    w(
        GRC / "adapters" / "payroll_port.py",
        '''"""Payroll port — read-only labor hint stub; no pay_* writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class GrcPayrollAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID) -> None:
        _ = (ctx, employee_id, self._db)
        return None
''',
    )


def gen_permissions() -> None:
    w(
        GRC / "permissions.py",
        '''"""GRC permission constants per ERD_19 section 14."""

GRC_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("grc.policy:read", "grc.policy", "read", "grc"),
    ("grc.policy:create", "grc.policy", "create", "grc"),
    ("grc.policy:update", "grc.policy", "update", "grc"),
    ("grc.policy:submit", "grc.policy", "submit", "grc"),
    ("grc.policy:approve", "grc.policy", "approve", "grc"),
    ("grc.policy:publish", "grc.policy", "publish", "grc"),
    ("grc.policy_version:read", "grc.policy_version", "read", "grc"),
    ("grc.policy_version:create", "grc.policy_version", "create", "grc"),
    ("grc.policy_version:update", "grc.policy_version", "update", "grc"),
    ("grc.acknowledgement:read", "grc.acknowledgement", "read", "grc"),
    ("grc.acknowledgement:create", "grc.acknowledgement", "create", "grc"),
    ("grc.acknowledgement:update", "grc.acknowledgement", "update", "grc"),
    ("grc.control:read", "grc.control", "read", "grc"),
    ("grc.control:create", "grc.control", "create", "grc"),
    ("grc.control:update", "grc.control", "update", "grc"),
    ("grc.control_test:read", "grc.control_test", "read", "grc"),
    ("grc.control_test:create", "grc.control_test", "create", "grc"),
    ("grc.control_test:update", "grc.control_test", "update", "grc"),
    ("grc.risk_category:read", "grc.risk_category", "read", "grc"),
    ("grc.risk_category:create", "grc.risk_category", "create", "grc"),
    ("grc.risk_category:update", "grc.risk_category", "update", "grc"),
    ("grc.risk:read", "grc.risk", "read", "grc"),
    ("grc.risk:create", "grc.risk", "create", "grc"),
    ("grc.risk:update", "grc.risk", "update", "grc"),
    ("grc.risk:submit", "grc.risk", "submit", "grc"),
    ("grc.risk:approve", "grc.risk", "approve", "grc"),
    ("grc.risk_assessment:read", "grc.risk_assessment", "read", "grc"),
    ("grc.risk_assessment:create", "grc.risk_assessment", "create", "grc"),
    ("grc.risk_assessment:update", "grc.risk_assessment", "update", "grc"),
    ("grc.risk_treatment:read", "grc.risk_treatment", "read", "grc"),
    ("grc.risk_treatment:create", "grc.risk_treatment", "create", "grc"),
    ("grc.risk_treatment:update", "grc.risk_treatment", "update", "grc"),
    ("grc.compliance_framework:read", "grc.compliance_framework", "read", "grc"),
    ("grc.compliance_framework:create", "grc.compliance_framework", "create", "grc"),
    ("grc.compliance_framework:update", "grc.compliance_framework", "update", "grc"),
    ("grc.compliance_requirement:read", "grc.compliance_requirement", "read", "grc"),
    ("grc.compliance_requirement:create", "grc.compliance_requirement", "create", "grc"),
    ("grc.compliance_requirement:update", "grc.compliance_requirement", "update", "grc"),
    ("grc.compliance_assessment:read", "grc.compliance_assessment", "read", "grc"),
    ("grc.compliance_assessment:create", "grc.compliance_assessment", "create", "grc"),
    ("grc.compliance_assessment:update", "grc.compliance_assessment", "update", "grc"),
    ("grc.audit_plan:read", "grc.audit_plan", "read", "grc"),
    ("grc.audit_plan:create", "grc.audit_plan", "create", "grc"),
    ("grc.audit_plan:update", "grc.audit_plan", "update", "grc"),
    ("grc.audit:read", "grc.audit", "read", "grc"),
    ("grc.audit:create", "grc.audit", "create", "grc"),
    ("grc.audit:update", "grc.audit", "update", "grc"),
    ("grc.audit:submit", "grc.audit", "submit", "grc"),
    ("grc.audit:approve", "grc.audit", "approve", "grc"),
    ("grc.finding:read", "grc.finding", "read", "grc"),
    ("grc.finding:create", "grc.finding", "create", "grc"),
    ("grc.finding:update", "grc.finding", "update", "grc"),
    ("grc.corrective_action:read", "grc.corrective_action", "read", "grc"),
    ("grc.corrective_action:create", "grc.corrective_action", "create", "grc"),
    ("grc.corrective_action:update", "grc.corrective_action", "update", "grc"),
    ("grc.corrective_action:submit", "grc.corrective_action", "submit", "grc"),
    ("grc.corrective_action:approve", "grc.corrective_action", "approve", "grc"),
    ("grc.corrective_action:complete", "grc.corrective_action", "complete", "grc"),
    ("grc.exception:read", "grc.exception", "read", "grc"),
    ("grc.exception:create", "grc.exception", "create", "grc"),
    ("grc.exception:update", "grc.exception", "update", "grc"),
    ("grc.exception:approve", "grc.exception", "approve", "grc"),
    ("grc.incident:read", "grc.incident", "read", "grc"),
    ("grc.incident:create", "grc.incident", "create", "grc"),
    ("grc.incident:update", "grc.incident", "update", "grc"),
    ("grc.incident:submit", "grc.incident", "submit", "grc"),
    ("grc.incident:review", "grc.incident", "review", "grc"),
    ("grc.incident:close", "grc.incident", "close", "grc"),
    ("grc.notification:read", "grc.notification", "read", "grc"),
    ("grc.report:read", "grc.report", "read", "grc"),
    ("grc.report:export", "grc.report", "export", "grc"),
]

_ALL = [p[0] for p in GRC_PERMISSIONS]

GRC_MANAGER_PERMISSIONS = list(_ALL)
RISK_MANAGER_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "grc.risk",
            "grc.risk_category",
            "grc.risk_assessment",
            "grc.risk_treatment",
            "grc.incident",
            "grc.control",
            "grc.notification:read",
            "grc.report:read",
        )
    )
]
COMPLIANCE_OFFICER_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "grc.policy",
            "grc.acknowledgement",
            "grc.compliance",
            "grc.corrective_action",
            "grc.control",
            "grc.notification:read",
            "grc.report:read",
        )
    )
]
GRC_ADMIN_PERMISSIONS = list(_ALL)
''',
    )


def gen_api() -> None:
    w(
        GRC / "dependencies.py",
        '''"""GRC module dependencies."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Query

from database.session import get_db
from modules.foundation.dependencies import get_tenant_context, require_permission
from modules.foundation.domain.value_objects import TenantContext

__all__ = [
    "PaginationParams",
    "get_pagination",
    "get_tenant_context",
    "require_permission",
    "TenantContext",
    "get_db",
    "paginate",
    "extract_update_fields",
]


@dataclass(frozen=True)
class PaginationParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def get_pagination(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 25,
) -> PaginationParams:
    return PaginationParams(page=page, page_size=page_size)


def paginate(items: list, pagination: PaginationParams) -> list:
    return items[pagination.offset : pagination.offset + pagination.page_size]


def extract_update_fields(body) -> dict:
    fields = body.model_dump(exclude_unset=True)
    fields.pop("version", None)
    return fields
''',
    )

    schema_lines = [
        '"""GRC Pydantic schemas."""',
        "",
        "from uuid import UUID",
        "",
        "from pydantic import BaseModel, ConfigDict",
        "",
        "",
        "class OrmModel(BaseModel):",
        "    model_config = ConfigDict(from_attributes=True)",
        "",
    ]
    for _, name, _, _, branch in ROUTE_SPECS:
        schema_lines += [
            "",
            f"class {name}Create(BaseModel):",
            "    company_id: UUID | None = None",
        ]
        if branch:
            schema_lines.append("    branch_id: UUID")
        schema_lines += [
            "    status: str | None = None",
            "",
            f"class {name}Update(BaseModel):",
            "    status: str | None = None",
            "    version: int | None = None",
            "",
            f"class {name}Response(OrmModel):",
            "    id: UUID",
            "    company_id: UUID",
            "    status: str",
            "    version: int",
        ]
    w(GRC / "schemas.py", "\n".join(schema_lines) + "\n")

    router_parts: list[str] = [
        '"""GRC API route handlers."""',
        "",
        "from typing import Annotated",
        "from uuid import UUID",
        "",
        "from fastapi import APIRouter, Depends",
        "from sqlalchemy.orm import Session",
        "",
        "from modules.grc.dependencies import (",
        "    PaginationParams,",
        "    extract_update_fields,",
        "    get_db,",
        "    get_pagination,",
        "    paginate,",
        "    require_permission,",
        ")",
        "from modules.grc.schemas import (",
    ]
    for _, name, _, _, _ in ROUTE_SPECS:
        router_parts.append(f"    {name}Create,")
        router_parts.append(f"    {name}Response,")
        router_parts.append(f"    {name}Update,")
    router_parts += [
        ")",
        "from modules.grc.service import (",
    ]
    seen_svc: set[str] = set()
    for _, _, svc, _, _ in ROUTE_SPECS:
        if svc not in seen_svc:
            router_parts.append(f"    {svc},")
            seen_svc.add(svc)
    router_parts.append(")")
    router_parts.append("from modules.foundation.domain.value_objects import TenantContext")
    router_parts.append("from shared.schemas import APIResponse")
    router_parts.append("")

    exports: list[str] = []
    for prefix, name, svc, perm, branch in ROUTE_SPECS:
        rname = f"{prefix.replace('-', '_')}_router"
        exports.append(rname)
        router_parts.append(f'{rname} = APIRouter(prefix="/{prefix}", tags=["GRC — {name}"])')
        router_parts.append("")
        if branch:
            create_call = (
                f"{svc}(db).create(ctx, branch_id=body.branch_id, "
                f"**body.model_dump(exclude={{'branch_id'}}, exclude_none=True))"
            )
        else:
            create_call = f"{svc}(db).create(ctx, **body.model_dump(exclude_none=True))"

        update_perm = f"{perm}:update"
        create_perm = f"{perm}:create"
        if perm == "grc.report":
            update_perm = "grc.report:export"
            create_perm = "grc.report:export"
        elif perm == "grc.notification":
            update_perm = "grc.notification:read"
            create_perm = "grc.notification:read"

        fn = prefix.replace("-", "_")
        router_parts += [
            f'@{rname}.get("", response_model=APIResponse[list[{name}Response]])',
            f"def list_{fn}(",
            f'    ctx: Annotated[TenantContext, Depends(require_permission("{perm}:read"))],',
            "    db: Annotated[Session, Depends(get_db)],",
            "    pagination: Annotated[PaginationParams, Depends(get_pagination)],",
            "    company_id: UUID | None = None,",
            "):",
            f"    items = {svc}(db).list(ctx, company_id=company_id)",
            '    return APIResponse(message="OK", data=paginate(items, pagination))',
            "",
            f'@{rname}.get("/{{row_id}}", response_model=APIResponse[{name}Response])',
            f"def get_{fn}(",
            "    row_id: UUID,",
            f'    ctx: Annotated[TenantContext, Depends(require_permission("{perm}:read"))],',
            "    db: Annotated[Session, Depends(get_db)],",
            "):",
            f'    return APIResponse(message="OK", data={svc}(db).get(ctx, row_id))',
            "",
            f'@{rname}.post("", response_model=APIResponse[{name}Response])',
            f"def create_{fn}(",
            f"    body: {name}Create,",
            f'    ctx: Annotated[TenantContext, Depends(require_permission("{create_perm}"))],',
            "    db: Annotated[Session, Depends(get_db)],",
            "):",
            f'    return APIResponse(message="Created", data={create_call})',
            "",
            f'@{rname}.patch("/{{row_id}}", response_model=APIResponse[{name}Response])',
            f"def update_{fn}(",
            "    row_id: UUID,",
            f"    body: {name}Update,",
            f'    ctx: Annotated[TenantContext, Depends(require_permission("{update_perm}"))],',
            "    db: Annotated[Session, Depends(get_db)],",
            "):",
            f'    return APIResponse(message="Updated", data={svc}(db).update(ctx, row_id, **extract_update_fields(body)))',
            "",
        ]

        actions: list[tuple[str, str]] = []
        if prefix == "policies":
            actions = [
                ("submit", "grc.policy:submit"),
                ("approve", "grc.policy:approve"),
                ("publish", "grc.policy:publish"),
            ]
        elif prefix == "risk-registers":
            actions = [
                ("submit", "grc.risk:submit"),
                ("approve", "grc.risk:approve"),
            ]
        elif prefix == "audits":
            actions = [
                ("submit", "grc.audit:submit"),
                ("approve", "grc.audit:approve"),
            ]
        elif prefix == "corrective-actions":
            actions = [
                ("submit", "grc.corrective_action:submit"),
                ("approve", "grc.corrective_action:approve"),
                ("complete", "grc.corrective_action:complete"),
            ]
        elif prefix == "exceptions":
            actions = [
                ("approve", "grc.exception:approve"),
            ]
        elif prefix == "incidents":
            actions = [
                ("submit", "grc.incident:submit"),
                ("review", "grc.incident:review"),
                ("close", "grc.incident:close"),
            ]

        for act, pcode in actions:
            router_parts += [
                f'@{rname}.post("/{{row_id}}/{act}", response_model=APIResponse[{name}Response])',
                f"def {act}_{fn}(",
                "    row_id: UUID,",
                f'    ctx: Annotated[TenantContext, Depends(require_permission("{pcode}"))],',
                "    db: Annotated[Session, Depends(get_db)],",
                "):",
                f'    return APIResponse(message="{act}", data={svc}(db).{act}(ctx, row_id))',
                "",
            ]

    w(GRC / "routers" / "__init__.py", "\n".join(router_parts) + "\n")

    import_list = ",\n    ".join(exports)
    w(
        GRC / "router.py",
        f'''"""GRC module router aggregation."""

from fastapi import APIRouter

from modules.grc.routers import (
    {import_list},
)

grc_router = APIRouter(prefix="/grc")
'''
        + "\n".join(f"grc_router.include_router({e})" for e in exports)
        + "\n",
    )

def gen_tasks_tests() -> None:
    w(
        GRC / "tasks.py",
        '''"""GRC Celery task stubs per ERD_19 section 15."""

from workers.celery_app import celery_app


@celery_app.task(name="grc.policy_review_reminders")
def policy_review_reminders() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.grc.models import GrcPolicy

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(GrcPolicy).where(
                    GrcPolicy.is_deleted.is_(False),
                    GrcPolicy.review_due_at.is_not(None),
                    GrcPolicy.status.in_(["published", "approved"]),
                )
            ).all()
        )
        return {"status": "ok", "policies_due": len(rows)}
    finally:
        db.close()


@celery_app.task(name="grc.risk_review_scheduler")
def risk_review_scheduler() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.grc.models import GrcRiskRegister

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(GrcRiskRegister).where(
                    GrcRiskRegister.is_deleted.is_(False),
                    GrcRiskRegister.next_review_at.is_not(None),
                    GrcRiskRegister.status.in_(["open", "approved", "mitigated"]),
                )
            ).all()
        )
        return {"status": "ok", "risks_due": len(rows)}
    finally:
        db.close()


@celery_app.task(name="grc.audit_due_notifications")
def audit_due_notifications() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.grc.models import GrcAudit

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(GrcAudit).where(
                    GrcAudit.is_deleted.is_(False),
                    GrcAudit.status.in_(["planned", "approved", "in_progress"]),
                )
            ).all()
        )
        return {"status": "ok", "audits_due": len(rows)}
    finally:
        db.close()


@celery_app.task(name="grc.corrective_action_followups")
def corrective_action_followups() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.grc.models import GrcCorrectiveAction

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(GrcCorrectiveAction).where(
                    GrcCorrectiveAction.is_deleted.is_(False),
                    GrcCorrectiveAction.due_date.is_not(None),
                    GrcCorrectiveAction.status.in_(["open", "in_progress", "approved"]),
                )
            ).all()
        )
        return {"status": "ok", "capas_due": len(rows)}
    finally:
        db.close()


@celery_app.task(name="grc.compliance_refresh")
def compliance_refresh() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.grc.models import GrcComplianceAssessment

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(GrcComplianceAssessment).where(
                    GrcComplianceAssessment.is_deleted.is_(False),
                    GrcComplianceAssessment.next_due_at.is_not(None),
                    GrcComplianceAssessment.status.in_(["draft", "completed", "overdue"]),
                )
            ).all()
        )
        return {"status": "ok", "assessments_due": len(rows)}
    finally:
        db.close()


@celery_app.task(name="grc.retry_finance_posting")
def retry_finance_posting() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.grc.models import GrcCorrectiveAction, GrcIncident

    db = SessionLocal()
    try:
        incidents = list(
            db.scalars(
                select(GrcIncident).where(
                    GrcIncident.is_deleted.is_(False),
                    GrcIncident.status.in_(["resolved", "closed"]),
                    GrcIncident.finance_journal_id.is_(None),
                )
            ).all()
        )
        capas = list(
            db.scalars(
                select(GrcCorrectiveAction).where(
                    GrcCorrectiveAction.is_deleted.is_(False),
                    GrcCorrectiveAction.status.in_(["completed", "verified"]),
                    GrcCorrectiveAction.finance_journal_id.is_(None),
                )
            ).all()
        )
        return {
            "status": "ok",
            "unposted_incidents": len(incidents),
            "unposted_capas": len(capas),
        }
    finally:
        db.close()
''',
    )

    w(
        TESTS / "unit" / "grc" / "test_grc_engines.py",
        '''"""Unit tests for GRC engines."""

from types import SimpleNamespace

from modules.grc.service.engines import (
    AuditEngine,
    CorrectiveActionEngine,
    ExceptionEngine,
    IncidentEngine,
    PolicyEngine,
    RiskRegisterEngine,
)


def test_policy_lifecycle():
    engine = PolicyEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"
    engine.publish(row)
    assert row.status == "published"


def test_risk_register_lifecycle():
    engine = RiskRegisterEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    assert row.status == "approved"


def test_audit_lifecycle():
    engine = AuditEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    assert row.status == "approved"


def test_corrective_action_complete():
    engine = CorrectiveActionEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    engine.complete(row)
    assert row.status == "completed"


def test_exception_approve():
    engine = ExceptionEngine()
    row = SimpleNamespace(status="draft")
    engine.approve(row)
    assert row.status == "approved"


def test_incident_review_close():
    engine = IncidentEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.review(row)
    engine.close(row)
    assert row.status == "closed"
''',
    )

    w(
        TESTS / "unit" / "grc" / "test_grc_tasks.py",
        '''"""Unit tests for GRC Celery tasks."""

from modules.grc import tasks as grc_tasks


def test_grc_task_names_registered():
    assert grc_tasks.policy_review_reminders.name == "grc.policy_review_reminders"
    assert grc_tasks.risk_review_scheduler.name == "grc.risk_review_scheduler"
    assert grc_tasks.audit_due_notifications.name == "grc.audit_due_notifications"
    assert grc_tasks.corrective_action_followups.name == "grc.corrective_action_followups"
    assert grc_tasks.compliance_refresh.name == "grc.compliance_refresh"
    assert grc_tasks.retry_finance_posting.name == "grc.retry_finance_posting"
''',
    )

    w(
        TESTS / "security" / "grc" / "test_grc_permissions.py",
        '''"""GRC RBAC permission tests."""

from modules.grc.permissions import (
    COMPLIANCE_OFFICER_PERMISSIONS,
    GRC_ADMIN_PERMISSIONS,
    GRC_MANAGER_PERMISSIONS,
    GRC_PERMISSIONS,
    RISK_MANAGER_PERMISSIONS,
)


def test_grc_permissions_defined():
    assert len(GRC_PERMISSIONS) >= 40
    assert "grc.policy:approve" in [p[0] for p in GRC_PERMISSIONS]
    assert "grc.policy:publish" in [p[0] for p in GRC_PERMISSIONS]
    assert "grc.incident:close" in [p[0] for p in GRC_PERMISSIONS]


def test_grc_roles():
    assert GRC_MANAGER_PERMISSIONS
    assert RISK_MANAGER_PERMISSIONS
    assert COMPLIANCE_OFFICER_PERMISSIONS
    assert GRC_ADMIN_PERMISSIONS
    assert "grc.policy:approve" in GRC_MANAGER_PERMISSIONS
    assert "grc.risk:approve" in RISK_MANAGER_PERMISSIONS
    assert "grc.compliance_framework:create" in COMPLIANCE_OFFICER_PERMISSIONS
''',
    )

    w(
        TESTS / "integration" / "grc" / "test_grc_module_import.py",
        '''"""Integration smoke: GRC module imports and router mount."""

from modules.grc.models import GrcAudit, GrcPolicy, GrcRiskRegister
from modules.grc.router import grc_router
from modules.grc.service import (
    GrcApplicationService,
    GrcAuditService,
    GrcIntegrationService,
    GrcReportService,
    PolicyService,
    RiskRegisterService,
)
from modules.grc.service.engines import AuditEngine, PolicyEngine, RiskRegisterEngine


def test_grc_models_importable():
    assert GrcPolicy.__tablename__ == "grc_policy"
    assert GrcRiskRegister.__tablename__ == "grc_risk_register"
    assert GrcAudit.__tablename__ == "grc_audit"


def test_grc_router_mounted():
    assert grc_router.prefix == "/grc"
    paths = [getattr(r, "path", "") for r in grc_router.routes]
    assert any("/{row_id}" in p for p in paths)
    assert any("policies" in p for p in paths)
    assert any("risk-registers" in p for p in paths)


def test_grc_services_and_engines_importable():
    assert GrcApplicationService is not None
    assert PolicyService is not None
    assert RiskRegisterService is not None
    assert GrcAuditService is not None
    assert GrcReportService is not None
    assert GrcIntegrationService is not None
    assert PolicyEngine is not None
    assert RiskRegisterEngine is not None
    assert AuditEngine is not None
''',
    )


def gen_seeds() -> None:
    w(
        ALEMBIC / "0353_seed_grc_permissions.py",
        '''"""Seed GRC permissions and roles."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.grc.permissions import (
    COMPLIANCE_OFFICER_PERMISSIONS,
    GRC_ADMIN_PERMISSIONS,
    GRC_MANAGER_PERMISSIONS,
    GRC_PERMISSIONS,
    RISK_MANAGER_PERMISSIONS,
)

revision: str = "0353_seed_grc_permissions"
down_revision: str | None = "0352_grc_report"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERMISSION_TABLE = sa.table(
    "sec_permission",
    sa.column("id", sa.Uuid),
    sa.column("permission_code", sa.String),
    sa.column("resource", sa.String),
    sa.column("action", sa.String),
    sa.column("module", sa.String),
    sa.column("is_active", sa.Boolean),
    sa.column("created_at", sa.DateTime(timezone=True)),
    schema="foundation",
)

ROLE_SPECS: list[tuple[str, str, list[str]]] = [
    ("GRC_MANAGER", "GRC Manager", GRC_MANAGER_PERMISSIONS),
    ("RISK_MANAGER", "Risk Manager", RISK_MANAGER_PERMISSIONS),
    ("COMPLIANCE_OFFICER", "Compliance Officer", COMPLIANCE_OFFICER_PERMISSIONS),
    ("GRC_ADMIN", "GRC Admin", GRC_ADMIN_PERMISSIONS),
]


def _ensure_permission(conn, now, code, resource, action, module):
    exists = conn.execute(
        sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
        {"code": code},
    ).first()
    if exists:
        return str(exists[0])
    perm_id = str(uuid4())
    conn.execute(
        sa.insert(PERMISSION_TABLE).values(
            id=perm_id,
            permission_code=code,
            resource=resource,
            action=action,
            module=module,
            is_active=True,
            created_at=now,
        )
    )
    return perm_id


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    perm_ids: dict[str, str] = {}
    for code, resource, action, module in GRC_PERMISSIONS:
        perm_ids[code] = _ensure_permission(conn, now, code, resource, action, module)

    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code, role_name, role_perms in ROLE_SPECS:
            role_row = conn.execute(
                sa.text(
                    """
                    SELECT id FROM foundation.sec_role
                    WHERE tenant_id = :tid AND role_code = :code
                    """
                ),
                {"tid": tid, "code": role_code},
            ).first()
            if role_row:
                role_id = str(role_row[0])
            else:
                role_id = str(uuid4())
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.sec_role
                        (id, tenant_id, role_code, role_name, status, created_at, updated_at)
                        VALUES (:id, :tid, :code, :name, 'active', :now, :now)
                        """
                    ),
                    {"id": role_id, "tid": tid, "code": role_code, "name": role_name, "now": now},
                )
            for pcode in role_perms:
                pid = perm_ids.get(pcode)
                if not pid:
                    continue
                exists = conn.execute(
                    sa.text(
                        """
                        SELECT 1 FROM foundation.sec_role_permission
                        WHERE role_id = :rid AND permission_id = :pid
                        """
                    ),
                    {"rid": role_id, "pid": pid},
                ).first()
                if exists:
                    continue
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.sec_role_permission
                        (id, tenant_id, role_id, permission_id, status, granted_at, created_at, updated_at)
                        VALUES (:id, :tid, :rid, :pid, 'active', :now, :now, :now)
                        """
                    ),
                    {"id": str(uuid4()), "tid": tid, "rid": role_id, "pid": pid, "now": now},
                )


def downgrade() -> None:
    conn = op.get_bind()
    for role_code, _, _ in ROLE_SPECS:
        conn.execute(
            sa.text(
                """
                DELETE FROM foundation.sec_role_permission
                WHERE role_id IN (
                    SELECT id FROM foundation.sec_role WHERE role_code = :code
                )
                """
            ),
            {"code": role_code},
        )
        conn.execute(
            sa.text("DELETE FROM foundation.sec_role WHERE role_code = :code"),
            {"code": role_code},
        )
    for code, _, _, _ in GRC_PERMISSIONS:
        conn.execute(
            sa.text("DELETE FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        )
''',
    )

    w(
        ALEMBIC / "0354_seed_grc_workflows.py",
        '''"""Seed GRC workflow definitions per ERD_19."""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0354_seed_grc_workflows"
down_revision: str | None = "0353_seed_grc_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

WORKFLOWS: list[tuple[str, str, str, list[tuple[int, str, str, str]]]] = [
    (
        "GRC_POLICY_APPROVAL",
        "GRC Policy Approval",
        "grc_policy",
        [
            (1, "COMPLIANCE_OFFICER", "Author Submit", "role"),
            (2, "COMPLIANCE_OFFICER", "Compliance Officer Approval", "role"),
            (3, "GRC_MANAGER", "GRC Manager Approval", "role"),
        ],
    ),
    (
        "GRC_RISK_APPROVAL",
        "GRC Risk Approval",
        "grc_risk_register",
        [
            (1, "RISK_MANAGER", "Risk Owner Submit", "role"),
            (2, "RISK_MANAGER", "Risk Manager Approval", "role"),
            (3, "GRC_MANAGER", "GRC Manager Approval", "role"),
        ],
    ),
    (
        "GRC_AUDIT_APPROVAL",
        "GRC Audit Approval",
        "grc_audit",
        [
            (1, "GRC_MANAGER", "Lead Auditor Submit", "role"),
            (2, "GRC_MANAGER", "GRC Manager Approval", "role"),
            (3, "GRC_ADMIN", "GRC Admin Approval", "role"),
        ],
    ),
    (
        "GRC_CORRECTIVE_APPROVAL",
        "GRC Corrective Action Approval",
        "grc_corrective_action",
        [
            (1, "COMPLIANCE_OFFICER", "CAPA Owner Submit", "role"),
            (2, "COMPLIANCE_OFFICER", "Compliance Officer Approval", "role"),
            (3, "GRC_MANAGER", "GRC Manager Approval", "role"),
        ],
    ),
    (
        "GRC_INCIDENT_REVIEW",
        "GRC Incident Review",
        "grc_incident",
        [
            (1, "RISK_MANAGER", "Reporter Submit", "role"),
            (2, "RISK_MANAGER", "Risk Manager Review", "role"),
            (3, "GRC_MANAGER", "GRC Manager Review", "role"),
        ],
    ),
]


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for workflow_code, workflow_name, document_type, steps in WORKFLOWS:
            exists = conn.execute(
                sa.text(
                    """
                    SELECT id FROM foundation.wf_definition
                    WHERE tenant_id = :tid AND workflow_code = :code AND version_no = 1
                    """
                ),
                {"tid": tid, "code": workflow_code},
            ).first()
            if exists:
                wf_id = str(exists[0])
            else:
                wf_id = str(uuid4())
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.wf_definition
                        (id, tenant_id, workflow_code, workflow_name, module,
                         document_type, version_no, is_active, created_at, updated_at)
                        VALUES (:id, :tid, :code, :name, 'grc', :doc, 1, true, :now, :now)
                        """
                    ),
                    {
                        "id": wf_id,
                        "tid": tid,
                        "code": workflow_code,
                        "name": workflow_name,
                        "doc": document_type,
                        "now": now,
                    },
                )
            for step_order, step_code, step_name, approver_type in steps:
                step_exists = conn.execute(
                    sa.text(
                        """
                        SELECT 1 FROM foundation.wf_step
                        WHERE workflow_id = :wid AND step_order = :ord
                        """
                    ),
                    {"wid": wf_id, "ord": step_order},
                ).first()
                if step_exists:
                    continue
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.wf_step
                        (id, tenant_id, workflow_id, step_order, step_code, step_name,
                         approver_type, is_parallel, created_at, updated_at)
                        VALUES (:id, :tid, :wid, :ord, :code, :name, :atype, false, :now, :now)
                        """
                    ),
                    {
                        "id": str(uuid4()),
                        "tid": tid,
                        "wid": wf_id,
                        "ord": step_order,
                        "code": step_code,
                        "name": step_name,
                        "atype": approver_type,
                        "now": now,
                    },
                )


def downgrade() -> None:
    conn = op.get_bind()
    for workflow_code, _, _, _ in WORKFLOWS:
        conn.execute(
            sa.text(
                """
                DELETE FROM foundation.wf_step
                WHERE workflow_id IN (
                    SELECT id FROM foundation.wf_definition WHERE workflow_code = :code
                )
                """
            ),
            {"code": workflow_code},
        )
        conn.execute(
            sa.text("DELETE FROM foundation.wf_definition WHERE workflow_code = :code"),
            {"code": workflow_code},
        )
''',
    )


def gen_wiring() -> None:
    patch_file(
        SHARED / "router.py",
        "from modules.document.router import document_router\n",
        "from modules.document.router import document_router\n"
        "from modules.grc.router import grc_router\n",
    )
    patch_file(
        SHARED / "router.py",
        "api_v1_router.include_router(document_router)\n",
        "api_v1_router.include_router(document_router)\n"
        "api_v1_router.include_router(grc_router)\n",
    )
    patch_file(
        ROOT / "alembic" / "env.py",
        "import modules.document.models  # noqa: F401 — register ORM metadata\n",
        "import modules.document.models  # noqa: F401 — register ORM metadata\n"
        "import modules.grc.models  # noqa: F401 — register ORM metadata\n",
    )
    patch_file(
        ROOT / "src" / "workers" / "celery_app.py",
        '        "modules.document",\n',
        '        "modules.document",\n        "modules.grc",\n',
    )
    patch_file(
        ROOT / "pyproject.toml",
        '    "modules.document.*",\n',
        '    "modules.document.*",\n    "modules.grc.*",\n',
    )
    # ruff per-file ignores — append after document block if present, else after document.* mypy
    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    ruff_marker = (
        '"src/modules/document/**" = ["E501", "SIM102"]\n'
        '"src/modules/document/domain/enums.py" = ["UP042"]\n'
    )
    ruff_new = (
        ruff_marker
        + '"src/modules/grc/**" = ["E501", "SIM102"]\n'
        + '"src/modules/grc/domain/enums.py" = ["UP042"]\n'
    )
    if ruff_marker in pyproject and '"src/modules/grc/**"' not in pyproject:
        patch_file(ROOT / "pyproject.toml", ruff_marker, ruff_new)
    elif '"src/modules/grc/**"' not in pyproject:
        # fallback: add after document mypy entry already patched above
        print("note: ruff grc ignores — seeking alternate marker")
        alt = '"src/modules/document/domain/enums.py" = ["UP042"]\n'
        if alt in pyproject:
            patch_file(
                ROOT / "pyproject.toml",
                alt,
                alt
                + '"src/modules/grc/**" = ["E501", "SIM102"]\n'
                + '"src/modules/grc/domain/enums.py" = ["UP042"]\n',
            )


def main() -> None:
    gen_scaffold()
    gen_domain()
    gen_models()
    gen_migrations()
    gen_repos()
    gen_engines()
    gen_services()
    gen_adapters()
    gen_permissions()
    gen_api()
    gen_tasks_tests()
    gen_seeds()
    gen_wiring()
    print(f"OK grc module generated — {len(FILES_WRITTEN)} files")
    print("Alembic head revision: 0354_seed_grc_workflows")


if __name__ == "__main__":
    main()
