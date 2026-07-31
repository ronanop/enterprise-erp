"""OpenAPI smoke tests for asset registration endpoints."""

from main import app


def test_asset_registration_routes_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/assets"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/submit" in paths
    assert f"{base}/{{row_id}}/approve" in paths
    assert f"{base}/{{row_id}}/reject" in paths
    assert f"{base}/{{row_id}}/cancel" in paths
    assert f"{base}/{{row_id}}/reopen" in paths
    assert f"{base}/{{row_id}}/resubmit" in paths
    assert f"{base}/registration/prefill" in paths


def test_asset_list_response_schema_documents_pagination() -> None:
    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "AssetListResult" in schema
    props = schema["AssetListResult"].get("properties", {})
    assert "items" in props
    assert "total" in props
    assert "page" in props
    assert "page_size" in props


def test_asset_transfer_routes_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/asset-transfers"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/submit" in paths
    assert f"{base}/{{row_id}}/approve" in paths
    assert f"{base}/{{row_id}}/reject" in paths
    assert f"{base}/{{row_id}}/cancel" in paths
    assert f"{base}/{{row_id}}/reopen" in paths
    assert f"{base}/{{row_id}}/resubmit" in paths


def test_asset_transfer_list_response_schema_documents_pagination() -> None:
    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "AssetTransferListResult" in schema
    props = schema["AssetTransferListResult"].get("properties", {})
    assert "items" in props
    assert "total" in props
    assert "page" in props
    assert "page_size" in props


def test_asset_assignment_routes_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/asset-assignments"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/submit" in paths
    assert f"{base}/{{row_id}}/approve" in paths
    assert f"{base}/{{row_id}}/reject" in paths
    assert f"{base}/{{row_id}}/cancel" in paths
    assert f"{base}/{{row_id}}/reopen" in paths
    assert f"{base}/{{row_id}}/resubmit" in paths
    assert f"{base}/{{row_id}}/return" in paths


def test_asset_assignment_list_response_schema_documents_pagination() -> None:
    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "AssetAssignmentListResult" in schema
    props = schema["AssetAssignmentListResult"].get("properties", {})
    assert "items" in props
    assert "total" in props
    assert "page" in props
    assert "page_size" in props


def test_asset_maintenance_routes_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/asset-maintenances"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/submit" in paths
    assert f"{base}/{{row_id}}/approve" in paths
    assert f"{base}/{{row_id}}/reject" in paths
    assert f"{base}/{{row_id}}/cancel" in paths
    assert f"{base}/{{row_id}}/reopen" in paths
    assert f"{base}/{{row_id}}/resubmit" in paths
    assert f"{base}/{{row_id}}/schedule" in paths
    assert f"{base}/{{row_id}}/start" in paths
    assert f"{base}/{{row_id}}/complete" in paths


def test_asset_maintenance_list_response_schema_documents_pagination() -> None:
    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "AssetMaintenanceListResult" in schema
    props = schema["AssetMaintenanceListResult"].get("properties", {})
    assert "items" in props
    assert "total" in props
    assert "page" in props
    assert "page_size" in props


def test_asset_disposal_routes_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/asset-disposals"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/submit" in paths
    assert f"{base}/{{row_id}}/approve" in paths
    assert f"{base}/{{row_id}}/reject" in paths
    assert f"{base}/{{row_id}}/cancel" in paths
    assert f"{base}/{{row_id}}/reopen" in paths
    assert f"{base}/{{row_id}}/resubmit" in paths
    assert f"{base}/{{row_id}}/post" in paths


def test_asset_disposal_list_response_schema_documents_pagination() -> None:
    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "AssetDisposalListResult" in schema
    props = schema["AssetDisposalListResult"].get("properties", {})
    assert "items" in props
    assert "total" in props
    assert "page" in props
    assert "page_size" in props


def test_openapi_asset_revaluation_list_and_actions() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/asset-revaluations"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/submit" in paths
    assert f"{base}/{{row_id}}/approve" in paths
    assert f"{base}/{{row_id}}/reject" in paths
    assert f"{base}/{{row_id}}/cancel" in paths
    assert f"{base}/{{row_id}}/reopen" in paths
    assert f"{base}/{{row_id}}/resubmit" in paths
    assert f"{base}/{{row_id}}/post" in paths

    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "AssetRevaluationListResult" in schema
    props = schema["AssetRevaluationListResult"].get("properties", {})
    assert {"items", "total", "page", "page_size"} <= set(props)


def test_asset_depreciation_routes_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/asset-depreciations"
    assert f"{base}" in paths
    assert f"{base}/generate-run" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/calculate" in paths
    assert f"{base}/{{row_id}}/post" in paths
    assert f"{base}/{{row_id}}/reverse" in paths


def test_asset_depreciation_list_response_schema_documents_pagination() -> None:
    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "AssetDepreciationListResult" in schema
    props = schema["AssetDepreciationListResult"].get("properties", {})
    assert "items" in props
    assert "total" in props
    assert "page" in props
    assert "page_size" in props


def test_asset_audit_routes_and_list_schema_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/asset-audits"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/start" in paths
    assert f"{base}/{{row_id}}/complete" in paths
    assert f"{base}/{{row_id}}/cancel" in paths

    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "AssetAuditListResult" in schema
    props = schema["AssetAuditListResult"].get("properties", {})
    assert {"items", "total", "page", "page_size"} <= set(props)


def test_asset_warranty_routes_and_list_schema_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/asset-warranties"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/activate" in paths
    assert f"{base}/{{row_id}}/extend" in paths
    assert f"{base}/{{row_id}}/expire" in paths

    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "AssetWarrantyListResult" in schema
    props = schema["AssetWarrantyListResult"].get("properties", {})
    assert {"items", "total", "page", "page_size"} <= set(props)
    assert "AssetWarrantyExtend" in schema


def test_asset_insurance_routes_and_list_schema_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/asset-insurances"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/activate" in paths
    assert f"{base}/{{row_id}}/renew" in paths
    assert f"{base}/{{row_id}}/expire" in paths
    assert f"{base}/{{row_id}}/close" in paths

    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "AssetInsuranceListResult" in schema
    props = schema["AssetInsuranceListResult"].get("properties", {})
    assert {"items", "total", "page", "page_size"} <= set(props)
    assert "AssetInsuranceRenew" in schema


def test_maintenance_plan_routes_and_list_schema_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/maintenance-plans"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/activate" in paths
    assert f"{base}/{{row_id}}/pause" in paths
    assert f"{base}/{{row_id}}/resume" in paths
    assert f"{base}/{{row_id}}/close" in paths

    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "MaintenancePlanListResult" in schema
    props = schema["MaintenancePlanListResult"].get("properties", {})
    assert {"items", "total", "page", "page_size"} <= set(props)


def test_asset_location_routes_and_list_schema_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/asset-locations"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/complete" in paths

    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "AssetLocationListResult" in schema
    props = schema["AssetLocationListResult"].get("properties", {})
    assert {"items", "total", "page", "page_size"} <= set(props)


def test_service_history_routes_and_list_schema_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/service-histories"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    detail_methods = paths[f"{base}/{{row_id}}"]
    assert "patch" not in detail_methods

    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "ServiceHistoryListResult" in schema
    props = schema["ServiceHistoryListResult"].get("properties", {})
    assert {"items", "total", "page", "page_size"} <= set(props)
    assert "ServiceHistoryUpdate" not in schema


def test_asset_checklist_routes_and_list_schema_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/asset-checklists"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/complete" in paths
    assert f"{base}/{{row_id}}/cancel" in paths

    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "AssetChecklistListResult" in schema
    props = schema["AssetChecklistListResult"].get("properties", {})
    assert {"items", "total", "page", "page_size"} <= set(props)


def test_asset_meter_reading_routes_and_list_schema_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/meter-readings"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/void" in paths
    assert "patch" not in paths.get(f"{base}/{{row_id}}", {})

    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "MeterReadingListResult" in schema
    props = schema["MeterReadingListResult"].get("properties", {})
    assert {"items", "total", "page", "page_size"} <= set(props)
    assert "MeterReadingUpdate" not in schema


def test_asset_document_routes_and_list_schema_registered() -> None:
    paths = app.openapi().get("paths", {})
    base = "/api/v1/assets/asset-documents"
    assert f"{base}" in paths
    assert f"{base}/{{row_id}}" in paths
    assert f"{base}/{{row_id}}/supersede" in paths
    assert f"{base}/{{row_id}}/archive" in paths
    assert "patch" in paths.get(f"{base}/{{row_id}}", {})

    schema = app.openapi().get("components", {}).get("schemas", {})
    assert "AssetDocumentListResult" in schema
    props = schema["AssetDocumentListResult"].get("properties", {})
    assert {"items", "total", "page", "page_size"} <= set(props)
    create_props = schema["AssetDocumentCreate"].get("properties", {})
    assert "status" not in create_props
    assert "asset_id" in create_props
    assert "document_type" in create_props
    assert "document_name" in create_props
    update_props = schema["AssetDocumentUpdate"].get("properties", {})
    assert "status" not in update_props
    assert "version" in update_props
