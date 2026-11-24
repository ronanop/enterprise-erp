"""Set Deployed At for client-side employees from spreadsheet extract.

- Listed codes → tag=client_side + deployed_at from sheet (Airtel/CRIS/CBI/…)
- Other non-client employees → tag=office_staff + deployed_at=Cache
- UI also shows Cache for Office even if empty

Usage (from apps/api):
  .venv\\Scripts\\python.exe scripts/set_client_deployed_at.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent.parent
sys.path.insert(0, str(ROOT / "src"))
load_dotenv(REPO / ".env", override=True)

from database.session import SessionLocal  # noqa: E402
from modules.hr.models.employee_profile import HrEmployeeProfile  # noqa: E402
from modules.hr.repository.base import utcnow as hr_utcnow  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402

_ = (OrgCompany, OrgBranch)

DATA_PATH = Path(__file__).resolve().parent / "data" / "client_deployed_at_rows.json"
TAG = "client_side"


def _candidates(code: str) -> list[str]:
    c = str(code or "").strip().upper()
    if not c:
        return []
    out = [c]
    if c.startswith("CTS") and c[3:].isdigit():
        n = c[3:]
        out.extend([f"CT{n}", f"CT5{n}", f"CDPL5{n}", f"CDPL{n}"])
    if c.startswith("CT") and c[2:].isdigit():
        n = c[2:]
        out.extend([f"CTS{n}", f"CDPL{n}", f"VPL{n}"])
    if c.startswith("CDPL") and c[4:].isdigit():
        n = c[4:]
        out.extend([f"CT{n}", f"VPL{n}"])
    seen: set[str] = set()
    uniq: list[str] = []
    for x in out:
        x = x.strip().upper()
        if x and x not in seen:
            seen.add(x)
            uniq.append(x)
    return uniq


def _merge_client(skills_json: object | None, *, deployed_at: str) -> dict:
    if isinstance(skills_json, dict):
        base = dict(skills_json)
    elif isinstance(skills_json, list):
        base = {"items": skills_json}
    else:
        base = {}
    tags = []
    raw = base.get("tags")
    if isinstance(raw, list):
        tags = [str(t).strip().lower() for t in raw if str(t).strip()]
    elif isinstance(raw, str) and raw.strip():
        tags = [raw.strip().lower()]
    tags = [t for t in tags if t not in {"office_staff", "client_side"}]
    tags.append(TAG)
    base["tags"] = tags
    base["deployed_at"] = deployed_at
    return base


def _merge_office_cache(skills_json: object | None) -> dict:
    if isinstance(skills_json, dict):
        base = dict(skills_json)
    elif isinstance(skills_json, list):
        base = {"items": skills_json}
    else:
        base = {}
    tags = []
    raw = base.get("tags")
    if isinstance(raw, list):
        tags = [str(t).strip().lower() for t in raw if str(t).strip()]
    elif isinstance(raw, str) and raw.strip():
        tags = [raw.strip().lower()]
    tags = [t for t in tags if t not in {"office_staff", "client_side"}]
    tags.append("office_staff")
    base["tags"] = tags
    base["deployed_at"] = "Cache"
    return base


def main() -> None:
    rows = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    db = SessionLocal()
    try:
        employees = list(
            db.scalars(select(MasterEmployee).where(MasterEmployee.is_deleted.is_(False))).all()
        )
        by_code = {str(e.employee_code or "").strip().upper(): e for e in employees}
        profiles = {
            p.employee_id: p
            for p in db.scalars(
                select(HrEmployeeProfile).where(HrEmployeeProfile.is_deleted.is_(False))
            ).all()
        }

        found = 0
        missing: list[str] = []
        updated = 0
        listed_emp_ids: set = set()

        for row in rows:
            code = str(row.get("employee_code") or "").strip().upper()
            site = str(row.get("deployed_at") or "").strip()
            if not code or not site:
                continue
            emp = None
            for cand in _candidates(code):
                emp = by_code.get(cand)
                if emp is not None:
                    break
            if emp is None and code == "CT5288":
                emp = by_code.get("CT5289")
            if emp is None and code == "CDPL5060":
                emp = by_code.get("CDPL5069")
            if emp is None:
                missing.append(code)
                continue
            found += 1
            listed_emp_ids.add(emp.id)

            profile = profiles.get(emp.id)
            if profile is None:
                if not emp.branch_id or not emp.company_id:
                    missing.append(code)
                    continue
                profile = HrEmployeeProfile(
                    id=uuid4(),
                    tenant_id=emp.tenant_id,
                    company_id=emp.company_id,
                    branch_id=emp.branch_id,
                    employee_id=emp.id,
                    skills_json=_merge_client(None, deployed_at=site),
                    status="active",
                )
                db.add(profile)
                profiles[emp.id] = profile
                updated += 1
                continue

            skills = profile.skills_json if isinstance(profile.skills_json, dict) else {}
            cur_site = str(skills.get("deployed_at") or "").strip()
            tags = skills.get("tags") if isinstance(skills.get("tags"), list) else []
            has_client = any(str(t).strip().lower() == TAG for t in tags)
            if cur_site == site and has_client:
                continue
            profile.skills_json = _merge_client(profile.skills_json, deployed_at=site)
            flag_modified(profile, "skills_json")
            profile.updated_at = hr_utcnow()
            profile.version = int(profile.version or 1) + 1
            updated += 1

        office_stamped = 0
        for emp in employees:
            if emp.id in listed_emp_ids:
                continue
            profile = profiles.get(emp.id)
            skills = profile.skills_json if profile and isinstance(profile.skills_json, dict) else {}
            tags = skills.get("tags") if isinstance(skills.get("tags"), list) else []
            if any(str(t).strip().lower() == TAG for t in tags):
                continue
            if profile is None:
                if not emp.branch_id or not emp.company_id:
                    continue
                profile = HrEmployeeProfile(
                    id=uuid4(),
                    tenant_id=emp.tenant_id,
                    company_id=emp.company_id,
                    branch_id=emp.branch_id,
                    employee_id=emp.id,
                    skills_json=_merge_office_cache(None),
                    status="active",
                )
                db.add(profile)
                profiles[emp.id] = profile
                office_stamped += 1
                continue
            if str(skills.get("deployed_at") or "").strip() == "Cache":
                continue
            profile.skills_json = _merge_office_cache(profile.skills_json)
            flag_modified(profile, "skills_json")
            profile.updated_at = hr_utcnow()
            profile.version = int(profile.version or 1) + 1
            office_stamped += 1

        db.commit()
        print(f"list_rows={len(rows)}")
        print(f"client_found={found}")
        print(f"client_updated={updated}")
        print(f"client_missing={len(set(missing))}")
        if missing:
            print("missing_codes=" + ", ".join(sorted(set(missing))))
        print(f"office_stamped_cache={office_stamped}")
        print("done")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
