"""Asset port — UUID-only stubs; no ast_* FK or ORM writes."""

from uuid import UUID


class ServiceAssetAdapter:
    def __init__(self, db=None) -> None:
        self._db = db

    def resolve_asset_uuid(self, asset_id: UUID | None) -> dict:
        return {"asset_id": asset_id, "linked": asset_id is not None}

    def resolve_maintenance_plan_uuid(self, maintenance_plan_id: UUID | None) -> dict:
        return {"maintenance_plan_id": maintenance_plan_id, "linked": maintenance_plan_id is not None}
