"""Seed H-Cloud 26-27 tracker rows into Projects PO Queue only (test data).

Creates one PO Queue seed handoff per unique (Project, Circle, Site) from the
Excel sheet so you can click Create Project yourself. Soft-deletes any prior
H-Cloud draft projects created by an earlier mistaken seed.

Does NOT create Procurement / SCM / PO / GRN records.

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.seed_hcloud_projects
  .venv\\Scripts\\python.exe -m scripts.seed_hcloud_projects --xlsx \"C:\\Users\\moksh\\Downloads\\H cloud 26-27.xlsx\"
  .venv\\Scripts\\python.exe -m scripts.seed_hcloud_projects --cleanup
  .venv\\Scripts\\python.exe -m scripts.seed_hcloud_projects --limit 10
"""

from __future__ import annotations

import argparse
import re
import sys
import zipfile
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4
from xml.etree import ElementTree as ET

from sqlalchemy import select
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.domain.value_objects import TenantContext  # noqa: E402
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.project.domain.enums import SiteDeliveryType  # noqa: E402
from modules.project.models.po_queue_handoff import PrjPoQueueHandoff  # noqa: E402
from modules.project.models.project import PrjProject  # noqa: E402
from modules.project.models.site_installation import PrjSiteInstallation  # noqa: E402
from modules.project.repository.po_queue_handoff_repository import (  # noqa: E402
    PoQueueHandoffRepository,
)
# Register procurement metadata so soft-deleting PrjProject resolves proc_order_id FK.
from modules.procurement.models.order import ProcOrderHeader as _ProcOrderHeader  # noqa: E402, F401

MARKER = "[SEED:H-CLOUD-26-27]"
DEFAULT_XLSX = Path(r"C:\Users\moksh\Downloads\H cloud 26-27.xlsx")
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

RACK_TYPES = frozenset(
    {
        "rack",
        "rack services",
        "pdu",
        "22kw 3-ph pdu",
    }
)
SERVER_TYPES = frozenset(
    {
        "sfc1",
        "sfs1",
        "sfk1",
        "sfs2",
        "3.84 tb",
    }
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def require(row, label: str):
    if row is None:
        raise SystemExit(f"{label} not found. Run seed_demo_data first if needed.")
    return row


def _active(stmt, model):
    return stmt.where(model.is_deleted.is_(False))


def ctx_for(user: SecUser, company_id: UUID, branch_id: UUID) -> TenantContext:
    return TenantContext(
        tenant_id=user.tenant_id,
        user_id=user.id,
        user_type=user.user_type or "internal",
        company_id=company_id,
        branch_id=branch_id,
    )


def resolve_scope(db: Session) -> tuple[SecTenant, OrgCompany, OrgBranch, SecUser, UUID]:
    tenant = require(
        db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP")),
        "BOOTSTRAP tenant",
    )
    company = db.scalar(
        _active(select(OrgCompany), OrgCompany).where(
            OrgCompany.tenant_id == tenant.id,
            OrgCompany.company_code == "CDPL",
        )
    )
    if company is None:
        company = db.scalar(
            _active(select(OrgCompany), OrgCompany)
            .where(OrgCompany.tenant_id == tenant.id)
            .order_by(OrgCompany.company_code)
        )
    company = require(company, "Org company")

    branch = db.scalar(
        _active(select(OrgBranch), OrgBranch).where(
            OrgBranch.company_id == company.id,
            OrgBranch.branch_code == "HQ",
        )
    )
    if branch is None:
        branch = db.scalar(
            _active(select(OrgBranch), OrgBranch)
            .where(OrgBranch.company_id == company.id)
            .order_by(OrgBranch.branch_code)
        )
    branch = require(branch, "Org branch")

    admin = db.scalar(
        _active(select(SecUser), SecUser).where(
            SecUser.email == "connectplus@cachedigitech.com"
        )
    )
    if admin is None:
        admin = db.scalar(
            _active(select(SecUser), SecUser).where(
                SecUser.email == "techbank@cachedigitech.com"
            )
        )
    if admin is None:
        admin = db.scalar(
            _active(select(SecUser), SecUser).where(
                SecUser.user_type.in_(("super_admin", "tenant_admin"))
            )
        )
    admin = require(admin, "Projects-capable admin user (connectplus@…)")

    existing = db.scalar(
        _active(select(PrjProject), PrjProject).where(PrjProject.company_id == company.id)
    )
    if existing is not None:
        pm_id = existing.project_manager_employee_id
    else:
        emp = db.scalar(
            _active(select(MasterEmployee), MasterEmployee).where(
                MasterEmployee.company_id == company.id
            )
        )
        emp = require(emp, "Master employee for PM")
        pm_id = emp.id

    return tenant, company, branch, admin, pm_id


def _col_letter_to_index(cell_ref: str) -> int:
    letters = re.match(r"^([A-Z]+)", cell_ref)
    if not letters:
        return 0
    n = 0
    for ch in letters.group(1):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def _shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    out: list[str] = []
    for si in root.findall("m:si", NS):
        texts = [t.text or "" for t in si.findall(".//m:t", NS)]
        out.append("".join(texts))
    return out


def _sheet_path(zf: zipfile.ZipFile, wanted: str | None) -> str:
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    sheets = []
    for sh in wb.findall("m:sheets/m:sheet", NS):
        sheets.append((sh.attrib.get("name", ""), sh.attrib.get(
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id",
            "",
        )))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rid_to_target = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall(
            "{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"
        )
    }
    if not sheets:
        raise SystemExit("Workbook has no sheets")
    pick = sheets[0]
    if wanted:
        for name, rid in sheets:
            if name.strip().lower() == wanted.strip().lower():
                pick = (name, rid)
                break
    target = rid_to_target.get(pick[1], "")
    if not target:
        raise SystemExit(f"Could not resolve sheet path for {pick[0]!r}")
    if not target.startswith("xl/"):
        target = f"xl/{target.lstrip('/')}"
    return target


def _cell_value(cell: ET.Element, shared: list[str]):
    ref = cell.attrib.get("r", "")
    ctype = cell.attrib.get("t")
    v = cell.find("m:v", NS)
    if v is None or v.text is None:
        return _col_letter_to_index(ref), None
    raw = v.text
    if ctype == "s":
        try:
            return _col_letter_to_index(ref), shared[int(raw)]
        except (ValueError, IndexError):
            return _col_letter_to_index(ref), raw
    if ctype == "b":
        return _col_letter_to_index(ref), raw == "1"
    try:
        if "." in raw:
            return _col_letter_to_index(ref), float(raw)
        return _col_letter_to_index(ref), int(raw)
    except ValueError:
        return _col_letter_to_index(ref), raw


def read_hcloud_rows(xlsx_path: Path) -> list[dict[str, object]]:
    if not xlsx_path.is_file():
        raise SystemExit(f"Excel file not found: {xlsx_path}")

    with zipfile.ZipFile(xlsx_path) as zf:
        shared = _shared_strings(zf)
        sheet_xml = zf.read(_sheet_path(zf, "H-Cloud"))
    root = ET.fromstring(sheet_xml)

    grid: dict[int, dict[int, object]] = {}
    for row in root.findall("m:sheetData/m:row", NS):
        ridx = int(row.attrib.get("r", "0"))
        cells: dict[int, object] = {}
        for cell in row.findall("m:c", NS):
            cidx, val = _cell_value(cell, shared)
            cells[cidx] = val
        if cells:
            grid[ridx] = cells

    if 1 not in grid:
        raise SystemExit("Sheet has no header row")

    headers = {
        (str(v).strip().lower() if v is not None else f"col{i}"): i
        for i, v in sorted(grid[1].items())
    }

    def col(*names: str) -> int | None:
        for name in names:
            if name in headers:
                return headers[name]
        return None

    i_project = col("project")
    i_circle = col("circle", "hr (pb)")
    # header may have trailing space / alternate labels
    if i_circle is None:
        for key, idx in headers.items():
            if key.startswith("hr") or key.startswith("circle"):
                i_circle = idx
                break
    i_site = col("site")
    i_cloud = col("cloud")
    i_application = col("application")
    i_type = col("type")
    i_item = col("item code", "item_code")
    i_qty = col("qty", "quantity")
    i_po = col("po")
    i_po_date = col("po date", "po_date")

    if i_project is None or i_site is None:
        raise SystemExit(f"Required columns missing. Found headers: {sorted(headers)}")

    rows: list[dict[str, object]] = []
    for ridx in sorted(k for k in grid if k > 1):
        cells = grid[ridx]

        def get(idx: int | None) -> object | None:
            if idx is None:
                return None
            return cells.get(idx)

        project = str(get(i_project) or "").strip()
        site = str(get(i_site) or "").strip()
        if not project and not site:
            continue
        rows.append(
            {
                "project": project or "H-Cloud",
                "circle": str(get(i_circle) or "").strip(),
                "site": site,
                "cloud": str(get(i_cloud) or "").strip() or None,
                "application": str(get(i_application) or "").strip() or None,
                "type": str(get(i_type) or "").strip(),
                "item_code": str(get(i_item) or "").strip() or None,
                "qty": get(i_qty),
                "po": str(get(i_po) or "").strip() or None,
                "po_date": get(i_po_date),
            }
        )
    return rows


def _as_int(value: object) -> int:
    if value is None or value == "":
        return 0
    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return 0


def _type_bucket(type_name: str) -> str:
    key = type_name.strip().lower()
    if key in RACK_TYPES or "rack" in key or "pdu" in key:
        return "rack"
    if key in SERVER_TYPES or key.startswith("sf") or "tb" in key:
        return "server"
    return "other"


def aggregate_sites(raw_rows: list[dict[str, object]]) -> list[dict]:
    groups: dict[tuple[str, str, str], dict] = {}
    for row in raw_rows:
        wave = str(row["project"]).strip()
        circle = str(row["circle"]).strip()
        site = str(row["site"]).strip()
        if not site:
            continue
        key = (wave, circle, site)
        bucket = groups.get(key)
        if bucket is None:
            bucket = {
                "wave": wave,
                "circle": circle,
                "site": site,
                "clouds": set(),
                "applications": set(),
                "types": set(),
                "rack_qty": 0,
                "server_qty": 0,
                "other_qty": 0,
                "pos": set(),
                "lines": [],
            }
            groups[key] = bucket

        qty = _as_int(row.get("qty"))
        typ = str(row.get("type") or "").strip()
        kind = _type_bucket(typ)
        if kind == "rack":
            bucket["rack_qty"] += qty
        elif kind == "server":
            bucket["server_qty"] += qty
        else:
            bucket["other_qty"] += qty

        if row.get("cloud"):
            bucket["clouds"].add(str(row["cloud"]).strip())
        if row.get("application"):
            bucket["applications"].add(str(row["application"]).strip())
        if typ:
            bucket["types"].add(typ)
        if row.get("po"):
            bucket["pos"].add(str(row["po"]).strip())

        line_bits = [
            typ or "-",
            str(qty),
            str(row.get("item_code") or "-"),
            str(row.get("po") or "-"),
        ]
        bucket["lines"].append(" | ".join(line_bits))

    out: list[dict] = []
    for bucket in groups.values():
        rack_qty = int(bucket["rack_qty"])
        server_qty = int(bucket["server_qty"])
        if server_qty > 0 and rack_qty > 0:
            delivery = SiteDeliveryType.SERVER_OS_RACK.value
        elif rack_qty > 0 and server_qty == 0:
            delivery = SiteDeliveryType.RACK_ONLY.value
        elif server_qty > 0:
            delivery = SiteDeliveryType.SERVER_OS.value
        else:
            delivery = SiteDeliveryType.SERVER_OS_RACK.value

        clouds = sorted(bucket["clouds"])
        apps = sorted(bucket["applications"])
        types = sorted(bucket["types"])
        pos = sorted(bucket["pos"])
        lines = bucket["lines"]

        application = apps[0] if apps else (types[0] if types else None)
        if application and len(application) > 255:
            application = application[:255]

        remarks_parts = [
            MARKER,
            f"Wave: {bucket['wave']}",
            f"Types: {', '.join(types) or '-'}",
            f"POs: {', '.join(pos) or '-'}",
            "Lines (Type | Qty | Item | PO):",
            *lines[:80],
        ]
        if len(lines) > 80:
            remarks_parts.append(f"... +{len(lines) - 80} more lines")

        out.append(
            {
                "wave": bucket["wave"],
                "circle": bucket["circle"] or None,
                "site": bucket["site"],
                "cloud_name": clouds[0] if len(clouds) == 1 else (" | ".join(clouds)[:255] if clouds else None),
                "application": application,
                "delivery_type": delivery,
                "rack_qty": rack_qty or None,
                "server_qty": server_qty or None,
                "customer_po_hint": pos[0] if pos else None,
                "remarks": "\n".join(remarks_parts)[:8000],
                "project_name": f"{bucket['wave']} - {bucket['site']}"[:255],
                "description": (
                    f"{MARKER} H-Cloud seed · {bucket['wave']} · {bucket['circle'] or '-'} · "
                    f"{bucket['site']}"
                    + (f" · PO {pos[0]}" if pos else "")
                )[:2000],
            }
        )

    out.sort(key=lambda r: (r["wave"], r["circle"] or "", r["site"]))
    return out


def list_seeded_projects(db: Session, company_id: UUID) -> list[PrjProject]:
    return list(
        db.scalars(
            _active(select(PrjProject), PrjProject).where(
                PrjProject.company_id == company_id,
                PrjProject.description.ilike(f"%{MARKER}%"),
            )
        ).all()
    )


def list_seeded_handoffs(db: Session, company_id: UUID) -> list[PrjPoQueueHandoff]:
    return list(
        db.scalars(
            _active(select(PrjPoQueueHandoff), PrjPoQueueHandoff).where(
                PrjPoQueueHandoff.company_id == company_id,
                PrjPoQueueHandoff.is_seed.is_(True),
                PrjPoQueueHandoff.seed_marker == MARKER,
            )
        ).all()
    )


def cleanup(db: Session, company_id: UUID, admin_id: UUID) -> tuple[int, int]:
    """Soft-delete prior H-Cloud draft projects and seed PO queue rows."""
    now = utcnow()
    project_count = 0
    for project in list_seeded_projects(db, company_id):
        sites = list(
            db.scalars(
                _active(select(PrjSiteInstallation), PrjSiteInstallation).where(
                    PrjSiteInstallation.project_id == project.id
                )
            ).all()
        )
        for site in sites:
            site.is_deleted = True
            site.deleted_at = now
            site.deleted_by = admin_id
            site.updated_at = now
            site.updated_by = admin_id
            site.document_number = f"{site.document_number}~{uuid4().hex[:6]}"[:50]

        project.is_deleted = True
        project.deleted_at = now
        project.deleted_by = admin_id
        project.updated_at = now
        project.updated_by = admin_id
        project.project_code = f"{project.project_code}~{uuid4().hex[:6]}"[:50]
        project_count += 1

    handoff_count = 0
    for handoff in list_seeded_handoffs(db, company_id):
        handoff.is_deleted = True
        handoff.deleted_at = now
        handoff.deleted_by = admin_id
        handoff.updated_at = now
        handoff.updated_by = admin_id
        handoff_count += 1

    db.commit()
    return project_count, handoff_count


def handoff_already_seeded(
    db: Session,
    company_id: UUID,
    *,
    site_name: str,
    circle: str | None,
    wave: str,
) -> bool:
    rows = list_seeded_handoffs(db, company_id)
    for row in rows:
        if (row.site_name or "") != site_name:
            continue
        if (row.circle_name or "") != (circle or ""):
            continue
        name = row.project_name or ""
        remarks = row.remarks or ""
        if wave and wave not in name and wave not in remarks:
            continue
        return True
    return False


def seed(
    db: Session,
    *,
    xlsx_path: Path,
    limit: int | None,
    dry_run: bool,
    move_from_projects: bool,
) -> None:
    tenant, company, branch, admin, _pm_id = resolve_scope(db)
    ctx = ctx_for(admin, company.id, branch.id)
    raw = read_hcloud_rows(xlsx_path)
    sites = aggregate_sites(raw)
    if limit is not None:
        sites = sites[: max(0, limit)]

    print(f"Tenant   : {tenant.tenant_code}")
    print(f"Company  : {company.company_code} / {company.company_name}")
    print(f"Branch   : {branch.branch_code} / {branch.branch_name}")
    print(f"Admin    : {admin.email}")
    print(f"Excel    : {xlsx_path}")
    print(f"Raw rows : {len(raw)}")
    print(f"Sites    : {len(sites)} (one PO queue row each)")

    if move_from_projects and not dry_run:
        removed_projects, removed_handoffs = cleanup(db, company.id, admin.id)
        print(
            f"Moved    : soft-deleted {removed_projects} draft project(s), "
            f"{removed_handoffs} prior seed queue row(s)"
        )

    if dry_run:
        for s in sites[:15]:
            print(
                f"  DRY  {s['project_name']} | circle={s['circle']} | "
                f"rack={s['rack_qty']} server={s['server_qty']} | PO={s['customer_po_hint']}"
            )
        if len(sites) > 15:
            print(f"  ... +{len(sites) - 15} more")
        return

    handoffs = PoQueueHandoffRepository(db)
    created = 0
    skipped = 0
    shared_at = utcnow()
    for item in sites:
        if handoff_already_seeded(
            db,
            company.id,
            site_name=item["site"],
            circle=item["circle"],
            wave=item["wave"],
        ):
            skipped += 1
            continue

        po_date = None
        # Prefer first PO number from notes if present
        customer_po = item.get("customer_po_hint")
        handoffs.upsert(
            ctx,
            proc_order_id=None,
            company_id=company.id,
            branch_id=branch.id,
            is_seed=True,
            seed_marker=MARKER,
            shared_at=shared_at,
            project_name=item["project_name"],
            circle_name=item["circle"],
            site_name=item["site"],
            contact_person="H-Cloud Seed",
            contact_number="0000000000",
            rack_quantity=str(item["rack_qty"] or 0),
            server_quantity=str(item["server_qty"] or 0),
            server_type=(item["application"] or "H-Cloud")[:255],
            remarks=item["remarks"],
            customer_po_number=customer_po,
            company_po_number=None,
            document_date=date.today() if not po_date else po_date,
            customer_name="Airtel",
        )
        created += 1
        if created % 20 == 0:
            db.commit()
            print(f"  … queued {created}")

    db.commit()
    print(f"Queued   : {created} PO queue seed row(s)")
    print(f"Skipped  : {skipped} (already in queue)")
    print("Note     : No SCM / Procurement rows. Open Projects > PO Queue > Create Project.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed H-Cloud sheet into Projects PO Queue (no SCM)"
    )
    parser.add_argument(
        "--xlsx",
        type=Path,
        default=DEFAULT_XLSX,
        help="Path to H cloud 26-27.xlsx",
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Soft-delete prior H-Cloud draft projects and seed queue rows",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only seed first N unique sites",
    )
    parser.add_argument("--dry-run", action="store_true", help="Parse and print plan only")
    parser.add_argument(
        "--keep-projects",
        action="store_true",
        help="Do not soft-delete previously seeded draft projects before queueing",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.cleanup:
            _, company, _, admin, _ = resolve_scope(db)
            projects, handoffs = cleanup(db, company.id, admin.id)
            print(
                f"Soft-deleted {projects} project(s) and {handoffs} PO queue seed row(s)."
            )
            return
        seed(
            db,
            xlsx_path=args.xlsx,
            limit=args.limit,
            dry_run=args.dry_run,
            move_from_projects=not args.keep_projects,
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
