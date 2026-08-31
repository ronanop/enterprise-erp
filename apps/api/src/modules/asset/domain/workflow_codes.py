"""Asset workflow definition codes per ERD-15 / migration 0266."""

from typing import Final

# wf_instance.entity_name keys
ENTITY_AST_ASSET: Final[str] = "ast_asset"
ENTITY_AST_ASSIGNMENT: Final[str] = "ast_asset_assignment"
ENTITY_AST_TRANSFER: Final[str] = "ast_asset_transfer"
ENTITY_AST_MAINTENANCE: Final[str] = "ast_asset_maintenance"
ENTITY_AST_DISPOSAL: Final[str] = "ast_asset_disposal"
ENTITY_AST_DEPRECIATION: Final[str] = "ast_asset_depreciation"
ENTITY_AST_REVALUATION: Final[str] = "ast_asset_revaluation"

WORKFLOW_CODES: dict[str, str] = {
    ENTITY_AST_ASSET: "AST_ASSET_APPROVAL",
    ENTITY_AST_ASSIGNMENT: "AST_ASSIGNMENT_APPROVAL",
    ENTITY_AST_TRANSFER: "AST_TRANSFER_APPROVAL",
    ENTITY_AST_MAINTENANCE: "AST_MAINTENANCE_APPROVAL",
    ENTITY_AST_DISPOSAL: "AST_DISPOSAL_APPROVAL",
    ENTITY_AST_REVALUATION: "AST_REVALUATION_APPROVAL",
}

NOTIFICATION_TEMPLATE_CODES: dict[str, str] = {
    "submitted": "AST_WF_SUBMITTED",
    "step_approved": "AST_WF_STEP_APPROVED",
    "approved": "AST_WF_APPROVED",
    "rejected": "AST_WF_REJECTED",
}
