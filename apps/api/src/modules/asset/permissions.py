"""Asset permission constants per ERD_15 section 14."""

ASSET_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("asset.category:read", "asset.category", "read", "asset"),
    ("asset.category:create", "asset.category", "create", "asset"),
    ("asset.category:update", "asset.category", "update", "asset"),
    ("asset.asset:read", "asset.asset", "read", "asset"),
    ("asset.asset:create", "asset.asset", "create", "asset"),
    ("asset.asset:update", "asset.asset", "update", "asset"),
    ("asset.asset:submit", "asset.asset", "submit", "asset"),
    ("asset.asset:approve", "asset.asset", "approve", "asset"),
    ("asset.component:read", "asset.component", "read", "asset"),
    ("asset.component:create", "asset.component", "create", "asset"),
    ("asset.component:update", "asset.component", "update", "asset"),
    ("asset.assignment:read", "asset.assignment", "read", "asset"),
    ("asset.assignment:create", "asset.assignment", "create", "asset"),
    ("asset.assignment:update", "asset.assignment", "update", "asset"),
    ("asset.assignment:submit", "asset.assignment", "submit", "asset"),
    ("asset.assignment:approve", "asset.assignment", "approve", "asset"),
    ("asset.assignment:return", "asset.assignment", "return", "asset"),
    ("asset.transfer:read", "asset.transfer", "read", "asset"),
    ("asset.transfer:create", "asset.transfer", "create", "asset"),
    ("asset.transfer:update", "asset.transfer", "update", "asset"),
    ("asset.transfer:submit", "asset.transfer", "submit", "asset"),
    ("asset.transfer:approve", "asset.transfer", "approve", "asset"),
    ("asset.location:read", "asset.location", "read", "asset"),
    ("asset.location:create", "asset.location", "create", "asset"),
    ("asset.location:complete", "asset.location", "complete", "asset"),
    ("asset.warranty:read", "asset.warranty", "read", "asset"),
    ("asset.warranty:create", "asset.warranty", "create", "asset"),
    ("asset.warranty:update", "asset.warranty", "update", "asset"),
    ("asset.warranty:activate", "asset.warranty", "activate", "asset"),
    ("asset.warranty:extend", "asset.warranty", "extend", "asset"),
    ("asset.warranty:expire", "asset.warranty", "expire", "asset"),
    ("asset.insurance:read", "asset.insurance", "read", "asset"),
    ("asset.insurance:create", "asset.insurance", "create", "asset"),
    ("asset.insurance:update", "asset.insurance", "update", "asset"),
    ("asset.insurance:activate", "asset.insurance", "activate", "asset"),
    ("asset.insurance:renew", "asset.insurance", "renew", "asset"),
    ("asset.insurance:expire", "asset.insurance", "expire", "asset"),
    ("asset.insurance:close", "asset.insurance", "close", "asset"),
    ("asset.maintenance_plan:read", "asset.maintenance_plan", "read", "asset"),
    ("asset.maintenance_plan:create", "asset.maintenance_plan", "create", "asset"),
    ("asset.maintenance_plan:update", "asset.maintenance_plan", "update", "asset"),
    ("asset.maintenance_plan:activate", "asset.maintenance_plan", "activate", "asset"),
    ("asset.maintenance_plan:pause", "asset.maintenance_plan", "pause", "asset"),
    ("asset.maintenance_plan:resume", "asset.maintenance_plan", "resume", "asset"),
    ("asset.maintenance_plan:close", "asset.maintenance_plan", "close", "asset"),
    ("asset.maintenance:read", "asset.maintenance", "read", "asset"),
    ("asset.maintenance:create", "asset.maintenance", "create", "asset"),
    ("asset.maintenance:update", "asset.maintenance", "update", "asset"),
    ("asset.maintenance:submit", "asset.maintenance", "submit", "asset"),
    ("asset.maintenance:approve", "asset.maintenance", "approve", "asset"),
    ("asset.maintenance:complete", "asset.maintenance", "complete", "asset"),
    ("asset.depreciation:read", "asset.depreciation", "read", "asset"),
    ("asset.depreciation:update", "asset.depreciation", "update", "asset"),
    ("asset.depreciation:calculate", "asset.depreciation", "calculate", "asset"),
    ("asset.depreciation:post", "asset.depreciation", "post", "asset"),
    ("asset.disposal:read", "asset.disposal", "read", "asset"),
    ("asset.disposal:create", "asset.disposal", "create", "asset"),
    ("asset.disposal:update", "asset.disposal", "update", "asset"),
    ("asset.disposal:submit", "asset.disposal", "submit", "asset"),
    ("asset.disposal:approve", "asset.disposal", "approve", "asset"),
    ("asset.disposal:post", "asset.disposal", "post", "asset"),
    ("asset.revaluation:read", "asset.revaluation", "read", "asset"),
    ("asset.revaluation:create", "asset.revaluation", "create", "asset"),
    ("asset.revaluation:update", "asset.revaluation", "update", "asset"),
    ("asset.revaluation:submit", "asset.revaluation", "submit", "asset"),
    ("asset.revaluation:approve", "asset.revaluation", "approve", "asset"),
    ("asset.revaluation:post", "asset.revaluation", "post", "asset"),
    ("asset.audit:read", "asset.audit", "read", "asset"),
    ("asset.audit:create", "asset.audit", "create", "asset"),
    ("asset.audit:update", "asset.audit", "update", "asset"),
    ("asset.audit:complete", "asset.audit", "complete", "asset"),
    ("asset.document:read", "asset.document", "read", "asset"),
    ("asset.document:create", "asset.document", "create", "asset"),
    ("asset.document:update", "asset.document", "update", "asset"),
    ("asset.checklist:read", "asset.checklist", "read", "asset"),
    ("asset.checklist:create", "asset.checklist", "create", "asset"),
    ("asset.checklist:update", "asset.checklist", "update", "asset"),
    ("asset.meter:read", "asset.meter", "read", "asset"),
    ("asset.meter:create", "asset.meter", "create", "asset"),
    ("asset.meter:update", "asset.meter", "update", "asset"),
    ("asset.notification:read", "asset.notification", "read", "asset"),
    ("asset.notification:create", "asset.notification", "create", "asset"),
    ("asset.notification:update", "asset.notification", "update", "asset"),
    ("asset.report:read", "asset.report", "read", "asset"),
    ("asset.report:export", "asset.report", "export", "asset"),
    ("asset.incoming:read", "asset.incoming", "read", "asset"),
    ("asset.incoming:receive", "asset.incoming", "receive", "asset"),
    ("asset.incoming_qc:read", "asset.incoming_qc", "read", "asset"),
    ("asset.incoming_qc:inspect", "asset.incoming_qc", "inspect", "asset"),
    ("asset.dc_challan:read", "asset.dc_challan", "read", "asset"),
    ("asset.dc_challan:create", "asset.dc_challan", "create", "asset"),
    ("asset.dc_challan:update", "asset.dc_challan", "update", "asset"),
    ("asset.dc_challan:send", "asset.dc_challan", "send", "asset"),
    ("asset.dc_challan:receive", "asset.dc_challan", "receive", "asset"),
]

_ALL = [p[0] for p in ASSET_PERMISSIONS]

ASSET_EXECUTIVE_PERMISSIONS = [
    p
    for p in _ALL
    if not any(
        x in p
        for x in (
            ":approve",
            ":post",
            "depreciation:calculate",
            "disposal:approve",
            "revaluation:approve",
        )
    )
]

ASSET_MANAGER_PERMISSIONS = list(_ALL)

ASSET_AUDITOR_PERMISSIONS = [
    p
    for p in _ALL
    if p.endswith(":read") or p.startswith("asset.audit:") or p.startswith("asset.report:")
]

ASSET_ADMIN_PERMISSIONS = list(_ALL)
