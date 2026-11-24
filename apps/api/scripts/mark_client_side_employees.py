"""Mark listed employee codes as workforce tag client_side.

Usage (from apps/api):
  .venv\\Scripts\\python.exe scripts/mark_client_side_employees.py
"""

from __future__ import annotations

import sys
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from sqlalchemy import func, select
from sqlalchemy.orm.attributes import flag_modified

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent.parent
sys.path.insert(0, str(ROOT / "src"))
load_dotenv(REPO / ".env", override=True)

from database.session import SessionLocal  # noqa: E402
from modules.hr.models.employee_profile import HrEmployeeProfile  # noqa: E402
from modules.hr.repository.base import utcnow as hr_utcnow  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402

# Ensure FK target tables are registered on the metadata before flush.
_ = (OrgCompany, OrgBranch)

# Employee IDs from workforce list (user screenshot) — mark as Client.
EMPLOYEE_CODES = [
    "CDPL2701",
    "CDPL5128",
    "CDPL5138",
    "CDPL5178",
    "CDPL0199",
    "CDPL0200",
    "CDPL5069",
    "CDPL5085",
    "CDPL5086",
    "CDPL5090",
    "CDPL0204",
    "CDPL0205",
    "CDPL0215",
    "CDPL5096",
    "CDPL0222",
    "CDPL0223",
    "CDPL0227",
    "CDPL0231",
    "CTS252",
    "CT5252",  # DB form of CTS252
    "CT0235",
    "CT0236",
    "CDPL0238",
    "CT0239",
    "CT0241",
    "CDPL0243",
    "CDPL0245",
    "CT0246",
    "CT0247",
    "CTS289",
    "CT5289",  # DB form of CTS289
    "CTS290",
    "CT5290",  # DB form of CTS290
    "CDPL5292",
    "CT0250",
    "CT0253",
    "CT0251",
    "CT0249",
    "CT0254",
    "CT0255",
    "CDPL0256",
    "CT0257",
    "CT0260",
    "CT0261",
    "CT0263",
    "CT0264",
    "CT0265",
    "CT0267",
    "CT0268",
    "CT0270",
    "CT0271",
    "CT0273",
    "CDPL0274",
    "CT0275",
    "CT0276",
    "CTS246",
    "CT5246",  # DB form of CTS246
    "CDPL5355",
    "VPL5355",  # DB form shown as CDPL5355 in list
    "CDPL0279",
    "CDPL0281",
    "CDPL0282",
    "CDPL0283",
    "CDPL0284",
    "CDPL0285",
    "CDPL0286",
    "CDPL0287",
    "CDPL0288",
    "CDPL0290",
    "CT0291",
    "CDPL0292",
    "CT0293",
    "CT0295",
    "CDPL0296",
    "CDPL0297",
    "CDPL0298",
    "CDPL0299",
    "CDPL0300",
    "CDPL0301",
    "CDPL0289",
    "CDPL0302",
    "CDPL0303",
    "CDPL0304",
    "CDPL0305",
    "CDPL0306",
    "CDPL0307",
    "CDPL0308",
    "CDPL0309",
    "CDPL0310",
    "CDPL0311",
    "CDPL0312",
    "CDPL0313",
    "CDPL0314",
    "CDPL0315",
    "CDPL0316",
    "CDPL0317",
    "CDPL0318",
    "CDPL0319",
    "CDPL0320",
    "CDPL0321",
    "CDPL0322",
    "CDPL0323",
    "CDPL0324",
    "CDPL0325",
    "CDPL0326",
    "CDPL0327",
    "CDPL0328",
    "CDPL0329",
    "CDPL0330",
    "CDPL0331",
    "CDPL0332",
    "CT0296",
    "CDPL0334",
    "CT0297",
    "CDPL0336",
]

TAG = "client_side"


def _norm_code(raw: str) -> str:
    return str(raw or "").strip().upper()


def _set_client_tag(skills_json: object | None) -> dict:
    base: dict
    if isinstance(skills_json, dict):
        base = dict(skills_json)
    elif isinstance(skills_json, list):
        base = {"items": skills_json}
    else:
        base = {}
    # Replace office/client workforce tags with client_side only.
    other = [
        t
        for t in (base.get("tags") if isinstance(base.get("tags"), list) else [])
        if str(t).strip().lower() not in {"office_staff", "client_side", ""}
    ]
    base["tags"] = [*other, TAG]
    return base


def main() -> None:
    wanted = {_norm_code(c) for c in EMPLOYEE_CODES}
    db = SessionLocal()
    try:
        employees = list(
            db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.is_deleted.is_(False),
                    func.upper(MasterEmployee.employee_code).in_(sorted(wanted)),
                )
            ).all()
        )
        found = {_norm_code(e.employee_code): e for e in employees}
        missing = sorted(wanted - set(found))
        updated = 0
        created_profiles = 0
        already = 0

        for code, emp in found.items():
            profile = db.scalar(
                select(HrEmployeeProfile).where(
                    HrEmployeeProfile.employee_id == emp.id,
                    HrEmployeeProfile.is_deleted.is_(False),
                )
            )
            if profile is None:
                branch_id = getattr(emp, "branch_id", None)
                company_id = getattr(emp, "company_id", None)
                if not branch_id or not company_id:
                    print(f"SKIP {code}: no branch/company for profile create")
                    continue
                profile = HrEmployeeProfile(
                    id=uuid4(),
                    tenant_id=emp.tenant_id,
                    company_id=company_id,
                    branch_id=branch_id,
                    employee_id=emp.id,
                    skills_json={"tags": [TAG]},
                    status="active",
                )
                db.add(profile)
                created_profiles += 1
                updated += 1
                continue

            tags = []
            if isinstance(profile.skills_json, dict):
                raw = profile.skills_json.get("tags")
                if isinstance(raw, list):
                    tags = [str(t).strip().lower() for t in raw]
            if tags == [TAG] or (TAG in tags and "office_staff" not in tags and len(tags) == 1):
                already += 1
                continue

            profile.skills_json = _set_client_tag(profile.skills_json)
            flag_modified(profile, "skills_json")
            profile.updated_at = hr_utcnow()
            profile.version = int(profile.version or 1) + 1
            updated += 1

        db.commit()
        print(f"requested={len(wanted)}")
        print(f"found={len(found)}")
        print(f"updated={updated}")
        print(f"created_profiles={created_profiles}")
        print(f"already_client={already}")
        if missing:
            print(f"missing={len(missing)}")
            print("missing_codes=" + ", ".join(missing))
        else:
            print("missing=0")
        print("done")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
