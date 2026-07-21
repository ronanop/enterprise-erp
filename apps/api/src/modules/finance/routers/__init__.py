"""Finance routers."""

from modules.finance.routers.coa import account_groups_router, chart_of_accounts_router
from modules.finance.routers.fiscal import fiscal_years_router, periods_router
from modules.finance.routers.gl import gl_router
from modules.finance.routers.journals import journals_router
from modules.finance.routers.misc import (
    asset_transactions_router,
    currency_rates_router,
    reports_router,
    tax_register_router,
)
from modules.finance.routers.subledgers import ap_router, ar_router

__all__ = [
    "account_groups_router",
    "chart_of_accounts_router",
    "fiscal_years_router",
    "periods_router",
    "journals_router",
    "gl_router",
    "ar_router",
    "ap_router",
    "tax_register_router",
    "currency_rates_router",
    "asset_transactions_router",
    "reports_router",
]
