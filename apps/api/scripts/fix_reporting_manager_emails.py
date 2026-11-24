"""Apply reporting manager + official/personal emails from spreadsheet extract.

Usage (from apps/api):
  .venv\\Scripts\\python.exe scripts/fix_reporting_manager_emails.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from uuid import UUID, uuid4

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
from security.field_crypto import pii_lookup  # noqa: E402

_ = (OrgCompany, OrgBranch)

DATA_PATH = Path(__file__).resolve().parent / "data" / "employee_manager_email_rows.json"

MANAGER_ALIASES = {
    "adhyuth": "adhyuth ramadyani",
    "navneet": "navneet kumar",
    "ombir": "ombir",
    "omblr": "ombir",
    "omvir": "ombir",
    "kapil choudhary": "kapil chaudhary",
    "kapil chaudhary": "kapil chaudhary",
    "vinod julyani": "vinod pulyani",
    "vinod pulyani": "vinod pulyani",
    "mrityunjay anand": "mritunjay kumar anand",
    "mritunjay anand": "mritunjay kumar anand",
    "sachin singh": "sachin singh panwar",
    "arun kumar": "arun kumar",
    "dewesh pathak": "dewesh pathak",
    "vishakha": "vishakha joshi",
    "meenakshi singh": "meenakshi",
    "manohar singh": "manohar singh almia",
    "dinesh maheshwari": "dinesh",
    "rajnikant": "rajanikant",
    "rajenikant": "rajanikant",
    "rajanikant": "rajanikant",
}


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower().replace(".", " ")).strip()


def _is_email(v: str) -> bool:
    v = (v or "").strip().lower()
    return bool(v) and "@" in v and " " not in v and not v.endswith("@import.cache.local")


def _code_candidates(employee_id: str, new_code: str) -> list[str]:
    out: list[str] = []
    for raw in (employee_id, new_code):
        c = str(raw or "").strip().upper()
        if not c:
            continue
        out.append(c)
        if c.startswith("CTS") and c[3:].isdigit():
            n = c[3:]
            out.append(f"CT{n}")
            out.append(f"CT5{n}")
            out.append(f"CDPL5{n}")
            out.append(f"CDPL{n}")
        if c.startswith("CCPL") and c[4:].isdigit():
            out.append(f"CT{c[4:]}")
        if c.startswith("CDPL") and c[4:].isdigit():
            out.append(f"CT{c[4:]}")
            out.append(f"VPL{c[4:]}")
        if c.startswith("CT") and c[2:].isdigit():
            out.append(f"VPL{c[2:]}")
            out.append(f"CDPL{c[2:]}")
    # de-dupe preserve order
    seen: set[str] = set()
    uniq: list[str] = []
    for c in out:
        if c not in seen:
            seen.add(c)
            uniq.append(c)
    return uniq


def _full_name(emp: MasterEmployee) -> str:
    return _norm(f"{emp.first_name or ''} {emp.last_name or ''}")


def _resolve_manager(name: str, by_name: list[tuple[str, UUID]], by_code: dict[str, UUID]) -> UUID | None:
    raw = (name or "").strip()
    if not raw:
        return None
    needle = _norm(raw)
    if needle in {"na", "n/a", "n.a", "-", "none", "nil", "null", "pending"}:
        return None
    needle = MANAGER_ALIASES.get(needle, needle)
    code = raw.upper()
    if code in by_code:
        return by_code[code]
    # exact / contains
    for full, eid in by_name:
        if needle == full or needle in full or full in needle:
            return eid
    parts = needle.split()
    if len(parts) >= 2:
        for full, eid in by_name:
            fp = full.split()
            if len(fp) >= 2 and parts[0] == fp[0] and parts[-1] == fp[-1]:
                return eid
    if len(parts) == 1:
        hits = [(full, eid) for full, eid in by_name if parts[0] in full.split() or full.startswith(parts[0])]
        if len(hits) == 1:
            return hits[0][1]
    return None


def _merge_skills_fields(
    skills_json: object | None,
    *,
    personal_email: str = "",
    reporting_manager_name: str = "",
) -> dict:
    if isinstance(skills_json, dict):
        base = dict(skills_json)
    elif isinstance(skills_json, list):
        base = {"items": skills_json}
    else:
        base = {}
    if personal_email:
        base["personal_email"] = personal_email
    if reporting_manager_name:
        base["reporting_manager_name"] = reporting_manager_name
    return base


def main() -> None:
    rows = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    db = SessionLocal()
    try:
        employees = list(
            db.scalars(
                select(MasterEmployee).where(MasterEmployee.is_deleted.is_(False))
            ).all()
        )
        by_code: dict[str, MasterEmployee] = {}
        for e in employees:
            by_code[str(e.employee_code or "").strip().upper()] = e

        by_name = [(_full_name(e), e.id) for e in employees]
        code_to_id = {c: e.id for c, e in by_code.items()}

        profiles = {
            p.employee_id: p
            for p in db.scalars(
                select(HrEmployeeProfile).where(HrEmployeeProfile.is_deleted.is_(False))
            ).all()
        }

        found = 0
        missing = 0
        mgr_set = 0
        email_set = 0
        personal_set = 0
        mgr_miss: list[str] = []
        missing_codes: list[str] = []

        for row in rows:
            emp = None
            for cand in _code_candidates(row.get("employee_id", ""), row.get("new_code", "")):
                emp = by_code.get(cand)
                if emp is not None:
                    break
            if emp is None:
                missing += 1
                missing_codes.append(str(row.get("employee_id") or ""))
                continue
            found += 1

            official = str(row.get("official_email") or "").strip().lower()
            personal = str(row.get("personal_email") or "").strip().lower()
            if personal and not _is_email(personal):
                personal = ""
            if official and not _is_email(official):
                official = ""

            # Prefer cache/work email as master.email; else keep personal if master is placeholder.
            current = str(emp.email or "")
            target_official = official or (
                personal if "@import.cache.local" in current.lower() or not current else ""
            )
            if target_official and target_official.lower() != current.lower():
                # Avoid unique collision within company
                key = pii_lookup(target_official)
                clash = next(
                    (
                        o
                        for o in employees
                        if o.id != emp.id
                        and o.company_id == emp.company_id
                        and str(getattr(o, "email_lookup", "") or "") == key
                    ),
                    None,
                )
                if clash is None:
                    emp.email = target_official
                    email_set += 1
                else:
                    # keep existing; still store personal if useful
                    pass

            mgr_name = str(row.get("reporting_manager") or "").strip()
            mgr_id = _resolve_manager(mgr_name, by_name, code_to_id)
            if mgr_name and mgr_id is None:
                mgr_miss.append(f"{emp.employee_code}:{mgr_name}")
            if mgr_id and emp.reporting_manager_id != mgr_id and mgr_id != emp.id:
                emp.reporting_manager_id = mgr_id
                mgr_set += 1
                mgr_emp = db.get(MasterEmployee, mgr_id)
                if mgr_emp is not None:
                    mgr_emp.is_manager = True

            # Persist personal email + unresolved manager label on profile skills_json
            # so the employee list can hydrate them.
            need_skills = bool(personal) or (bool(mgr_name) and mgr_id is None)
            if need_skills:
                profile = profiles.get(emp.id)
                skills = profile.skills_json if profile and isinstance(profile.skills_json, dict) else {}
                mgr_label = mgr_name if mgr_id is None and mgr_name else ""
                changed = False
                if personal and str(skills.get("personal_email") or "").lower() != personal:
                    changed = True
                if mgr_label and str(skills.get("reporting_manager_name") or "") != mgr_label:
                    changed = True
                if profile is None:
                    if emp.branch_id and emp.company_id:
                        payload = _merge_skills_fields(
                            None,
                            personal_email=personal,
                            reporting_manager_name=mgr_label,
                        )
                        profile = HrEmployeeProfile(
                            id=uuid4(),
                            tenant_id=emp.tenant_id,
                            company_id=emp.company_id,
                            branch_id=emp.branch_id,
                            employee_id=emp.id,
                            skills_json=payload,
                            status="active",
                        )
                        db.add(profile)
                        profiles[emp.id] = profile
                        if personal:
                            personal_set += 1
                elif changed:
                    profile.skills_json = _merge_skills_fields(
                        profile.skills_json,
                        personal_email=personal,
                        reporting_manager_name=mgr_label,
                    )
                    flag_modified(profile, "skills_json")
                    profile.updated_at = hr_utcnow()
                    profile.version = int(profile.version or 1) + 1
                    if personal:
                        personal_set += 1

        db.commit()
        print(f"rows={len(rows)}")
        print(f"found={found}")
        print(f"missing={missing}")
        print(f"managers_set={mgr_set}")
        print(f"official_emails_set={email_set}")
        print(f"personal_emails_set={personal_set}")
        if missing_codes:
            uniq_miss = sorted({c for c in missing_codes if c})
            print("missing_codes=" + ", ".join(uniq_miss[:40]))
            if len(uniq_miss) > 40:
                print(f"... +{len(uniq_miss) - 40} more")
        uniq_mgr_miss = sorted(set(mgr_miss))
        print(f"unresolved_managers={len(uniq_mgr_miss)}")
        if uniq_mgr_miss:
            print("unresolved_samples=" + " | ".join(uniq_mgr_miss[:25]))
        print("done")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
