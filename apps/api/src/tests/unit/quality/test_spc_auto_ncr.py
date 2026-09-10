"""SPC auto-NCR goes through NcrService; qm_ncr constraints stay unchanged."""

from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy import CheckConstraint

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models.ncr import QmNcr
from modules.quality.service.engines.spc_engine import SpcEngine
from modules.quality.service.ncr_capa_service import NcrService
from modules.quality.service.spc_reading_service import SpcReadingService


NCR_SOURCE_SQL = "source IN ('incoming','in_process','final','audit','complaint','supplier','other')"


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="tenant_admin",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_qm_ncr_source_constraint_unchanged():
    source_checks = [
        c
        for c in QmNcr.__table__.constraints
        if isinstance(c, CheckConstraint) and c.name == "ck_qm_ncr_source"
    ]
    assert len(source_checks) == 1
    sql = str(source_checks[0].sqltext).replace(" ", "")
    assert NCR_SOURCE_SQL.replace(" ", "") in sql
    assert "spc" not in sql
    columns = {col.name for col in QmNcr.__table__.columns}
    assert "source_document_type" in columns
    assert "source_document_id" in columns
    assert "source_module" in columns


def test_auto_ncr_kwargs_use_existing_in_process_source():
    engine = SpcEngine()
    reading_id = uuid4()
    evaluation = engine.evaluate_point(
        Decimal("12"),
        min_value=Decimal("9"),
        max_value=Decimal("11"),
        target_value=Decimal("10"),
        prior_values=[],
    )
    kwargs = engine.build_auto_ncr_kwargs(
        company_id=uuid4(),
        branch_id=uuid4(),
        reading_id=reading_id,
        measured_value=Decimal("12"),
        evaluation=evaluation,
        product_id=None,
        inprocess_inspection_id=None,
        incoming_inspection_id=None,
        final_inspection_id=None,
        characteristic_code="CHAR-SPC",
    )
    assert kwargs["source"] == "in_process"
    assert kwargs["source"] != "spc"
    assert kwargs["source_document_type"] == "spc_reading"
    assert kwargs["source_document_id"] == reading_id
    assert kwargs["severity"] in {"minor", "major", "critical"}


def test_out_of_control_reading_creates_ncr_via_ncr_service():
    """Demonstration: OOC reading calls existing NcrService.create_ncr (not raw SQL)."""
    ctx = _ctx()
    company_id = ctx.company_id
    branch_id = ctx.branch_id
    char_id = uuid4()
    reading = SimpleNamespace(
        id=uuid4(),
        product_id=None,
        inprocess_inspection_id=None,
        incoming_inspection_id=None,
        final_inspection_id=None,
        ncr_id=None,
        characteristic_id=char_id,
        company_id=company_id,
    )
    ncr_id = uuid4()
    ncr_calls: list[dict] = []

    svc = SpcReadingService.__new__(SpcReadingService)
    svc._repo = SimpleNamespace(
        list_window=lambda *args, **kwargs: [],
        create=lambda ctx, **fields: reading,
        update=lambda ctx, reading_id, **fields: setattr(reading, "ncr_id", fields.get("ncr_id")) or reading,
        get=lambda ctx, reading_id: reading,
    )
    svc._chars = SimpleNamespace(
        get=lambda ctx, cid: SimpleNamespace(
            id=cid,
            min_value=Decimal("9"),
            max_value=Decimal("11"),
            target_value=Decimal("10"),
            inspection_plan_id=None,
            characteristic_code="CHAR-SPC",
        )
    )
    svc._numbers = SimpleNamespace(generate=lambda *args, **kwargs: "SPC-2026-000001")
    svc._engine = SpcEngine()
    svc._ncrs = SimpleNamespace(
        create_ncr=lambda ctx, **fields: ncr_calls.append(fields) or SimpleNamespace(id=ncr_id)
    )
    svc._scope = SimpleNamespace(
        require_branch=lambda ctx, bid: bid,
        validate_company_access=lambda ctx, cid: None,
    )
    svc._audit = SimpleNamespace(log_entity_change=lambda **kwargs: None)

    result = svc.create_reading(
        ctx,
        company_id=company_id,
        branch_id=branch_id,
        characteristic_id=char_id,
        measured_value=Decimal("12.5"),
    )
    assert len(ncr_calls) == 1
    assert ncr_calls[0]["source"] == "in_process"
    assert ncr_calls[0]["source_document_type"] == "spc_reading"
    assert ncr_calls[0]["source_document_id"] == reading.id
    assert result.ncr_id == ncr_id


def test_ncr_service_create_ncr_accepts_spc_source_document_fields():
    """Existing NcrService.create_ncr persists SPC provenance without schema changes."""
    ctx = _ctx()
    reading_id = uuid4()
    captured: dict = {}

    svc = NcrService.__new__(NcrService)
    svc._repo = SimpleNamespace(
        create=lambda ctx, **fields: captured.update(fields) or SimpleNamespace(id=uuid4(), **fields)
    )
    svc._numbers = SimpleNamespace(generate=lambda *args, **kwargs: "NCR-2026-000099")
    svc._engine = None
    svc._scope = SimpleNamespace(
        require_branch=lambda ctx, bid: bid,
        validate_company_access=lambda ctx, cid: None,
    )
    svc._audit = SimpleNamespace()

    evaluation = SpcEngine().evaluate_point(
        Decimal("12"),
        min_value=Decimal("9"),
        max_value=Decimal("11"),
        target_value=Decimal("10"),
        prior_values=[],
    )
    kwargs = SpcEngine().build_auto_ncr_kwargs(
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        reading_id=reading_id,
        measured_value=Decimal("12"),
        evaluation=evaluation,
        product_id=None,
        inprocess_inspection_id=None,
        incoming_inspection_id=None,
        final_inspection_id=None,
        characteristic_code="CHAR-SPC",
    )
    ncr = svc.create_ncr(ctx, **kwargs)
    assert captured["source"] == "in_process"
    assert captured["source_module"] == "quality"
    assert captured["source_document_type"] == "spc_reading"
    assert captured["source_document_id"] == reading_id
    assert captured["status"] == "draft"
    assert ncr is not None
