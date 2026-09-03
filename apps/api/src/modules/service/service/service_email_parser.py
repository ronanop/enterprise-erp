"""Parse NOC / carrier service-request emails (Airtel-style) into ticket fields."""

from __future__ import annotations

import re
from typing import Any


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", value).strip(" \t\r\n:-")
    return text or None


def _label_value(body: str, *labels: str) -> str | None:
    for label in labels:
        pattern = rf"(?im)^\s*{re.escape(label)}\s*[:\-]?\s*(.+)$"
        match = re.search(pattern, body)
        if match:
            return _clean(match.group(1))
    return None


def _numbered_item(body: str, *prefixes: str) -> str | None:
    """Match lines like '1. Correct/actual LC contact: 7278…' or '7. Link Type: ILL'."""
    for prefix in prefixes:
        pattern = rf"(?im)^\s*\d+\.\s*{prefix}\s*[:\-]?\s*(.*)$"
        match = re.search(pattern, body)
        if match:
            return _clean(match.group(1))
        # Also allow without leading number
        pattern2 = rf"(?im)^\s*{prefix}\s*[:\-]?\s*(.+)$"
        match2 = re.search(pattern2, body)
        if match2:
            return _clean(match2.group(1))
    return None


def _extract_address_block(body: str) -> dict[str, str | None]:
    """Parse Address: line and following free-text address into street/city/state/pin."""
    result: dict[str, str | None] = {
        "end_customer_street": None,
        "end_customer_city": None,
        "end_customer_state": None,
        "end_customer_postal_code": None,
    }
    match = re.search(r"(?im)^\s*Address\s*[:\-]?\s*(.+)$", body)
    if not match:
        return result
    street = _clean(match.group(1))
    result["end_customer_street"] = street[:500] if street else None

    # Try PIN / postal
    pin = re.search(r"(?i)\bPIN\s*(\d{6})\b|\b(\d{6})\s*,?\s*(?:Kerala|India)?", street or "")
    if pin:
        result["end_customer_postal_code"] = pin.group(1) or pin.group(2)

    # City / state heuristics from common Indian address endings
    city = re.search(r"(?i)\b(Kochi|Ernakulam|Mumbai|Delhi|Chennai|Bengaluru|Hyderabad|Pune)\b", street or "")
    if city:
        result["end_customer_city"] = city.group(1)
    state = re.search(
        r"(?i)\b(Kerala|Maharashtra|Karnataka|Tamil Nadu|Delhi|Telangana|Gujarat|Rajasthan)\b",
        street or "",
    )
    if state:
        result["end_customer_state"] = state.group(1)
    return result


def _extract_cli_log(body: str) -> str | None:
    """Capture router CLI / ping blocks if present."""
    match = re.search(
        r"(?ms)(RP/\d[^\n]*#.*?)(?=\n\s*(?:Dear|Thanks|Regards|\Z))",
        body,
    )
    if match:
        return match.group(1).strip()[:8000]
    match2 = re.search(
        r"(?ms)((?:ping\s+vrf|Type escape sequence)[^\n]*(?:\n(?!\d+\.).*){2,})",
        body,
    )
    if match2:
        return match2.group(1).strip()[:8000]
    return None


KNOWN_LINE_MARKERS = (
    "sr no",
    "ckt id",
    "company name",
    "noc contact",
    "client name",
    "address",
    "correct/actual lc",
    "lc contact",
    "site availability",
    "request for snap",
    "complete ip",
    "fe details",
    "serial & model",
    "serial and model",
    "port (ethernet",
    "link type",
    "bandwidth",
    "number of port",
    "problem summary",
)


def parse_service_email_body(body: str, *, subject: str | None = None) -> dict[str, Any]:
    """
    Return ticket field kwargs parsed from a service email body.
    Unknown content is collected into mail_extra_info.
    """
    text = (body or "").replace("\r\n", "\n").replace("\r", "\n")
    fields: dict[str, Any] = {}

    sr = _label_value(text, "SR No", "SR NO", "SR Number", "Service Request No")
    if sr:
        fields["reference_sr_number"] = sr[:100]

    ckt = _label_value(text, "CKT ID", "Circuit ID", "Circuit Id")
    if ckt:
        fields["ckt_id"] = ckt[:100]
        fields["lsi"] = ckt[:100]

    company = _label_value(text, "Company Name", "Company")
    if company:
        fields["company_name_from_mail"] = company[:255]
        fields["customer_reference"] = company[:100]

    noc_name = _label_value(text, "NOC Contact Name", "NOC Contact")
    if noc_name and not re.search(r"\d{6,}", noc_name):
        fields["contact_name"] = noc_name[:255]

    noc_phone = _label_value(text, "NOC Contact Number", "NOC Number")
    if not noc_phone and noc_name and re.search(r"\d", noc_name):
        # Sometimes name+number on one line mishandled — prefer dedicated number line
        pass
    if noc_phone:
        fields["mobile"] = noc_phone[:50]

    client = _label_value(text, "Client Name", "End Customer", "Customer Name")
    if client:
        fields["end_customer_name"] = client[:255]

    fields.update({k: v for k, v in _extract_address_block(text).items() if v})

    lc = _numbered_item(text, r"Correct/?actual LC contact", "LC contact", "LC Contact")
    if lc:
        fields["coordinator_phone"] = lc[:50]
        fields["coordinator_name"] = fields.get("coordinator_name") or "LC Contact"

    site_avail = _numbered_item(text, "Site availability timing", "Site availability")
    if site_avail:
        fields["site_availability"] = site_avail[:255]

    photo = _numbered_item(text, "Request for snap", "snap of RTR", "Photos required")
    # Multi-line instructions after "Request for snap"
    photo_block = re.search(
        r"(?ims)^\s*\d+\.\s*Request for snap.*?(?=^\s*\d+\.\s|\Z)",
        text,
    )
    if photo_block:
        fields["site_instructions"] = _clean(photo_block.group(0).replace("\n", " "))[:4000]
    elif photo:
        fields["site_instructions"] = photo[:4000]

    ip_block = re.search(
        r"(?ims)^\s*\d+\.\s*Complete IP details.*?(?=^\s*\d+\.\s|\Z)",
        text,
    )
    if ip_block:
        fields["ip_details"] = _clean(ip_block.group(0))[:4000]

    prev_fe = _numbered_item(text, "FE details who visited", "FE details", "Previous FE")
    prev_fe_block = re.search(
        r"(?ims)^\s*\d+\.\s*FE details who visited.*?(?=^\s*\d+\.\s|\Z)",
        text,
    )
    if prev_fe_block:
        fields["previous_fe_notes"] = _clean(prev_fe_block.group(0))[:4000]
    elif prev_fe:
        fields["previous_fe_notes"] = prev_fe[:4000]

    model = _numbered_item(text, "Serial & Model number of RTR", "Serial & Model", "Serial and Model")
    if model:
        fields["asset_status"] = "existing_asset"
        sn_inline = re.search(
            r"(?i)(?:serial\s*(?:no\.?|number)?|s/?n)\s*[:=]?\s*([A-Za-z0-9\-_]+)",
            model,
        )
        if sn_inline:
            fields["serial_number"] = sn_inline.group(1)[:100]
            model_only = re.sub(
                r"(?i)(?:serial\s*(?:no\.?|number)?|s/?n)\s*[:=]?\s*[A-Za-z0-9\-_]+",
                "",
                model,
            ).strip(" /,-")
            fields["asset_name"] = (model_only or model)[:255]
        else:
            fields["asset_name"] = model[:255]

    # Airtel mails often put the device serial in "Port (Ethernet/serial)"
    port_or_serial = _numbered_item(text, r"Port \(Ethernet/serial\)", "Port (Ethernet/serial)", "Device Serial")
    if port_or_serial:
        compact = re.sub(r"\s+", "", port_or_serial)
        looks_like_serial = bool(re.fullmatch(r"[A-Za-z0-9\-_]{8,}", compact))
        port_words = {"ethernet", "serial", "eth", "gigabit", "gi", "ge", "sfp", "fiber", "fibre"}
        if looks_like_serial and compact.lower() not in port_words and not fields.get("serial_number"):
            fields["serial_number"] = compact[:100]
        elif not looks_like_serial and not fields.get("ports_in_use"):
            fields["ports_in_use"] = port_or_serial[:255]

    link_type = _numbered_item(text, "Link Type")
    if link_type:
        fields["link_type"] = link_type[:100]

    bandwidth = _numbered_item(text, "Bandwidth")
    if bandwidth:
        fields["bandwidth"] = bandwidth[:100]

    ports = _numbered_item(text, "Number of Port in Use", "Ports in Use", "Port in Use")
    if ports:
        fields["ports_in_use"] = ports[:255]

    problem = _numbered_item(text, "Problem summary", "Problem Summary", "Issue summary")
    cli = _extract_cli_log(text)
    if problem and cli:
        fields["issue_description"] = f"{problem}\n\n--- CLI / Ping log ---\n{cli}"[:8000]
        fields["additional_description"] = cli[:8000]
    elif problem:
        fields["issue_description"] = problem[:8000]
    elif cli:
        fields["issue_description"] = cli[:8000]
        fields["additional_description"] = cli[:8000]

    # Subject fallback
    if subject:
        fields.setdefault("subject", subject.strip()[:255])
    if fields.get("reference_sr_number") and fields.get("ckt_id"):
        fields["subject"] = (
            f"SR {fields['reference_sr_number']} / CKT {fields['ckt_id']}"
            + (f" — {fields['end_customer_name']}" if fields.get("end_customer_name") else "")
        )[:255]
    elif problem:
        fields["subject"] = problem[:255]

    # Collect unmatched informative lines as extra
    extras: list[str] = []
    for line in text.split("\n"):
        stripped = line.strip()
        if len(stripped) < 4:
            continue
        low = stripped.lower()
        if any(m in low for m in KNOWN_LINE_MARKERS):
            continue
        if stripped.startswith("Dear") or stripped.startswith("Team"):
            continue
        if "kindly book" in low or "engineer visit" in low:
            extras.append(stripped)
            continue
        if re.match(r"^\d+\.", stripped):
            # numbered but not captured — keep
            if not any(
                fields.get(k) and stripped[:40].lower() in str(fields.get(k)).lower()
                for k in (
                    "site_instructions",
                    "ip_details",
                    "previous_fe_notes",
                    "issue_description",
                )
            ):
                extras.append(stripped)

    if extras:
        # Deduplicate and limit
        seen: set[str] = set()
        unique: list[str] = []
        for e in extras:
            if e not in seen:
                seen.add(e)
                unique.append(e)
        fields["mail_extra_info"] = "\n".join(unique)[:8000]

    fields["description"] = text[:8000]
    if not fields.get("issue_description"):
        fields["issue_description"] = text[:8000]

    return {k: v for k, v in fields.items() if v is not None and v != ""}
