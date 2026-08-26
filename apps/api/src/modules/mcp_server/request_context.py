"""Request-scoped context for MCP → ERP delegation."""

from contextvars import ContextVar

erp_access_token_var: ContextVar[str | None] = ContextVar("erp_access_token", default=None)


def get_erp_access_token() -> str | None:
    return erp_access_token_var.get()


def set_erp_access_token(token: str | None) -> None:
    erp_access_token_var.set(token)
