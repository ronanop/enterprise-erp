"""ZKTeco ADMS / iClock push endpoints (device → HRMS, no JWT)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session

from modules.hr.dependencies import get_db
from modules.hr.service.compoff_bio_service import BiometricDeviceService

# Mounted at /iclock (root) and /api/v1/iclock — ZK Cloud Server = public HRMS base URL.
adms_router = APIRouter(tags=["HR - ADMS / iClock"])


def _sn(serial: str | None) -> str:
    return (serial or "").strip()


@adms_router.api_route("/cdata", methods=["GET", "POST"])
async def iclock_cdata(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    SN: Annotated[str | None, Query()] = None,
    sn: Annotated[str | None, Query()] = None,
    table: Annotated[str | None, Query()] = None,
    Stamp: Annotated[str | None, Query()] = None,
    stamp: Annotated[str | None, Query()] = None,
    options: Annotated[str | None, Query()] = None,
):
    """
    ZK handshake (GET options=all) and attendance push (POST table=ATTLOG).

    Device Cloud Server should be the public HRMS origin (e.g. http://hrms.example.com).
    """
    serial = _sn(SN or sn)
    svc = BiometricDeviceService(db)

    if request.method == "GET":
        _ = options  # options=all on handshake
        body = svc.adms_handshake(serial)
        return Response(content=body, media_type="text/plain")

    table_name = (table or "").strip().upper()
    raw = (await request.body()).decode("utf-8", errors="ignore")
    if table_name in {"ATTLOG", "ATTITUDE", ""} and raw.strip():
        # Empty table often still carries ATTLOG lines on some firmware.
        result = svc.adms_ingest_attlog(
            serial_number=serial,
            body=raw,
            stamp=Stamp or stamp,
        )
        return Response(content=result, media_type="text/plain")

    if table_name in {"OPERLOG", "OPTIONS"}:
        return Response(content="OK", media_type="text/plain")

    # Unknown table — acknowledge so device does not retry forever.
    return Response(content="OK", media_type="text/plain")


@adms_router.get("/getrequest")
def iclock_getrequest(
    db: Annotated[Session, Depends(get_db)],
    SN: Annotated[str | None, Query()] = None,
    sn: Annotated[str | None, Query()] = None,
):
    """Device command poll — return OK (no remote commands queued)."""
    body = BiometricDeviceService(db).adms_getrequest(_sn(SN or sn))
    return Response(content=body, media_type="text/plain")


@adms_router.get("/ping")
def iclock_ping():
    """Simple reachability check for ops / firewall tests."""
    return Response(content="OK", media_type="text/plain")
