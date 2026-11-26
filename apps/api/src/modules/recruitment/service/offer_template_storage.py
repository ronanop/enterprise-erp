"""Offer letter templates stored in MinIO (or local var fallback)."""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from core.blob_store import FILE_URI_PREFIX, load_bytes, store_bytes
from core import object_storage
from core.exceptions import AppException, NotFoundException, ValidationException
from modules.foundation.domain.value_objects import TenantContext


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _index_key(tenant_id: UUID) -> str:
    return object_storage.module_key("recruitment", "offer-templates", str(tenant_id), "index.json")


def _index_file_uri(tenant_id: UUID) -> str:
    return f"{FILE_URI_PREFIX}recruitment/offer-templates/{tenant_id}/index.json"


def _load_index(tenant_id: UUID) -> list[dict[str, Any]]:
    uris = []
    if object_storage.is_enabled():
        uris.append(object_storage.to_uri(_index_key(tenant_id)))
    uris.append(_index_file_uri(tenant_id))
    for uri in uris:
        try:
            raw, _ = load_bytes(uri)
            data = json.loads(raw.decode("utf-8"))
            if isinstance(data, list):
                return [r for r in data if isinstance(r, dict)]
        except FileNotFoundError:
            continue
        except Exception:  # noqa: BLE001
            continue
    return []


def _save_index(tenant_id: UUID, rows: list[dict[str, Any]]) -> None:
    payload = json.dumps(rows, ensure_ascii=False).encode("utf-8")
    store_bytes(
        module="recruitment",
        category="offer-templates",
        owner_id=str(tenant_id),
        file_name="index.json",
        data=payload,
        content_type="application/json",
        stable_name=True,
    )


def _decode_data_url(data_url: str) -> tuple[bytes, str]:
    value = (data_url or "").strip()
    if not value.startswith("data:"):
        raise ValidationException("PDF letterhead must be a data URL")
    comma = value.find(",")
    if comma < 0:
        raise ValidationException("Invalid PDF data URL")
    header = value[:comma]
    payload = value[comma + 1 :]
    try:
        raw = base64.b64decode(payload, validate=False)
    except Exception as exc:  # noqa: BLE001
        raise ValidationException("Could not decode PDF") from exc
    if not raw:
        raise ValidationException("Empty PDF")
    if len(raw) > 8 * 1024 * 1024:
        raise ValidationException("PDF must be 8 MB or smaller")
    mime = "application/pdf"
    if ":" in header:
        mime = header.split(":", 1)[1].split(";", 1)[0].strip() or mime
    return raw, mime


def list_templates(ctx: TenantContext) -> list[dict[str, Any]]:
    rows = _load_index(ctx.tenant_id)
    # Never return raw PDF bytes in list — frontend fetches pdf via download when needed
    out: list[dict[str, Any]] = []
    for row in sorted(rows, key=lambda r: str(r.get("updatedAt") or ""), reverse=True):
        out.append(
            {
                "id": row.get("id"),
                "name": row.get("name"),
                "description": row.get("description"),
                "pdfFileName": row.get("pdfFileName"),
                "pdfStorageUri": row.get("pdfStorageUri"),
                "bodyContent": row.get("bodyContent") or "",
                "createdAt": row.get("createdAt"),
                "updatedAt": row.get("updatedAt"),
                "pdfDataUrl": None,
            }
        )
    return out


def get_template(ctx: TenantContext, template_id: str, *, include_pdf: bool = True) -> dict[str, Any]:
    rows = _load_index(ctx.tenant_id)
    row = next((r for r in rows if str(r.get("id")) == template_id), None)
    if row is None:
        raise NotFoundException("Offer template not found")
    pdf_data_url = None
    if include_pdf and row.get("pdfStorageUri"):
        try:
            raw, name = load_bytes(str(row["pdfStorageUri"]))
            b64 = base64.b64encode(raw).decode("ascii")
            pdf_data_url = f"data:application/pdf;base64,{b64}"
            row = {**row, "pdfFileName": row.get("pdfFileName") or name}
        except FileNotFoundError as exc:
            raise AppException("Template PDF missing in storage", status_code=404) from exc
    return {
        "id": row.get("id"),
        "name": row.get("name"),
        "description": row.get("description"),
        "pdfFileName": row.get("pdfFileName"),
        "pdfStorageUri": row.get("pdfStorageUri"),
        "bodyContent": row.get("bodyContent") or "",
        "createdAt": row.get("createdAt"),
        "updatedAt": row.get("updatedAt"),
        "pdfDataUrl": pdf_data_url,
    }


def save_template(
    ctx: TenantContext,
    *,
    name: str,
    body_content: str,
    pdf_data_url: str,
    pdf_file_name: str | None = None,
    description: str | None = None,
    template_id: str | None = None,
) -> dict[str, Any]:
    clean_name = (name or "").strip() or "Untitled template"
    body = (body_content or "").strip()
    if not body:
        raise ValidationException("Add body content before saving")
    raw, mime = _decode_data_url(pdf_data_url)
    rows = _load_index(ctx.tenant_id)
    now = _utcnow()
    tid = (template_id or "").strip() or str(uuid4())
    pdf_uri = store_bytes(
        module="recruitment",
        category="offer-templates",
        owner_id=f"{ctx.tenant_id}/{tid}",
        file_name=pdf_file_name or "letterhead.pdf",
        data=raw,
        content_type=mime,
    )
    existing_idx = next((i for i, r in enumerate(rows) if str(r.get("id")) == tid), -1)
    created = rows[existing_idx].get("createdAt") if existing_idx >= 0 else now
    row = {
        "id": tid,
        "name": clean_name,
        "description": (description or "").strip() or None,
        "pdfFileName": pdf_file_name or "letterhead.pdf",
        "pdfStorageUri": pdf_uri,
        "bodyContent": body,
        "createdAt": created or now,
        "updatedAt": now,
    }
    if existing_idx >= 0:
        rows[existing_idx] = row
    else:
        rows.insert(0, row)
    _save_index(ctx.tenant_id, rows)
    return get_template(ctx, tid, include_pdf=True)


def delete_template(ctx: TenantContext, template_id: str) -> bool:
    rows = _load_index(ctx.tenant_id)
    next_rows = [r for r in rows if str(r.get("id")) != template_id]
    if len(next_rows) == len(rows):
        return False
    _save_index(ctx.tenant_id, next_rows)
    return True


def store_offer_pdf(
    *,
    tenant_id: UUID,
    offer_id: str,
    file_name: str,
    data: bytes,
    content_type: str = "application/pdf",
) -> str:
    return store_bytes(
        module="recruitment",
        category="offer-letters",
        owner_id=str(offer_id),
        company_id=str(tenant_id),
        file_name=file_name or "offer-letter.pdf",
        data=data,
        content_type=content_type,
    )
