"""Customer Portal module import smoke tests."""

from modules.portal.models import PtCustomerProfile, PtOrderView, PtPortalAccount
from modules.portal.router import portal_router
from modules.portal.service import (
    CustomerProfileService,
    OrderViewService,
    PortalAccountService,
    PortalApplicationService,
    PortalIntegrationService,
)
from modules.portal.service.engines import CustomerProfileEngine, PortalAccountEngine


def test_portal_models_importable():
    assert PtPortalAccount is not None
    assert PtCustomerProfile is not None
    assert PtOrderView is not None


def test_portal_router_mounted():
    assert portal_router.prefix == "/portal"
    assert len(portal_router.routes) > 0


def test_portal_services_and_engines_importable():
    assert PortalAccountService is not None
    assert CustomerProfileService is not None
    assert OrderViewService is not None
    assert PortalApplicationService is not None
    assert PortalIntegrationService is not None
    assert PortalAccountEngine is not None
    assert CustomerProfileEngine is not None
