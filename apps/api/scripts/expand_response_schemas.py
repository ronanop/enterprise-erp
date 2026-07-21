"""Expand stub *Response Pydantic schemas from SQLAlchemy ORM columns."""

from __future__ import annotations

import importlib
import pkgutil
import re
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID

ROOT = Path(__file__).resolve().parents[1]
MODULES = ROOT / "src" / "modules"

orm_classes: dict[str, type] = {}


def load_models() -> None:
    import modules

    for modinfo in pkgutil.walk_packages(modules.__path__, modules.__name__ + "."):
        if ".models" not in modinfo.name:
            continue
        try:
            m = importlib.import_module(modinfo.name)
        except Exception:
            continue
        for attr in dir(m):
            obj = getattr(m, attr)
            if isinstance(obj, type) and hasattr(obj, "__tablename__") and hasattr(obj, "__table__"):
                orm_classes[attr] = obj


def find_orm(response_name: str):
    base = response_name.replace("Response", "")
    prefixes = [
        "",
        "Hr",
        "Ast",
        "Prj",
        "Pay",
        "Hd",
        "Rec",
        "Svc",
        "Doc",
        "Grc",
        "Bi",
        "Int",
        "Ec",
        "Pt",
        "Mfg",
        "Qm",
        "Crm",
        "Inv",
        "Proc",
        "Sales",
        "Fin",
        "Master",
        "Org",
        "Sec",
    ]
    for p in prefixes:
        c = f"{p}{base}"
        if c in orm_classes:
            return orm_classes[c]
    low = base.lower()
    for name, cls in orm_classes.items():
        compact = name.lower().replace("_", "")
        if compact.endswith(low.lower()) or low.lower() in compact:
            return cls
    return None


PY_TYPE_MAP = {
    PGUUID: "UUID",
    String: "str",
    Text: "str",
    Integer: "int",
    BigInteger: "int",
    SmallInteger: "int",
    Boolean: "bool",
    Date: "date",
    DateTime: "datetime",
    Time: "time",
    Numeric: "Decimal",
    Float: "float",
    JSONB: "dict",
}

SKIP_COLS = {
    "tenant_id",
    "is_deleted",
    "deleted_at",
    "deleted_by",
    "created_at",
    "created_by",
    "updated_at",
    "updated_by",
}


def col_py_type(col) -> str:
    t = col.type
    base = None
    for sa_t, py in PY_TYPE_MAP.items():
        if isinstance(t, sa_t):
            base = py
            break
    if base is None:
        try:
            pt = t.python_type
            mapping = {
                UUID: "UUID",
                str: "str",
                int: "int",
                bool: "bool",
                float: "float",
                Decimal: "Decimal",
                date: "date",
                datetime: "datetime",
                time: "time",
                dict: "dict",
                list: "list",
            }
            base = mapping.get(pt, "str")
        except Exception:
            base = "str"
    if col.nullable:
        return f"{base} | None"
    return base


def fields_for(cls):
    return [(col.name, col_py_type(col)) for col in cls.__table__.columns if col.name not in SKIP_COLS]


def ensure_imports(text: str, needed: set[str]) -> str:
    if "Decimal" in needed and "from decimal import Decimal" not in text:
        text = text.replace("from uuid import UUID", "from decimal import Decimal\nfrom uuid import UUID", 1)
    dt_needed = [x for x in ("date", "datetime", "time") if x in needed]
    if not dt_needed:
        return text
    m = re.search(r"from datetime import ([^\n]+)", text)
    if m:
        parts = [p.strip() for p in m.group(1).split(",")]
        for x in dt_needed:
            if x not in parts:
                parts.append(x)
        text = text[: m.start()] + f"from datetime import {', '.join(parts)}" + text[m.end() :]
    else:
        text = text.replace(
            "from uuid import UUID",
            f"from datetime import {', '.join(dt_needed)}\nfrom uuid import UUID",
            1,
        )
    return text


def main() -> None:
    load_models()
    print(f"ORM classes loaded: {len(orm_classes)}")
    expanded = 0
    for sf in sorted(MODULES.glob("*/schemas.py")):
        text = sf.read_text(encoding="utf-8")
        pattern = re.compile(r"class (\w+Response)\(OrmModel\):\n((?:    .+\n)+)", re.MULTILINE)
        matches = list(pattern.finditer(text))
        if not matches:
            continue
        new_text = text
        file_changed = False
        needed: set[str] = set()
        for m in matches:
            cname = m.group(1)
            body = m.group(2)
            field_lines = [ln for ln in body.splitlines() if ":" in ln and not ln.strip().startswith("#")]
            if len(field_lines) > 8:
                continue
            if "id:" not in body:
                continue
            orm = find_orm(cname)
            if orm is None:
                print(f"NO ORM for {sf.parent.name}.{cname}")
                continue
            fields = fields_for(orm)
            if len(fields) <= len(field_lines):
                continue
            lines = [f"class {cname}(OrmModel):"]
            for fname, ftype in fields:
                lines.append(f"    {fname}: {ftype}")
                if "Decimal" in ftype:
                    needed.add("Decimal")
                if "datetime" in ftype:
                    needed.add("datetime")
                elif re.search(r"\bdate\b", ftype):
                    needed.add("date")
                if re.search(r"\btime\b", ftype) and "datetime" not in ftype:
                    needed.add("time")
            new_block = "\n".join(lines) + "\n"
            old_block = m.group(0)
            if old_block != new_block:
                new_text = new_text.replace(old_block, new_block, 1)
                file_changed = True
                expanded += 1
                print(f"EXPAND {sf.parent.name}.{cname} <- {orm.__name__} ({len(fields)} fields)")
        if file_changed:
            new_text = ensure_imports(new_text, needed)
            sf.write_text(new_text, encoding="utf-8")
    print(f"Expanded responses: {expanded}")


if __name__ == "__main__":
    main()
