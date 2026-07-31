"""Activate draft assets and fill remaining Asset mock dependents."""

from __future__ import annotations

import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

sys.path.insert(0, "src")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from core.config import get_settings
from modules.asset.service.asset_audit_service import AssetAuditService
from modules.asset.service.assignment_service import AssignmentService
from modules.asset.service.checklist_service import ChecklistService
from modules.asset.service.depreciation_service import DepreciationService
from modules.asset.service.disposal_service import DisposalService
from modules.asset.service.insurance_service import InsuranceService
from modules.asset.service.location_service import LocationService
from modules.asset.service.maintenance_plan_service import MaintenancePlanService
from modules.asset.service.maintenance_service import MaintenanceService
from modules.asset.service.notification_service import NotificationService
from modules.asset.service.revaluation_service import RevaluationService
from modules.asset.service.service_history_service import ServiceHistoryService
from modules.asset.service.transfer_service import TransferService
from modules.asset.service.warranty_service import WarrantyService
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.models.employee import MasterEmployee
from modules.organization.models.hierarchy import OrgDepartment


def safe(label, fn):
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001
        print(f"  ! {label}: {exc}")
        return None


def main() -> None:
    engine = create_engine(str(get_settings().database_url), pool_pre_ping=True)
    db = sessionmaker(bind=engine)()
    try:
        activated = db.execute(
            text(
                """
                update asset.ast_asset
                set status = 'active',
                    workflow_status = coalesce(workflow_status, 'approved'),
                    updated_at = now()
                where is_deleted is false and status = 'draft'
                returning id, asset_name
                """
            )
        ).fetchall()
        db.commit()
        print(f"activated: {len(activated)}")

        company = db.execute(
            text(
                "select id, tenant_id from organization.org_company "
                "where company_code = 'DEMOCO' limit 1"
            )
        ).mappings().first()
        branch = db.execute(
            text(
                "select id from organization.org_branch "
                "where company_id = :c limit 1"
            ),
            {"c": company["id"]},
        ).mappings().first()
        user = db.execute(
            text(
                "select id from foundation.sec_user "
                "where email = 'admin@example.com' limit 1"
            )
        ).mappings().first()

        emps = list(
            db.query(MasterEmployee)
            .filter(
                MasterEmployee.company_id == company["id"],
                MasterEmployee.is_deleted.is_(False),
            )
            .limit(3)
        )
        depts = list(
            db.query(OrgDepartment)
            .filter(
                OrgDepartment.company_id == company["id"],
                OrgDepartment.is_deleted.is_(False),
            )
            .limit(3)
        )
        assets = db.execute(
            text(
                """
                select id, asset_name from asset.ast_asset
                where company_id = :c and is_deleted is false
                  and asset_name in ('Dell Latitude 5540', 'Herman Miller Chair', 'Toyota Innova Crysta')
                order by asset_name
                """
            ),
            {"c": company["id"]},
        ).fetchall()
        scrap = db.execute(
            text(
                """
                select id from asset.ast_asset
                where company_id = :c and is_deleted is false
                  and (asset_name like 'Old%' or asset_name like 'Retired%' or asset_name like 'Scrap%')
                order by created_at
                """
            ),
            {"c": company["id"]},
        ).fetchall()
        print(f"assets={len(assets)} scrap={len(scrap)} emps={len(emps)} depts={len(depts)}")
        a_by_name = {r[1]: r[0] for r in assets}
        a0 = a_by_name["Dell Latitude 5540"]
        a1 = a_by_name["Herman Miller Chair"]
        a2 = a_by_name["Toyota Innova Crysta"]
        emp0 = emps[0].id if emps else None
        emp_last = emps[-1].id if emps else None
        dept0 = depts[0].id if depts else None
        branch_id = branch["id"]
        ctx = TenantContext(
            tenant_id=company["tenant_id"],
            user_id=user["id"],
            user_type="employee",
            company_id=company["id"],
            branch_id=branch_id,
        )

        loc = LocationService(db)
        for aid, label in (
            (a0, "HQ Floor 3 - Cubicle A12"),
            (a1, "HQ Floor 2 - Open Office"),
            (a2, "Basement Parking B2"),
        ):
            safe("loc", lambda aid=aid, label=label: loc.create(ctx, asset_id=aid, location_label=label))
        db.commit()

        war = WarrantyService(db)
        for body in (
            {
                "asset_id": a0,
                "warranty_type": "manufacturer",
                "start_date": date(2025, 3, 15),
                "end_date": date(2028, 3, 14),
                "coverage_notes": "3-year onsite",
            },
            {
                "asset_id": a1,
                "warranty_type": "manufacturer",
                "start_date": date(2025, 3, 15),
                "end_date": date(2027, 3, 14),
            },
            {
                "asset_id": a2,
                "warranty_type": "manufacturer",
                "start_date": date(2025, 3, 15),
                "end_date": date(2030, 3, 14),
            },
        ):
            safe("war", lambda b=body: war.create(ctx, **b))
        db.commit()

        ins = InsuranceService(db)
        for body in (
            {
                "asset_id": a0,
                "policy_number": "POL-IT-2025-001",
                "insurer_name": "ICICI Lombard",
                "coverage_amount": Decimal("50000"),
                "start_date": date(2025, 3, 15),
                "end_date": date(2026, 3, 14),
            },
            {
                "asset_id": a2,
                "policy_number": "POL-VEH-2025-014",
                "insurer_name": "Bajaj Allianz",
                "coverage_amount": Decimal("2000000"),
                "start_date": date(2025, 3, 15),
                "end_date": date(2026, 3, 14),
            },
            {
                "asset_id": a1,
                "policy_number": "POL-FURN-2025-003",
                "insurer_name": "HDFC ERGO",
                "coverage_amount": Decimal("35000"),
                "start_date": date(2025, 4, 1),
                "end_date": date(2026, 3, 31),
            },
        ):
            safe("ins", lambda b=body: ins.create(ctx, **b))
        db.commit()

        plan = MaintenancePlanService(db)
        for body in (
            {
                "asset_id": a0,
                "plan_name": "Laptop preventive care",
                "maintenance_type": "preventive",
                "frequency_days": 180,
                "next_due_date": date(2026, 9, 15),
            },
            {
                "asset_id": a2,
                "plan_name": "Vehicle annual service",
                "maintenance_type": "annual_service",
                "frequency_days": 365,
                "next_due_date": date(2026, 3, 15),
            },
            {
                "asset_id": a1,
                "plan_name": "Furniture inspection",
                "maintenance_type": "preventive",
                "frequency_days": 365,
                "next_due_date": date(2027, 3, 15),
            },
        ):
            safe("plan", lambda b=body: plan.create(ctx, **b))
        db.commit()

        maint = MaintenanceService(db)
        maints = []
        for body in (
            {
                "branch_id": branch_id,
                "asset_id": a0,
                "maintenance_type": "preventive",
                "scheduled_date": date(2026, 8, 1),
                "cost_amount": Decimal("1500"),
            },
            {
                "branch_id": branch_id,
                "asset_id": a2,
                "maintenance_type": "annual_service",
                "scheduled_date": date(2026, 3, 20),
                "cost_amount": Decimal("8500"),
            },
            {
                "branch_id": branch_id,
                "asset_id": a1,
                "maintenance_type": "corrective",
                "scheduled_date": date(2026, 7, 10),
                "cost_amount": Decimal("900"),
            },
        ):
            row = safe("maint", lambda b=body: maint.create(ctx, **b))
            if row:
                maints.append(row)
        db.commit()

        hist = ServiceHistoryService(db)
        for m in maints:
            safe(
                "hist",
                lambda m=m: hist.create(
                    ctx,
                    asset_id=m.asset_id,
                    maintenance_id=m.id,
                    service_summary=f"Service done {m.id}",
                    cost_amount=m.cost_amount or Decimal("0"),
                    serviced_at=datetime.now(timezone.utc),
                ),
            )
        db.commit()

        asn = AssignmentService(db)
        bodies = []
        if emp0:
            bodies.append(
                {
                    "branch_id": branch_id,
                    "asset_id": a0,
                    "allocation_type": "employee",
                    "employee_id": emp0,
                    "expected_return_at": date(2026, 12, 31),
                }
            )
        if dept0:
            bodies.append(
                {
                    "branch_id": branch_id,
                    "asset_id": a1,
                    "allocation_type": "department",
                    "department_id": dept0,
                }
            )
        bodies.append({"branch_id": branch_id, "asset_id": a2, "allocation_type": "branch"})
        for body in bodies[:3]:
            safe("asn", lambda b=body: asn.create(ctx, **b))
        db.commit()

        trf = TransferService(db)
        for body in (
            {
                "branch_id": branch_id,
                "asset_id": a0,
                "to_location_label": "HQ Floor 4 - Meeting Room",
                "reason": "Team relocation",
                "effective_date": date(2026, 8, 1),
            },
            {
                "branch_id": branch_id,
                "asset_id": a1,
                "to_location_label": "Warehouse Staging Area",
                "reason": "Temporary storage",
                "effective_date": date(2026, 7, 20),
            },
            {
                "branch_id": branch_id,
                "asset_id": a2,
                "to_location_label": "Client Site Visit Pool",
                "reason": "Pool vehicle",
                "effective_date": date(2026, 7, 25),
            },
        ):
            safe("trf", lambda b=body: trf.create(ctx, **b))
        db.commit()

        dep = DepreciationService(db)
        for body in (
            {"asset_id": a0, "period_year": 2026, "period_month": 4, "method": "straight_line"},
            {"asset_id": a1, "period_year": 2026, "period_month": 4, "method": "straight_line"},
            {"asset_id": a2, "period_year": 2026, "period_month": 5, "method": "straight_line"},
        ):
            safe("dep", lambda b=body: dep.create(ctx, **b))
        db.commit()

        rev = RevaluationService(db)
        for body in (
            {
                "branch_id": branch_id,
                "asset_id": a0,
                "new_book_value": Decimal("38000"),
                "reason": "Market residual adjustment",
                "revaluation_date": date(2026, 6, 1),
            },
            {
                "branch_id": branch_id,
                "asset_id": a2,
                "new_book_value": Decimal("1650000"),
                "reason": "Fair value review",
                "revaluation_date": date(2026, 6, 15),
            },
            {
                "branch_id": branch_id,
                "asset_id": a1,
                "new_book_value": Decimal("22000"),
                "reason": "Condition reassessment",
                "revaluation_date": date(2026, 6, 20),
            },
        ):
            safe("rev", lambda b=body: rev.create(ctx, **b))
        db.commit()

        dsp = DisposalService(db)
        for i, s in enumerate(scrap[:3]):
            dtype = ["scrap", "sale", "donation"][i]
            safe(
                "dsp",
                lambda s=s, dtype=dtype, i=i: dsp.create(
                    ctx,
                    branch_id=branch_id,
                    asset_id=s[0],
                    disposal_type=dtype,
                    disposal_date=date(2026, 7, 1 + i),
                    proceeds_amount=Decimal("2500" if dtype == "sale" else "0"),
                ),
            )
        db.commit()

        if emp_last:
            aud = AssetAuditService(db)
            for body in (
                {
                    "branch_id": branch_id,
                    "asset_id": a0,
                    "auditor_employee_id": emp_last,
                    "audit_date": date(2026, 7, 12),
                    "found_status": "found",
                    "notes": "Verified at desk",
                },
                {
                    "branch_id": branch_id,
                    "asset_id": a1,
                    "auditor_employee_id": emp_last,
                    "audit_date": date(2026, 7, 12),
                    "found_status": "relocated",
                    "notes": "Moved to floor 2",
                },
                {
                    "branch_id": branch_id,
                    "asset_id": a2,
                    "auditor_employee_id": emp_last,
                    "audit_date": date(2026, 7, 13),
                    "found_status": "found",
                    "notes": "Parking bay B2",
                },
            ):
                safe("aud", lambda b=body: aud.create(ctx, **b))
            db.commit()

        chk = ChecklistService(db)
        for body in (
            {
                "asset_id": a0,
                "checklist_code": f"CHK-LAP-{uuid4().hex[:4].upper()}",
                "checklist_name": "Laptop handover",
                "items_json": {"items": [{"item": "Power adapter", "done": True}]},
            },
            {
                "asset_id": a2,
                "checklist_code": f"CHK-VEH-{uuid4().hex[:4].upper()}",
                "checklist_name": "Vehicle pre-trip",
                "items_json": {"items": [{"item": "Fuel level", "done": False}]},
            },
            {
                "asset_id": a1,
                "checklist_code": f"CHK-GEN-{uuid4().hex[:4].upper()}",
                "checklist_name": "Generic inspection",
                "items_json": {"items": [{"item": "Condition", "done": False}]},
            },
        ):
            safe("chk", lambda b=body: chk.create(ctx, **b))
        db.commit()

        note = NotificationService(db)
        for body in (
            {
                "asset_id": a0,
                "notification_type": "warranty_expiry",
                "recipient_user_id": user["id"],
                "payload_json": {"message": "Warranty expires in 90 days"},
            },
            {
                "asset_id": a2,
                "notification_type": "insurance_expiry",
                "recipient_employee_id": emp0,
                "payload_json": {"message": "Renew vehicle insurance"},
            },
            {
                "asset_id": a1,
                "notification_type": "maintenance_due",
                "recipient_user_id": user["id"],
                "payload_json": {"message": "Furniture inspection due"},
            },
        ):
            safe(
                "note",
                lambda b=body: note.create(
                    ctx, **{k: v for k, v in b.items() if v is not None}
                ),
            )
        db.commit()

        print("=== COUNTS ===")
        for label, table in (
            ("categories", "ast_asset_category"),
            ("assets", "ast_asset"),
            ("components", "ast_asset_component"),
            ("locations", "ast_asset_location"),
            ("warranties", "ast_asset_warranty"),
            ("insurances", "ast_asset_insurance"),
            ("plans", "ast_maintenance_plan"),
            ("maintenances", "ast_asset_maintenance"),
            ("service_histories", "ast_service_history"),
            ("assignments", "ast_asset_assignment"),
            ("transfers", "ast_asset_transfer"),
            ("depreciations", "ast_asset_depreciation"),
            ("revaluations", "ast_asset_revaluation"),
            ("disposals", "ast_asset_disposal"),
            ("audits", "ast_asset_audit"),
            ("documents", "ast_asset_document"),
            ("checklists", "ast_asset_checklist"),
            ("meters", "ast_meter_reading"),
            ("notifications", "ast_asset_notification"),
            ("reports", "ast_asset_report"),
        ):
            try:
                n = db.execute(
                    text(f"select count(*) from asset.{table} where is_deleted is false")
                ).scalar()
                print(f"  {label}: {n}")
            except Exception as exc:  # noqa: BLE001
                print(f"  {label}: ERR {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
