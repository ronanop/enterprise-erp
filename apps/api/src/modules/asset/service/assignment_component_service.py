"""Assignment component custody service (Sub-phase 4C)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import (
    ASSIGNMENT_COMPONENT_RETURN_OUTCOMES,
    AssetAssignmentStatus,
    AssetComponentStatus,
    AssignmentComponentIssueStatus,
)
from modules.asset.domain.exceptions import AssignmentValidationError, ComponentValidationError
from modules.asset.models import AstAssetAssignment, AstAssignmentComponent, AstAssetComponent
from modules.asset.repository.assignment_component_repository import AssignmentComponentRepository
from modules.asset.repository.asset_component_repository import AssetComponentRepository
from modules.asset.repository.base import utcnow
from modules.foundation.domain.value_objects import TenantContext


def _is_active_issue_unique_violation(exc: IntegrityError) -> bool:
    """True only for unique/duplicate custody conflicts (not NotNull/FK/etc.)."""
    orig = getattr(exc, "orig", None)
    if orig is None:
        return False
    # psycopg UniqueViolation (and similarly named dialect errors)
    if type(orig).__name__ == "UniqueViolation":
        return True
    # PostgreSQL unique_violation
    pgcode = getattr(orig, "pgcode", None) or getattr(orig, "sqlstate", None)
    if pgcode == "23505":
        return True
    text = str(orig).lower()
    return "uq_ast_assignment_component_active_issue" in text


class AssignmentComponentService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = AssignmentComponentRepository(db)
        self._components = AssetComponentRepository(db)

    def list_for_assignment(
        self, ctx: TenantContext, assignment: AstAssetAssignment
    ) -> list[dict]:
        rows = self._repo.list_for_assignment(ctx, assignment.id)
        return [self._enrich(ctx, row) for row in rows]

    def set_components(
        self,
        ctx: TenantContext,
        assignment: AstAssetAssignment,
        component_ids: list[UUID] | None,
        *,
        allow_when_active: bool = False,
    ) -> list[AstAssignmentComponent]:
        """Set/replace ISSUED component selection for a draft or submitted assignment."""
        if component_ids is None:
            return self._repo.list_issued_for_assignment(ctx, assignment.id)

        allowed_statuses = {
            AssetAssignmentStatus.DRAFT.value,
            AssetAssignmentStatus.SUBMITTED.value,
        }
        if allow_when_active:
            allowed_statuses.add(AssetAssignmentStatus.ACTIVE.value)
        if assignment.status not in allowed_statuses:
            raise AssignmentValidationError(
                "Components can only be selected on draft or submitted assignments"
            )

        unique_ids = list(dict.fromkeys(component_ids))
        self._validate_and_lock_for_issue(
            ctx,
            assignment=assignment,
            component_ids=unique_ids,
        )
        try:
            return self._repo.replace_draft_selection(
                ctx,
                assignment_id=assignment.id,
                company_id=assignment.company_id,
                component_ids=unique_ids,
            )
        except IntegrityError as exc:
            if _is_active_issue_unique_violation(exc):
                raise AssignmentValidationError(
                    "One or more components are already issued on another assignment"
                ) from exc
            raise

    def activate_issued(self, ctx: TenantContext, assignment: AstAssetAssignment) -> None:
        """Stamp issued_at and re-validate availability at activation time."""
        rows = self._repo.list_issued_for_assignment(ctx, assignment.id)
        if not rows:
            return
        ids = [r.component_id for r in rows]
        self._validate_and_lock_for_issue(
            ctx,
            assignment=assignment,
            component_ids=ids,
            exclude_own_issued=True,
        )
        self._repo.mark_issued_at(ctx, assignment.id)

    def release_issued(self, ctx: TenantContext, assignment_id: UUID) -> None:
        """Soft-delete ISSUED lines (cancel / reject) so components become selectable again."""
        self._repo.soft_delete_issued_for_assignment(ctx, assignment_id)

    def reconcile_return(
        self,
        ctx: TenantContext,
        assignment: AstAssetAssignment,
        returns: list[dict] | None,
    ) -> list[AstAssignmentComponent]:
        """Apply per-component return outcomes. Required when ISSUED lines exist."""
        issued = self._repo.list_issued_for_assignment(ctx, assignment.id)
        if not issued:
            if returns:
                raise AssignmentValidationError(
                    "No issued components to reconcile on this assignment"
                )
            return []

        if returns is None:
            raise AssignmentValidationError(
                "component_returns is required when the assignment has issued components"
            )

        by_component = {r.component_id: r for r in issued}
        seen: set[UUID] = set()
        now = utcnow()
        updated: list[AstAssignmentComponent] = []

        for item in returns:
            component_id = item.get("component_id")
            if component_id is None:
                raise AssignmentValidationError("component_id is required for each return line")
            if component_id in seen:
                raise AssignmentValidationError(
                    "Duplicate component_id in component_returns"
                )
            seen.add(component_id)
            row = by_component.get(component_id)
            if row is None:
                raise AssignmentValidationError(
                    "Component was not issued on this assignment"
                )
            outcome = str(item.get("issue_status") or "").strip().upper()
            if outcome not in ASSIGNMENT_COMPONENT_RETURN_OUTCOMES:
                raise AssignmentValidationError(
                    "issue_status must be RETURNED, MISSING, DAMAGED, or RETAINED"
                )
            remarks = item.get("return_remarks")
            if remarks is not None:
                remarks = str(remarks).strip() or None
                if remarks and len(remarks) > 4000:
                    raise AssignmentValidationError("return_remarks exceeds maximum length")

            claimed = self._repo.update(
                ctx,
                row.id,
                version=int(row.version or 1),
                issue_status=outcome,
                return_condition=outcome,
                return_remarks=remarks,
                returned_at=now,
            )
            if claimed is None:
                raise AssignmentValidationError(
                    "Assignment component was modified concurrently; reload and retry"
                )
            updated.append(claimed)

        missing = set(by_component) - seen
        if missing:
            raise AssignmentValidationError(
                "All issued components must be reconciled on return"
            )
        return updated

    def _validate_and_lock_for_issue(
        self,
        ctx: TenantContext,
        *,
        assignment: AstAssetAssignment,
        component_ids: list[UUID],
        exclude_own_issued: bool = False,
    ) -> list[AstAssetComponent]:
        locked: list[AstAssetComponent] = []
        # Lock in stable UUID order to reduce deadlock risk.
        for cid in sorted(component_ids, key=str):
            row = self._components.lock_for_update(ctx, cid)
            if row is None:
                raise NotFoundException("Component not found")
            if row.company_id != assignment.company_id:
                raise AssignmentValidationError("Component does not belong to this company")
            if row.asset_id != assignment.asset_id:
                raise AssignmentValidationError(
                    "Component does not belong to the selected asset"
                )
            if row.status != AssetComponentStatus.ACTIVE.value:
                raise AssignmentValidationError(
                    f"Component {row.component_code} is not active"
                )
            blocking = self._repo.find_blocking_for_component(
                ctx,
                component_id=cid,
                exclude_assignment_id=assignment.id if exclude_own_issued else (
                    assignment.id  # always exclude own when replacing selection
                ),
            )
            # When setting draft selection, exclude own assignment's current ISSUED rows.
            # find_blocking with exclude_assignment_id skips own — good for both draft replace and activate.
            if blocking is not None:
                if blocking.issue_status == AssignmentComponentIssueStatus.ISSUED.value:
                    raise AssignmentValidationError(
                        f"Component {row.component_code} is already issued"
                    )
                raise AssignmentValidationError(
                    f"Component {row.component_code} is unavailable "
                    f"({blocking.issue_status})"
                )
            locked.append(row)
        return locked

    def _enrich(self, ctx: TenantContext, row: AstAssignmentComponent) -> dict:
        component = self._components.get(ctx, row.component_id)
        linked_code = None
        linked_name = None
        linked_ops = None
        child_id = getattr(component, "component_asset_id", None) if component else None
        if child_id is not None:
            from modules.asset.repository.asset_repository import AssetRepository

            child = AssetRepository(self._components.db).get(ctx, child_id)
            if child is not None:
                linked_code = child.asset_code
                linked_name = child.asset_name
                linked_ops = child.operational_status
        return {
            "id": row.id,
            "assignment_id": row.assignment_id,
            "component_id": row.component_id,
            "issue_status": row.issue_status,
            "issued_at": row.issued_at,
            "returned_at": row.returned_at,
            "return_condition": row.return_condition,
            "return_remarks": row.return_remarks,
            "company_id": row.company_id,
            "version": int(row.version or 1),
            "component_code": component.component_code if component else None,
            "component_name": component.component_name if component else None,
            "component_type": getattr(component, "component_type", None) if component else None,
            "serial_number": component.serial_number if component else None,
            "component_status": component.status if component else None,
            "component_asset_id": child_id,
            "linked_asset_code": linked_code,
            "linked_asset_name": linked_name,
            "linked_asset_operational_status": linked_ops,
        }


def assert_charger_serial(component_type: str | None, serial_number: str | None) -> None:
    if component_type == "CHARGER" and not (serial_number and str(serial_number).strip()):
        raise ComponentValidationError("serial_number is required for CHARGER components")
