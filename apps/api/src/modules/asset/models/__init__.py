"""Asset ORM models."""

from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_assignment import AstAssetAssignment
from modules.asset.models.asset_audit import AstAssetAudit
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_type import AstAssetType
from modules.asset.models.asset_checklist import AstAssetChecklist
from modules.asset.models.asset_component import AstAssetComponent
from modules.asset.models.assignment_component import AstAssignmentComponent
from modules.asset.models.asset_depreciation import AstAssetDepreciation
from modules.asset.models.asset_disposal import AstAssetDisposal
from modules.asset.models.asset_document import AstAssetDocument
from modules.asset.models.asset_insurance import AstAssetInsurance
from modules.asset.models.asset_location import AstAssetLocation
from modules.asset.models.asset_maintenance import AstAssetMaintenance
from modules.asset.models.asset_maintenance_plan import AstAssetMaintenancePlan
from modules.asset.models.asset_meter_reading import AstAssetMeterReading
from modules.asset.models.asset_notification import AstAssetNotification
from modules.asset.models.asset_report import AstAssetReport
from modules.asset.models.asset_revaluation import AstAssetRevaluation
from modules.asset.models.asset_service_history import AstAssetServiceHistory
from modules.asset.models.asset_transfer import AstAssetTransfer
from modules.asset.models.asset_warranty import AstAssetWarranty
from modules.asset.models.dc_challan import AstDcChallan
from modules.asset.models.dc_challan_document import AstDcChallanDocument
from modules.asset.models.domain_membership import AstDomainMembership
from modules.asset.models.incoming_asset import (
    AstIncomingArrivalEvent,
    AstIncomingAssetLine,
    AstIncomingAssetUnit,
    AstIncomingQcEvent,
)
from modules.asset.models.nonit_asset import AstNonitAsset
from modules.asset.models.nonit_asset_type import AstNonitAssetType
from modules.asset.models.nonit_location import AstNonitLocation
from modules.asset.models.nonit_timeline import AstNonitAssetTimeline
from modules.asset.models.site_building import AstBuilding
from modules.asset.models.site_location import AstLocation

__all__ = [
    "AstAssetCategory",
    "AstAssetType",
    "AstAsset",
    "AstDomainMembership",
    "AstNonitAssetType",
    "AstNonitLocation",
    "AstNonitAsset",
    "AstNonitAssetTimeline",
    "AstAssetComponent",
    "AstAssignmentComponent",
    "AstAssetAssignment",
    "AstAssetTransfer",
    "AstAssetLocation",
    "AstLocation",
    "AstBuilding",
    "AstAssetWarranty",
    "AstAssetInsurance",
    "AstAssetMaintenancePlan",
    "AstAssetMaintenance",
    "AstAssetServiceHistory",
    "AstAssetDepreciation",
    "AstAssetDisposal",
    "AstAssetRevaluation",
    "AstAssetAudit",
    "AstAssetDocument",
    "AstAssetChecklist",
    "AstAssetMeterReading",
    "AstAssetNotification",
    "AstAssetReport",
    "AstIncomingAssetLine",
    "AstIncomingAssetUnit",
    "AstIncomingArrivalEvent",
    "AstIncomingQcEvent",
    "AstDcChallan",
    "AstDcChallanDocument",
]
