"""User router."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.schemas import (
    AssignRoleRequest,
    HrmsIntegrationSettingsResponse,
    HrmsIntegrationSettingsUpsertRequest,
    HrmsIntegrationSyncResponse,
    HrmsIntegrationTestResponse,
    HrmsIntegrationTestSample,
    HrmsLeaveBalanceItem,
    HrmsUserProfileResponse,
    ModuleAccessRequest,
    TemporaryPasswordResponse,
    UserCreateRequest,
    UserModulesResponse,
    UserModulesUpdateRequest,
    UserResponse,
    UserUpdateRequest,
)
from modules.foundation.service.hrms_integration_settings_service import (
    HrmsIntegrationSettingsService,
)
from modules.foundation.service.hrms_user_profile_service import HrmsUserProfileService
from modules.foundation.service.module_access_service import ModuleAccessService
from modules.foundation.service.user_service import UserService
from shared.schemas import APIResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=APIResponse[list[UserResponse]])
def list_users(
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[UserResponse]]:
    return APIResponse(
        message="Users retrieved",
        data=UserService(db).list_user_responses(ctx.tenant_id),
    )


@router.get(
    "/hrms-integration",
    response_model=APIResponse[HrmsIntegrationSettingsResponse],
)
def get_hrms_integration_settings(
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[HrmsIntegrationSettingsResponse]:
    UserService(db).require_erp_admin(ctx.tenant_id, ctx.user_id)
    view = HrmsIntegrationSettingsService(db).get(ctx.tenant_id)
    return APIResponse(
        message="HRMS integration settings",
        data=HrmsIntegrationSettingsResponse(
            base_url=view.base_url,
            employees_path=view.employees_path,
            page_size=view.page_size,
            has_api_key=view.has_api_key,
            api_key_masked=view.api_key_masked,
            api_key=view.api_key,
        ),
    )


@router.put(
    "/hrms-integration",
    response_model=APIResponse[HrmsIntegrationSettingsResponse],
)
def upsert_hrms_integration_settings(
    body: HrmsIntegrationSettingsUpsertRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[HrmsIntegrationSettingsResponse]:
    UserService(db).require_erp_admin(ctx.tenant_id, ctx.user_id)
    view = HrmsIntegrationSettingsService(db).save(
        tenant_id=ctx.tenant_id,
        actor_id=ctx.user_id,
        base_url=body.base_url,
        employees_path=body.employees_path,
        page_size=body.page_size,
        api_key=body.api_key,
    )
    db.commit()
    return APIResponse(
        message="HRMS integration settings saved",
        data=HrmsIntegrationSettingsResponse(
            base_url=view.base_url,
            employees_path=view.employees_path,
            page_size=view.page_size,
            has_api_key=view.has_api_key,
            api_key_masked=view.api_key_masked,
            api_key=view.api_key,
        ),
    )


@router.post(
    "/hrms-integration/test",
    response_model=APIResponse[HrmsIntegrationTestResponse],
)
def test_hrms_integration(
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[HrmsIntegrationTestResponse]:
    UserService(db).require_erp_admin(ctx.tenant_id, ctx.user_id)
    result = HrmsIntegrationSettingsService(db).test(ctx.tenant_id)
    return APIResponse(
        message=result.message,
        data=HrmsIntegrationTestResponse(
            ok=result.ok,
            status_code=result.status_code,
            total=result.total,
            sample_count=result.sample_count,
            message=result.message,
            sample=[HrmsIntegrationTestSample(**row) for row in result.sample],
        ),
    )


@router.post(
    "/hrms-integration/sync",
    response_model=APIResponse[HrmsIntegrationSyncResponse],
)
def sync_hrms_integration(
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[HrmsIntegrationSyncResponse]:
    """Fetch employees from the configured remote HRMS API, upsert masters, then sync logins."""
    UserService(db).require_erp_admin(ctx.tenant_id, ctx.user_id)
    result = HrmsIntegrationSettingsService(db).sync(
        tenant_id=ctx.tenant_id,
        actor_user_id=ctx.user_id,
    )
    db.commit()
    return APIResponse(
        message="HRMS API employees synced",
        data=HrmsIntegrationSyncResponse(
            fetched=result.fetched,
            employees_created=result.employees_created,
            employees_updated=result.employees_updated,
            employees_skipped=result.employees_skipped,
            employee_count=result.user_sync.employee_count,
            created=result.user_sync.created,
            linked=result.user_sync.linked,
            updated=result.user_sync.updated,
            deactivated=result.user_sync.deactivated,
            skipped=result.user_sync.skipped,
        ),
    )


def _hrms_profile_response(view) -> HrmsUserProfileResponse:
    return HrmsUserProfileResponse(
        user_id=view.user_id,
        employee_id=view.employee_id,
        employee_code=view.employee_code,
        display_name=view.display_name,
        first_name=view.first_name,
        last_name=view.last_name,
        email=view.email,
        mobile=view.mobile,
        designation=view.designation,
        department=view.department,
        manager=view.manager,
        manager_code=view.manager_code,
        branch=view.branch,
        company=view.company,
        status=view.status,
        date_of_joining=view.date_of_joining,
        date_of_leaving=view.date_of_leaving,
        gender=view.gender,
        date_of_birth=view.date_of_birth,
        employment_type=view.employment_type,
        work_location=view.work_location,
        is_manager=view.is_manager,
        leave_balances=[
            HrmsLeaveBalanceItem(
                leave_type_code=b.leave_type_code,
                leave_type_name=b.leave_type_name,
                opening_balance=b.opening_balance,
                accrued=b.accrued,
                used=b.used,
                closing_balance=b.closing_balance,
                year=b.year,
            )
            for b in view.leave_balances
        ],
        leave_balance_total=view.leave_balance_total,
        leave_used_total=view.leave_used_total,
        profile_fetched_at=view.profile_fetched_at,
        leave_fetched_at=view.leave_fetched_at,
        leave_refreshed=view.leave_refreshed,
    )


@router.get(
    "/{user_id}/hrms-profile",
    response_model=APIResponse[HrmsUserProfileResponse],
)
def get_hrms_user_profile(
    user_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[HrmsUserProfileResponse]:
    """Return saved HRMS profile; always refresh leave balances from remote."""
    view = HrmsUserProfileService(db).get_for_user(
        tenant_id=ctx.tenant_id,
        user_id=user_id,
        actor_user_id=ctx.user_id,
        force_refresh=False,
    )
    db.commit()
    return APIResponse(message="HRMS user profile", data=_hrms_profile_response(view))


@router.post(
    "/{user_id}/hrms-profile/refresh",
    response_model=APIResponse[HrmsUserProfileResponse],
)
def refresh_hrms_user_profile(
    user_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[HrmsUserProfileResponse]:
    """Force re-fetch of full HRMS profile + leave balances, then persist."""
    view = HrmsUserProfileService(db).get_for_user(
        tenant_id=ctx.tenant_id,
        user_id=user_id,
        actor_user_id=ctx.user_id,
        force_refresh=True,
    )
    db.commit()
    return APIResponse(message="HRMS user profile refreshed", data=_hrms_profile_response(view))


@router.post("/{user_id}/module-access", response_model=APIResponse[UserResponse])
def grant_module_access(
    user_id: UUID,
    body: ModuleAccessRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[UserResponse]:
    """ERP admin: give a user Admin or User access to one or more modules."""
    try:
        keys = body.resolved_module_keys()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    user = ModuleAccessService(db).grant(
        ctx,
        user_id,
        module_keys=keys,
        role=body.role,
        service_job_role=body.service_job_role,
    )
    db.commit()
    return APIResponse(message="Module access updated", data=UserService.to_response(user))


@router.delete("/{user_id}/module-access/{module_key}", response_model=APIResponse[UserResponse])
def revoke_module_access(
    user_id: UUID,
    module_key: str,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[UserResponse]:
    """ERP admin: remove a user's Admin or User access to one module."""
    user = ModuleAccessService(db).revoke(ctx, user_id, module_key=module_key)
    db.commit()
    return APIResponse(message="Module access removed", data=UserService.to_response(user))


@router.post("/{user_id}/temporary-password", response_model=APIResponse[TemporaryPasswordResponse])
def issue_temporary_password(
    user_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[TemporaryPasswordResponse]:
    """ERP admin: one-time password the user must change after signing in."""
    user, password = UserService(db).issue_temporary_password(
        ctx.tenant_id, user_id, actor_id=ctx.user_id
    )
    db.commit()
    return APIResponse(
        message="Temporary password issued",
        data=TemporaryPasswordResponse(
            user_id=user.id,
            email=user.email,
            display_name=user.display_name,
            temporary_password=password,
        ),
    )


@router.post("", response_model=APIResponse[UserResponse])
def create_user(
    body: UserCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[UserResponse]:
    user = UserService(db).create_user(
        tenant_id=ctx.tenant_id,
        email=body.email,
        password=body.password,
        display_name=body.display_name,
        user_type=body.user_type,
        created_by=ctx.user_id,
    )
    db.commit()
    return APIResponse(message="User created", data=UserService.to_response(user))


@router.get("/{user_id}", response_model=APIResponse[UserResponse])
def get_user(
    user_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[UserResponse]:
    user = UserService(db).get_user(ctx.tenant_id, user_id)
    return APIResponse(message="User retrieved", data=UserService.to_response(user))


@router.put("/{user_id}", response_model=APIResponse[UserResponse])
def update_user(
    user_id: UUID,
    body: UserUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[UserResponse]:
    user = UserService(db).update_user(
        ctx.tenant_id,
        user_id,
        updated_by=ctx.user_id,
        **body.model_dump(exclude_unset=True),
    )
    db.commit()
    return APIResponse(message="User updated", data=UserService.to_response(user))


@router.delete("/{user_id}", response_model=APIResponse[None])
def delete_user(
    user_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:delete"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    UserService(db).delete_user(ctx.tenant_id, user_id, deleted_by=ctx.user_id)
    db.commit()
    return APIResponse(message="User deleted", data=None)


@router.post("/{user_id}/roles", response_model=APIResponse[None])
def assign_role(
    user_id: UUID,
    body: AssignRoleRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    UserService(db).assign_role(
        tenant_id=ctx.tenant_id,
        user_id=user_id,
        role_id=body.role_id,
        assigned_by=ctx.user_id,
    )
    db.commit()
    return APIResponse(message="Role assigned", data=None)


@router.delete("/{user_id}/sessions", response_model=APIResponse[None])
def revoke_sessions(
    user_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    UserService(db).revoke_all_sessions(ctx.tenant_id, user_id, revoked_by=ctx.user_id)
    db.commit()
    return APIResponse(message="Sessions revoked", data=None)


@router.get("/{user_id}/modules", response_model=APIResponse[UserModulesResponse])
def get_user_modules(
    user_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[UserModulesResponse]:
    service = UserService(db)
    user, assigned, admin_keys, effective = service.get_user_modules(ctx.tenant_id, user_id)
    return APIResponse(
        message="User modules retrieved",
        data=UserModulesResponse(
            user_id=user.id,
            assigned_module_keys=assigned,
            admin_module_keys=admin_keys,
            effective_module_keys=effective,
        ),
    )


@router.put("/{user_id}/modules", response_model=APIResponse[UserResponse])
def set_user_modules(
    user_id: UUID,
    body: UserModulesUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[UserResponse]:
    user = UserService(db).set_user_modules(
        tenant_id=ctx.tenant_id,
        user_id=user_id,
        module_keys=body.module_keys,
        updated_by=ctx.user_id,
    )
    db.commit()
    return APIResponse(message="User modules updated", data=UserService.to_response(user))
