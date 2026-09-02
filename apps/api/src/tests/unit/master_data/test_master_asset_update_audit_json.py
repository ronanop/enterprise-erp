"""Regression tests for BUG-ASN-EMP-01: master asset update audit JSON-safe UUIDs."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.service.assignment_service import AssignmentService
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.asset_service import (
    AssetService,
    _json_safe_audit_payload,
)


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _master_row(*, asset_id: UUID | None = None, branch_id: UUID | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        id=asset_id or uuid4(),
        company_id=uuid4(),
        branch_id=branch_id or uuid4(),
    )


def test_json_safe_audit_payload_stringifies_uuids_preserves_none_and_scalars() -> None:
    custodian = uuid4()
    branch = uuid4()
    location = uuid4()
    payload = _json_safe_audit_payload(
        {
            "custodian_employee_id": custodian,
            "branch_id": branch,
            "location_id": location,
            "status": "active",
            "custodian_employee_id_clear": None,
        }
    )
    assert payload["custodian_employee_id"] == str(custodian)
    assert payload["branch_id"] == str(branch)
    assert payload["location_id"] == str(location)
    assert payload["status"] == "active"
    assert payload["custodian_employee_id_clear"] is None
    json.dumps(payload)  # must not raise


def test_update_asset_repo_keeps_uuid_audit_gets_strings() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    custodian = uuid4()
    branch = uuid4()
    location = uuid4()
    row = _master_row(asset_id=asset_id, branch_id=ctx.branch_id)

    with patch.object(svc, "get_asset", return_value=row):
        with patch.object(svc._scope, "validate_branch_access"):
            with patch.object(svc._repo, "update", return_value=row) as repo_update:
                with patch.object(svc._audit, "log_entity_change") as audit:
                    svc.update_asset(
                        ctx,
                        asset_id,
                        custodian_employee_id=custodian,
                        branch_id=branch,
                        location_id=location,
                        status="active",
                    )

    repo_kwargs = repo_update.call_args.kwargs
    assert repo_kwargs["custodian_employee_id"] is custodian
    assert isinstance(repo_kwargs["custodian_employee_id"], UUID)
    assert repo_kwargs["branch_id"] is branch
    assert isinstance(repo_kwargs["branch_id"], UUID)
    assert repo_kwargs["location_id"] is location
    assert isinstance(repo_kwargs["location_id"], UUID)
    assert repo_kwargs["status"] == "active"

    audit_value = audit.call_args.kwargs["new_value"]
    assert audit_value["custodian_employee_id"] == str(custodian)
    assert audit_value["branch_id"] == str(branch)
    assert audit_value["location_id"] == str(location)
    assert audit_value["status"] == "active"
    assert not isinstance(audit_value["custodian_employee_id"], UUID)
    json.dumps(audit_value)


def test_update_asset_none_custodian_preserved_for_repo_and_audit() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    row = _master_row(asset_id=asset_id)

    with patch.object(svc, "get_asset", return_value=row):
        with patch.object(svc._repo, "update", return_value=row) as repo_update:
            with patch.object(svc._audit, "log_entity_change") as audit:
                svc.update_asset(ctx, asset_id, custodian_employee_id=None)

    assert repo_update.call_args.kwargs["custodian_employee_id"] is None
    assert audit.call_args.kwargs["new_value"]["custodian_employee_id"] is None
    json.dumps(audit.call_args.kwargs["new_value"])


def test_update_master_asset_transfer_uuid_fields_do_not_break_audit() -> None:
    """Linked-master transfer path: port forwards UUIDs into update_asset safely."""
    db = MagicMock()
    adapter = AssetMasterDataAdapter(db)
    ctx = _ctx()
    master_id = uuid4()
    branch = uuid4()
    custodian = uuid4()
    location = uuid4()
    row = _master_row(asset_id=master_id)

    with patch.object(adapter._assets, "get_asset", return_value=row):
        with patch.object(adapter._assets._scope, "validate_branch_access"):
            with patch.object(adapter._assets._repo, "update", return_value=row) as repo_update:
                with patch.object(adapter._assets._audit, "log_entity_change") as audit:
                    adapter.update_master_asset_transfer(
                        ctx,
                        master_id,
                        branch_id=branch,
                        custodian_employee_id=custodian,
                        location_id=location,
                    )

    assert repo_update.call_args.kwargs["branch_id"] is branch
    assert isinstance(repo_update.call_args.kwargs["branch_id"], UUID)
    assert repo_update.call_args.kwargs["custodian_employee_id"] is custodian
    assert isinstance(repo_update.call_args.kwargs["custodian_employee_id"], UUID)
    assert repo_update.call_args.kwargs["location_id"] is location
    assert isinstance(repo_update.call_args.kwargs["location_id"], UUID)

    audit_value = audit.call_args.kwargs["new_value"]
    assert audit_value["branch_id"] == str(branch)
    assert audit_value["custodian_employee_id"] == str(custodian)
    assert audit_value["location_id"] == str(location)
    json.dumps(audit_value)


@patch("modules.asset.service.assignment_service.asset_workflow_governance_enabled", return_value=False)
def test_activate_assignment_with_linked_master_succeeds_json_safe_audit(_gov) -> None:
    """BUG-ASN-EMP-01: employee approve/activate with master_asset_id must not 500."""
    db = MagicMock()
    asn_svc = AssignmentService(db)
    master_svc = AssetService(db)
    adapter = AssetMasterDataAdapter(db)
    adapter._assets = master_svc
    asn_svc._master = adapter

    ctx = _ctx()
    row_id = uuid4()
    asset_id = uuid4()
    master_id = uuid4()
    employee_id = uuid4()
    assignment = SimpleNamespace(
        id=row_id,
        status="submitted",
        workflow_instance_id=None,
        workflow_status=None,
        created_by=uuid4(),
        asset_id=asset_id,
        company_id=ctx.company_id,
        allocation_type="employee",
        employee_id=employee_id,
        department_id=None,
        project_id=None,
        branch_id=ctx.branch_id,
        delivery_reference_number="DC-1",
        delivery_reference_status="issued",
        delivery_challan_signature_status="signed",
    )
    asset = SimpleNamespace(
        id=asset_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        master_asset_id=master_id,
        version=3,
        custodian_employee_id=None,
    )
    master_row = _master_row(asset_id=master_id, branch_id=ctx.branch_id)

    with patch.object(asn_svc, "get", return_value=assignment):
        with patch.object(asn_svc._assets, "get", return_value=asset):
            with patch.object(asn_svc._validator, "validate_activate_readiness", return_value=None):
                with patch.object(asn_svc._assets, "update", return_value=asset):
                    with patch.object(asn_svc._repo, "update", return_value=assignment):
                        with patch.object(asn_svc._assignment_components, "activate_issued"):
                            with patch.object(asn_svc._operational, "apply_action", return_value="ASSIGNED"):
                                with patch.object(asn_svc._audit, "log_entity_change"):
                                    with patch.object(master_svc, "get_asset", return_value=master_row):
                                        with patch.object(
                                            master_svc._repo, "update", return_value=master_row
                                        ) as master_repo:
                                            with patch.object(
                                                master_svc._audit, "log_entity_change"
                                            ) as master_audit:
                                                asn_svc._activate_assignment(ctx, row_id)

    assert master_repo.call_args.kwargs["custodian_employee_id"] is employee_id
    assert isinstance(master_repo.call_args.kwargs["custodian_employee_id"], UUID)
    audit_value = master_audit.call_args.kwargs["new_value"]
    assert audit_value["custodian_employee_id"] == str(employee_id)
    json.dumps(audit_value)


@patch("modules.asset.service.assignment_service.asset_workflow_governance_enabled", return_value=False)
def test_return_assignment_clears_master_custodian_none_safe(_gov) -> None:
    """Employee return with custodian_employee_id=None still succeeds through master update."""
    db = MagicMock()
    asn_svc = AssignmentService(db)
    master_svc = AssetService(db)
    adapter = AssetMasterDataAdapter(db)
    adapter._assets = master_svc
    asn_svc._master = adapter

    ctx = _ctx()
    row_id = uuid4()
    asset_id = uuid4()
    master_id = uuid4()
    employee_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        status="active",
        asset_id=asset_id,
        allocation_type="employee",
        employee_id=employee_id,
    )
    asset = SimpleNamespace(
        id=asset_id,
        version=2,
        custodian_employee_id=employee_id,
        master_asset_id=master_id,
    )
    master_row = _master_row(asset_id=master_id)

    with patch.object(asn_svc, "get", return_value=row):
        with patch.object(asn_svc._validator, "validate_return_readiness"):
            with patch.object(asn_svc._validator, "validate_return_request", return_value="return_to_ready"):
                with patch.object(asn_svc._assets, "lock_for_update", return_value=asset):
                    with patch.object(asn_svc._operational, "apply_action", return_value="READY_TO_MOVE"):
                        with patch.object(asn_svc._assets, "get", return_value=asset):
                            with patch.object(asn_svc._assets, "update", return_value=asset):
                                with patch.object(asn_svc._repo, "complete_return", return_value=row):
                                    with patch.object(asn_svc._audit, "log_entity_change"):
                                        with patch.object(master_svc, "get_asset", return_value=master_row):
                                            with patch.object(
                                                master_svc._repo, "update", return_value=master_row
                                            ) as master_repo:
                                                with patch.object(
                                                    master_svc._audit, "log_entity_change"
                                                ) as master_audit:
                                                    asn_svc.return_assignment(
                                                        ctx,
                                                        row_id,
                                                        return_condition="good",
                                                        remarks="ok",
                                                    )

    assert master_repo.call_args.kwargs["custodian_employee_id"] is None
    assert master_audit.call_args.kwargs["new_value"]["custodian_employee_id"] is None
    json.dumps(master_audit.call_args.kwargs["new_value"])
