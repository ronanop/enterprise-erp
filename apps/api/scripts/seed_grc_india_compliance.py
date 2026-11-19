"""Seed India compliance framework catalog for GRC (idempotent).

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.seed_grc_india_compliance
"""

from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import SecTenant  # noqa: E402
from modules.grc.models.compliance_framework import GrcComplianceFramework  # noqa: E402
from modules.grc.models.compliance_requirement import GrcComplianceRequirement  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402

FRAMEWORKS: list[dict] = [
    {
        "framework_code": "IN-DPDP",
        "framework_name": "India — Digital Personal Data Protection Act",
        "framework_type": "regulatory",
        "jurisdiction": "India",
        "description": "Personal data protection, consent, safeguards, and breach readiness.",
        "requirements": [
            {
                "requirement_code": "IN-DPDP-AUDIT-TRAIL",
                "requirement_name": "Audit trail for personal data processing",
                "compliance_area": "info_security",
                "description": "Platform maintains an immutable audit log with recent activity.",
            },
            {
                "requirement_code": "IN-DPDP-DPA",
                "requirement_name": "Data processing agreements with customers",
                "compliance_area": "info_security",
                "description": "Executed DPAs for B2B tenants processing personal data.",
            },
        ],
    },
    {
        "framework_code": "IN-GST",
        "framework_name": "India — Goods and Services Tax",
        "framework_type": "regulatory",
        "jurisdiction": "India",
        "description": "GST invoicing, tax register, and indirect tax compliance.",
        "requirements": [
            {
                "requirement_code": "IN-GST-TAX-REGISTER",
                "requirement_name": "GST tax register maintained in ERP",
                "compliance_area": "tax",
                "description": "Posted GST/VAT/TDS lines recorded in finance tax register.",
            },
            {
                "requirement_code": "IN-GST-EINVOICE",
                "requirement_name": "E-invoicing (IRN) for applicable turnover",
                "compliance_area": "tax",
                "description": "B2B invoices registered on IRP where legally required.",
            },
        ],
    },
    {
        "framework_code": "IN-LABOUR",
        "framework_name": "India — Labour & Payroll Statutory",
        "framework_type": "regulatory",
        "jurisdiction": "India",
        "description": "PF, ESI, TDS on salary, and state professional tax obligations.",
        "requirements": [
            {
                "requirement_code": "IN-LAB-PF",
                "requirement_name": "Provident Fund (EPF) compliance",
                "compliance_area": "labor",
                "description": "Monthly ECR and contributions for eligible establishments.",
            },
            {
                "requirement_code": "IN-LAB-ESI",
                "requirement_name": "Employee State Insurance (ESI)",
                "compliance_area": "labor",
                "description": "ESI contributions and returns for notified establishments.",
            },
        ],
    },
]


def ensure_framework(db, *, tenant_id, company_id, owner_id, spec: dict) -> GrcComplianceFramework:
    row = db.scalar(
        select(GrcComplianceFramework).where(
            GrcComplianceFramework.tenant_id == tenant_id,
            GrcComplianceFramework.company_id == company_id,
            GrcComplianceFramework.framework_code == spec["framework_code"],
            GrcComplianceFramework.is_deleted.is_(False),
        )
    )
    if row:
        return row
    row = GrcComplianceFramework(
        tenant_id=tenant_id,
        company_id=company_id,
        framework_code=spec["framework_code"],
        framework_name=spec["framework_name"],
        framework_type=spec["framework_type"],
        jurisdiction=spec["jurisdiction"],
        description=spec["description"],
        owner_employee_id=owner_id,
        status="active",
        created_by=owner_id,
        updated_by=owner_id,
    )
    db.add(row)
    db.flush()
    return row


def ensure_requirement(
    db,
    *,
    tenant_id,
    company_id,
    framework_id,
    owner_id,
    spec: dict,
) -> GrcComplianceRequirement:
    row = db.scalar(
        select(GrcComplianceRequirement).where(
            GrcComplianceRequirement.framework_id == framework_id,
            GrcComplianceRequirement.requirement_code == spec["requirement_code"],
            GrcComplianceRequirement.is_deleted.is_(False),
        )
    )
    if row:
        return row
    row = GrcComplianceRequirement(
        tenant_id=tenant_id,
        company_id=company_id,
        framework_id=framework_id,
        requirement_code=spec["requirement_code"],
        requirement_name=spec["requirement_name"],
        description=spec.get("description"),
        compliance_area=spec.get("compliance_area"),
        owner_employee_id=owner_id,
        due_date=date.today() + timedelta(days=90),
        status="active",
        created_by=owner_id,
        updated_by=owner_id,
    )
    db.add(row)
    db.flush()
    return row


def main() -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if tenant is None:
            print("No BOOTSTRAP tenant — run seed_demo_data first.")
            return
        company = db.scalar(
            select(OrgCompany).where(OrgCompany.tenant_id == tenant.id).limit(1)
        )
        if company is None:
            print("No company for tenant.")
            return
        employee = db.scalar(
            select(MasterEmployee).where(MasterEmployee.tenant_id == tenant.id).limit(1)
        )
        if employee is None:
            print("No employee master — run org/master seeds first.")
            return

        created_fw = 0
        created_req = 0
        for spec in FRAMEWORKS:
            before_fw = db.scalar(
                select(GrcComplianceFramework).where(
                    GrcComplianceFramework.company_id == company.id,
                    GrcComplianceFramework.framework_code == spec["framework_code"],
                )
            )
            fw = ensure_framework(
                db,
                tenant_id=tenant.id,
                company_id=company.id,
                owner_id=employee.id,
                spec=spec,
            )
            if before_fw is None:
                created_fw += 1
            for req in spec["requirements"]:
                before_req = db.scalar(
                    select(GrcComplianceRequirement).where(
                        GrcComplianceRequirement.framework_id == fw.id,
                        GrcComplianceRequirement.requirement_code == req["requirement_code"],
                    )
                )
                ensure_requirement(
                    db,
                    tenant_id=tenant.id,
                    company_id=company.id,
                    framework_id=fw.id,
                    owner_id=employee.id,
                    spec=req,
                )
                if before_req is None:
                    created_req += 1

        db.commit()
        print(f"India GRC catalog ready. New frameworks: {created_fw}, new requirements: {created_req}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
