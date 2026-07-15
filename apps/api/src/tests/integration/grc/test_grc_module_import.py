"""Integration smoke: GRC module imports and router mount."""

from modules.grc.models import GrcAudit, GrcPolicy, GrcRiskRegister
from modules.grc.router import grc_router
from modules.grc.service import (
    GrcApplicationService,
    GrcAuditService,
    GrcIntegrationService,
    GrcReportService,
    PolicyService,
    RiskRegisterService,
)
from modules.grc.service.engines import AuditEngine, PolicyEngine, RiskRegisterEngine


def test_grc_models_importable():
    assert GrcPolicy.__tablename__ == "grc_policy"
    assert GrcRiskRegister.__tablename__ == "grc_risk_register"
    assert GrcAudit.__tablename__ == "grc_audit"


def test_grc_router_mounted():
    assert grc_router.prefix == "/grc"
    paths = [getattr(r, "path", "") for r in grc_router.routes]
    assert any("/{row_id}" in p for p in paths)
    assert any("policies" in p for p in paths)
    assert any("risk-registers" in p for p in paths)


def test_grc_services_and_engines_importable():
    assert GrcApplicationService is not None
    assert PolicyService is not None
    assert RiskRegisterService is not None
    assert GrcAuditService is not None
    assert GrcReportService is not None
    assert GrcIntegrationService is not None
    assert PolicyEngine is not None
    assert RiskRegisterEngine is not None
    assert AuditEngine is not None
