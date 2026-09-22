"""Permission-safe in-app notification destinations."""

KIND_DEFAULT_HREF: dict[str, str] = {
    "leave": "/hr/ess-inbox",
    "birthday": "/hr",
    "anniversary": "/hr",
    "interview": "/hr/recruitment",
    "offer": "/hr/recruitment",
    "document": "/hr/workforce",
    "probation": "/hr/workforce",
    "policy": "/hr/ess-policies",
    "payroll_due": "/hr/payroll",
}


def sanitize_inbox_href(href: object | None, *, kind: str | None = None) -> str | None:
    """Allow only same-origin relative app paths. Reject protocol-relative and absolute URLs."""
    if isinstance(href, str):
        value = href.strip()
        if (
            value.startswith("/")
            and not value.startswith("//")
            and "://" not in value
            and "\\" not in value
            and "\n" not in value
            and "\r" not in value
        ):
            return value
    if kind:
        return KIND_DEFAULT_HREF.get(kind)
    return None
