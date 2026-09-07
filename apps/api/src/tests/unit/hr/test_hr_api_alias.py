"""Alias /api/v1/hr to /api/v1/hrms."""

from middleware.hr_api_alias import HRMS_PREFIX, HR_PREFIX, HrToHrmsAliasMiddleware


class _DummyApp:
    def __init__(self) -> None:
        self.scope = None

    async def __call__(self, scope, receive, send):
        self.scope = scope


def test_hr_path_rewritten_to_hrms():
    app = _DummyApp()
    mw = HrToHrmsAliasMiddleware(app)

    async def _run():
        scope = {"type": "http", "path": f"{HR_PREFIX}/management-groups", "raw_path": b"/api/v1/hr/management-groups"}
        await mw(scope, None, None)
        assert app.scope["path"] == f"{HRMS_PREFIX}/management-groups"

    import asyncio

    asyncio.run(_run())
