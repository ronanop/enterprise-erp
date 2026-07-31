"""Seed 2–3 mock rows per Asset resource via SQLAlchemy (commits explicitly)."""

from __future__ import annotations

import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

sys.path.insert(0, "src")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from core.config import get_settings
from modules.asset.service.asset_category_service import AssetCategoryService
from modules.asset.service.asset_service import AssetService
from modules.asset.service.assignment_service import AssignmentService
from modules.asset.service.component_service import ComponentService
from modules.asset.service.depreciation_service import DepreciationService
from modules.asset.service.disposal_service import DisposalService
from modules.asset.service.insurance_service import InsuranceService
from modules.asset.service.location_service import LocationService
from modules.asset.service.maintenance_plan_service import MaintenancePlanService
from modules.asset.service.maintenance_service import MaintenanceService
from modules.asset.service.revaluation_service import RevaluationService
from modules.asset.service.service_history_service import ServiceHistoryService
from modules.asset.service.transfer_service import TransferService
from modules.asset.service.warranty_service import WarrantyService
from modules.foundation.domain.value_objects import TenantContext

# Optional services — import lazily if names differ
from modules.asset.service.asset_audit_service import AssetAuditService
from modules.asset.service.checklist_service import ChecklistService
from modules.asset.service.document_service import DocumentService
from modules.asset.service.meter_reading_service import MeterReadingService
from modules.asset.service.notification_service import NotificationService
from modules.asset.service.asset_report_service import AssetReportService
from modules.master_data.service.employee_service import EmployeeService
from modules.organization.service.hierarchy_service import DepartmentService


def ensure_discovery_column(engine) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE asset.ast_asset "
                "ADD COLUMN IF NOT EXISTS discovery_profile_json jsonb"
            )
        )


def ctx_from_db(db: Session) -> tuple[TenantContext, UUID, UUID]:
    company = db.execute(
        text(
            "select id, tenant_id from organization.org_company "
            "where company_code = 'DEMOCO' and is_deleted is false limit 1"
        )
    ).mappings().first()
    if not company:
        company = db.execute(
            text(
                "select id, tenant_id from organization.org_company "
                "where is_deleted is false limit 1"
            )
        ).mappings().first()
    branch = db.execute(
        text(
            "select id from organization.org_branch "
            "where company_id = :cid and is_deleted is false order by branch_code limit 1"
        ),
        {"cid": company["id"]},
    ).mappings().first()
    user = db.execute(
        text(
            "select id from foundation.sec_user "
            "where email = 'admin@example.com' and is_deleted is false limit 1"
        )
    ).mappings().first()
    if not user:
        user = db.execute(
            text("select id from foundation.sec_user where is_deleted is false limit 1")
        ).mappings().first()
    ctx = TenantContext(
        tenant_id=company["tenant_id"],
        user_id=user["id"] if user else None,
        user_type="employee",
        company_id=company["id"],
        branch_id=branch["id"],
    )
    return ctx, company["id"], branch["id"]


def safe(label: str, fn):
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001
        print(f"  ! {label}: {exc}")
        return None


def main() -> None:
    settings = get_settings()
    engine = create_engine(str(settings.database_url), pool_pre_ping=True)
    ensure_discovery_column(engine)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    db = SessionLocal()
    results: dict[str, int] = {}
    try:
        ctx, company_id, branch_id = ctx_from_db(db)
        print(f"tenant={ctx.tenant_id} company={company_id} branch={branch_id}")

        # Departments
        dept_svc = DepartmentService(db)
        depts = list(dept_svc.list_departments(ctx, company_id=company_id) or [])
        for code, name in (("IT", "Information Technology"), ("OPS", "Operations"), ("FIN", "Finance")):
            if any(getattr(d, "department_code", None) == code for d in depts):
                continue
            created = safe(
                f"dept-{code}",
                lambda c=code, n=name: dept_svc.create_department(
                    ctx,
                    company_id=company_id,
                    branch_id=branch_id,
                    department_code=c,
                    department_name=n,
                ),
            )
            if created:
                depts.append(created)
        db.commit()
        results["departments"] = len(depts)
        print(f"departments: {len(depts)}")

        # Employees
        emp_svc = EmployeeService(db)
        emps = list(emp_svc.list_employees(ctx, company_id=company_id) or [])
        if len(emps) < 2 and depts:
            for i, (fn, ln, des) in enumerate(
                (("Asha", "Verma", "IT Admin"), ("Ravi", "Singh", "Ops Lead"), ("Neha", "Patil", "Auditor")),
                start=1,
            ):
                safe(
                    f"emp-{fn}",
                    lambda i=i, fn=fn, ln=ln, des=des: emp_svc.create_employee(
                        ctx,
                        branch_id=branch_id,
                        department_id=depts[i % len(depts)].id,
                        first_name=fn,
                        last_name=ln,
                        email=f"mock.asset.{i}.{uuid4().hex[:6]}@example.com",
                        mobile=f"+9198765432{i:02d}",
                        designation=des,
                        date_of_joining=date(2024, 1, 15),
                        company_id=company_id,
                        employee_code=f"MOCK-EMP-{i:03d}-{uuid4().hex[:4].upper()}",
                    ),
                )
            db.commit()
            emps = list(emp_svc.list_employees(ctx, company_id=company_id) or [])
        results["employees"] = len(emps)
        print(f"employees: {len(emps)}")

        # Categories
        cat_svc = AssetCategoryService(db)
        cat_ids = []
        for code, name, life, method in (
            ("IT-HW", "IT Hardware", 36, "straight_line"),
            ("FURN", "Office Furniture", 60, "straight_line"),
            ("VEH", "Vehicles", 72, "wdv"),
        ):
            existing = cat_svc._repo.get_by_code(ctx, company_id, code)
            if existing:
                cat_ids.append(existing.id)
                continue
            row = cat_svc.create(
                ctx,
                company_id=company_id,
                category_code=code,
                category_name=name,
                default_useful_life_months=life,
                default_depreciation_method=method,
            )
            cat_ids.append(row.id)
        db.commit()
        results["categories"] = len(cat_ids)
        print(f"categories: {len(cat_ids)}")

        # Assets
        asset_svc = AssetService(db)
        asset_defs = [
            ("Dell Latitude 5540", cat_ids[0], "45000", "SN-DELL-5540-01"),
            ("Herman Miller Chair", cat_ids[1], "28000", "SN-HM-CHAIR-02"),
            ("Toyota Innova Crysta", cat_ids[2], "1850000", "SN-INN-CRY-03"),
        ]
        assets = []
        for name, cat_id, cost, serial in asset_defs:
            row = asset_svc.create(
                ctx,
                branch_id=branch_id,
                asset_name=name,
                asset_category_id=cat_id,
                asset_type="fixed",
                purchase_date=date(2025, 3, 15),
                purchase_cost=Decimal(cost),
                currency_code="INR",
                serial_number=serial,
                salvage_value=Decimal("1000"),
                depreciation_method="straight_line",
                useful_life_months=36,
                department_id=depts[0].id if depts else None,
                custodian_employee_id=emps[0].id if emps else None,
            )
            assets.append(row)
        db.commit()
        results["assets"] = len(assets)
        print(f"assets: {len(assets)}")
        a0, a1, a2 = assets[0].id, assets[1].id, assets[2].id

        def count(label: str, items):
            results[label] = len(items)
            print(f"{label}: {len(items)}")
            return items

        # Components
        comp = ComponentService(db)
        comps = []
        for body in (
            {"asset_id": a0, "component_code": "RAM-16G", "component_name": "16GB DDR4 RAM", "quantity": Decimal("2")},
            {"asset_id": a0, "component_code": "SSD-512", "component_name": "512GB NVMe SSD", "quantity": Decimal("1")},
            {"asset_id": a2, "component_code": "TYRE-SET", "component_name": "Alloy Wheel Set", "quantity": Decimal("4")},
        ):
            row = safe("component", lambda b=body: comp.create(ctx, **b))
            if row:
                comps.append(row)
        db.commit()
        count("components", comps)

        # Locations
        loc = LocationService(db)
        locs = []
        for aid, label in (
            (a0, "HQ Floor 3 - Cubicle A12"),
            (a1, "HQ Floor 2 - Open Office"),
            (a2, "Basement Parking B2"),
        ):
            row = safe("location", lambda aid=aid, label=label: loc.create(ctx, asset_id=aid, location_label=label))
            if row:
                locs.append(row)
        db.commit()
        count("locations", locs)

        # Warranties
        war = WarrantyService(db)
        wars = []
        for body in (
            {"asset_id": a0, "warranty_type": "manufacturer", "start_date": date(2025, 3, 15), "end_date": date(2028, 3, 14), "coverage_notes": "3-year onsite"},
            {"asset_id": a1, "warranty_type": "manufacturer", "start_date": date(2025, 3, 15), "end_date": date(2027, 3, 14)},
            {"asset_id": a2, "warranty_type": "extended", "start_date": date(2025, 3, 15), "end_date": date(2030, 3, 14)},
        ):
            row = safe("warranty", lambda b=body: war.create(ctx, **b))
            if row:
                wars.append(row)
        db.commit()
        count("warranties", wars)

        # Insurance
        ins = InsuranceService(db)
        inss = []
        for body in (
            {"asset_id": a0, "policy_number": "POL-IT-2025-001", "insurer_name": "ICICI Lombard", "coverage_amount": Decimal("50000"), "start_date": date(2025, 3, 15), "end_date": date(2026, 3, 14)},
            {"asset_id": a2, "policy_number": "POL-VEH-2025-014", "insurer_name": "Bajaj Allianz", "coverage_amount": Decimal("2000000"), "start_date": date(2025, 3, 15), "end_date": date(2026, 3, 14)},
            {"asset_id": a1, "policy_number": "POL-FURN-2025-003", "insurer_name": "HDFC ERGO", "coverage_amount": Decimal("35000"), "start_date": date(2025, 4, 1), "end_date": date(2026, 3, 31)},
        ):
            row = safe("insurance", lambda b=body: ins.create(ctx, **b))
            if row:
                inss.append(row)
        db.commit()
        count("insurances", inss)

        # Maintenance plans
        plan = MaintenancePlanService(db)
        plans = []
        for body in (
            {"asset_id": a0, "plan_name": "Laptop preventive care", "maintenance_type": "preventive", "frequency_days": 180, "next_due_date": date(2026, 9, 15)},
            {"asset_id": a2, "plan_name": "Vehicle annual service", "maintenance_type": "annual_service", "frequency_days": 365, "next_due_date": date(2026, 3, 15)},
            {"asset_id": a1, "plan_name": "Furniture inspection", "maintenance_type": "preventive", "frequency_days": 365, "next_due_date": date(2027, 3, 15)},
        ):
            row = safe("plan", lambda b=body: plan.create(ctx, **b))
            if row:
                plans.append(row)
        db.commit()
        count("maintenance_plans", plans)

        # Maintenances
        maint = MaintenanceService(db)
        maints = []
        for body in (
            {"branch_id": branch_id, "asset_id": a0, "maintenance_type": "preventive", "scheduled_date": date(2026, 8, 1), "cost_amount": Decimal("1500")},
            {"branch_id": branch_id, "asset_id": a2, "maintenance_type": "annual_service", "scheduled_date": date(2026, 3, 20), "cost_amount": Decimal("8500")},
            {"branch_id": branch_id, "asset_id": a1, "maintenance_type": "corrective", "scheduled_date": date(2026, 7, 10), "cost_amount": Decimal("900")},
        ):
            row = safe("maintenance", lambda b=body: maint.create(ctx, **b))
            if row:
                maints.append(row)
        db.commit()
        count("maintenances", maints)

        # Service histories
        hist = ServiceHistoryService(db)
        hists = []
        for m in maints[:3]:
            row = safe(
                "service_history",
                lambda m=m: hist.create(
                    ctx,
                    asset_id=m.asset_id,
                    maintenance_id=m.id,
                    service_summary=f"Completed service {getattr(m, 'document_number', m.id)}",
                    cost_amount=m.cost_amount or Decimal("0"),
                    serviced_at=datetime.now(timezone.utc),
                ),
            )
            if row:
                hists.append(row)
        db.commit()
        count("service_histories", hists)

        # Assignments
        asn = AssignmentService(db)
        asns = []
        bodies = []
        if emps:
            bodies.append({"branch_id": branch_id, "asset_id": a0, "allocation_type": "employee", "employee_id": emps[0].id, "expected_return_at": date(2026, 12, 31)})
        if depts:
            bodies.append({"branch_id": branch_id, "asset_id": a1, "allocation_type": "department", "department_id": depts[0].id})
        bodies.append({"branch_id": branch_id, "asset_id": a2, "allocation_type": "branch"})
        for body in bodies[:3]:
            row = safe("assignment", lambda b=body: asn.create(ctx, **b))
            if row:
                asns.append(row)
        db.commit()
        count("assignments", asns)

        # Transfers
        trf = TransferService(db)
        trfs = []
        for body in (
            {"branch_id": branch_id, "asset_id": a0, "to_location_label": "HQ Floor 4 - Meeting Room", "reason": "Team relocation", "effective_date": date(2026, 8, 1)},
            {"branch_id": branch_id, "asset_id": a1, "to_location_label": "Warehouse Staging Area", "reason": "Temporary storage", "effective_date": date(2026, 7, 20)},
            {"branch_id": branch_id, "asset_id": a2, "to_location_label": "Client Site Visit Pool", "reason": "Pool vehicle", "effective_date": date(2026, 7, 25)},
        ):
            row = safe("transfer", lambda b=body: trf.create(ctx, **b))
            if row:
                trfs.append(row)
        db.commit()
        count("transfers", trfs)

        # Depreciations
        dep = DepreciationService(db)
        deps = []
        for body in (
            {"asset_id": a0, "period_year": 2026, "period_month": 4, "method": "straight_line"},
            {"asset_id": a1, "period_year": 2026, "period_month": 4, "method": "straight_line"},
            {"asset_id": a2, "period_year": 2026, "period_month": 5, "method": "straight_line"},
        ):
            row = safe("depreciation", lambda b=body: dep.create(ctx, **b))
            if row:
                deps.append(row)
        db.commit()
        count("depreciations", deps)

        # Revaluations
        rev = RevaluationService(db)
        revs = []
        for body in (
            {"branch_id": branch_id, "asset_id": a0, "new_book_value": Decimal("38000"), "reason": "Market residual adjustment", "revaluation_date": date(2026, 6, 1)},
            {"branch_id": branch_id, "asset_id": a2, "new_book_value": Decimal("1650000"), "reason": "Fair value review", "revaluation_date": date(2026, 6, 15)},
            {"branch_id": branch_id, "asset_id": a1, "new_book_value": Decimal("22000"), "reason": "Condition reassessment", "revaluation_date": date(2026, 6, 20)},
        ):
            row = safe("revaluation", lambda b=body: rev.create(ctx, **b))
            if row:
                revs.append(row)
        db.commit()
        count("revaluations", revs)

        # Disposable assets + disposals
        disposable = []
        for i, name in enumerate(("Old Keyboard Batch A", "Retired Monitor 24in", "Scrap Docking Station"), start=1):
            row = asset_svc.create(
                ctx,
                branch_id=branch_id,
                asset_name=name,
                asset_category_id=cat_ids[0],
                asset_type="fixed",
                purchase_date=date(2020, 1, 10),
                purchase_cost=Decimal(str(5000 * i)),
                currency_code="INR",
                serial_number=f"SCRAP-{i}-{uuid4().hex[:6].upper()}",
            )
            disposable.append(row)
        db.commit()
        results["assets"] += len(disposable)

        dsp = DisposalService(db)
        dsps = []
        for body in (
            {"branch_id": branch_id, "asset_id": disposable[0].id, "disposal_type": "scrap", "disposal_date": date(2026, 7, 1), "proceeds_amount": Decimal("0")},
            {"branch_id": branch_id, "asset_id": disposable[1].id, "disposal_type": "sale", "disposal_date": date(2026, 7, 5), "proceeds_amount": Decimal("2500")},
            {"branch_id": branch_id, "asset_id": disposable[2].id, "disposal_type": "donation", "disposal_date": date(2026, 7, 10), "proceeds_amount": Decimal("0")},
        ):
            row = safe("disposal", lambda b=body: dsp.create(ctx, **b))
            if row:
                dsps.append(row)
        db.commit()
        count("disposals", dsps)

        # Audits
        aud = AssetAuditService(db)
        auds = []
        if emps:
            for body in (
                {"branch_id": branch_id, "asset_id": a0, "auditor_employee_id": emps[-1].id, "audit_date": date(2026, 7, 12), "found_status": "found", "notes": "Verified at desk"},
                {"branch_id": branch_id, "asset_id": a1, "auditor_employee_id": emps[-1].id, "audit_date": date(2026, 7, 12), "found_status": "relocated", "notes": "Moved to floor 2"},
                {"branch_id": branch_id, "asset_id": a2, "auditor_employee_id": emps[-1].id, "audit_date": date(2026, 7, 13), "found_status": "found", "notes": "Parking bay B2"},
            ):
                row = safe("audit", lambda b=body: aud.create(ctx, **b))
                if row:
                    auds.append(row)
            db.commit()
        count("audits", auds)

        # Documents
        doc = DocumentService(db)
        docs = []
        for body in (
            {"asset_id": a0, "document_type": "invoice", "document_name": "Dell Purchase Invoice", "storage_uri": "s3://demo/assets/dell-invoice.pdf"},
            {"asset_id": a2, "document_type": "insurance", "document_name": "Vehicle Policy PDF", "storage_uri": "s3://demo/assets/vehicle-policy.pdf"},
            {"asset_id": a1, "document_type": "photo", "document_name": "Chair photo", "storage_uri": "s3://demo/assets/chair.jpg"},
        ):
            row = safe("document", lambda b=body: doc.create(ctx, **b))
            if row:
                docs.append(row)
        db.commit()
        count("documents", docs)

        # Checklists
        chk = ChecklistService(db)
        chks = []
        for body in (
            {"asset_id": a0, "checklist_code": f"CHK-LAP-{uuid4().hex[:4].upper()}", "checklist_name": "Laptop handover checklist", "items_json": [{"item": "Power adapter", "done": True}]},
            {"asset_id": a2, "checklist_code": f"CHK-VEH-{uuid4().hex[:4].upper()}", "checklist_name": "Vehicle pre-trip checklist", "items_json": [{"item": "Fuel level", "done": False}]},
            {"checklist_code": f"CHK-GEN-{uuid4().hex[:4].upper()}", "checklist_name": "Generic asset inspection", "items_json": [{"item": "Physical condition", "done": False}]},
        ):
            row = safe("checklist", lambda b=body: chk.create(ctx, **b))
            if row:
                chks.append(row)
        db.commit()
        count("checklists", chks)

        # Meter readings
        meter = MeterReadingService(db)
        meters = []
        now = datetime.now(timezone.utc)
        for body in (
            {"asset_id": a2, "meter_type": "odometer", "reading_value": Decimal("12450"), "reading_at": now, "recorded_by_employee_id": emps[0].id if emps else None},
            {"asset_id": a0, "meter_type": "runtime_hours", "reading_value": Decimal("820"), "reading_at": now},
            {"asset_id": a2, "meter_type": "odometer", "reading_value": Decimal("12610"), "reading_at": now},
        ):
            row = safe("meter", lambda b=body: meter.create(ctx, **{k: v for k, v in b.items() if v is not None}))
            if row:
                meters.append(row)
        db.commit()
        count("meter_readings", meters)

        # Notifications
        note = NotificationService(db)
        notes = []
        for body in (
            {"asset_id": a0, "notification_type": "warranty_expiry", "payload_json": {"message": "Warranty expires in 90 days"}},
            {"asset_id": a2, "notification_type": "insurance_expiry", "payload_json": {"message": "Renew vehicle insurance"}},
            {"asset_id": a1, "notification_type": "maintenance_due", "payload_json": {"message": "Furniture inspection due"}},
        ):
            row = safe("notification", lambda b=body: note.create(ctx, **b))
            if row:
                notes.append(row)
        db.commit()
        count("notifications", notes)

        # Reports
        report = AssetReportService(db)
        reps = []
        for key in ("asset_summary", "asset_inventory", "executive_dashboard"):
            row = safe(
                f"report-{key}",
                lambda key=key: report.generate(
                    ctx, report_key=key, company_id=company_id, branch_id=branch_id
                ),
            )
            if row:
                reps.append(row)
        db.commit()
        count("reports", reps)

        print("\n=== SEED SUMMARY ===")
        for k, v in results.items():
            print(f"  {k}: {v}")
        print("Refresh UI: http://localhost:3000/assets/assets")
    finally:
        db.close()


if __name__ == "__main__":
    main()
