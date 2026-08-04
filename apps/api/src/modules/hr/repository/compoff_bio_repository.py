"""Comp Off request + biometric device repositories."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.biometric_device import HrBiometricDevice
from modules.hr.models.compoff_request import HrCompoffRequest
from modules.hr.repository.base import HrScopedRepository, utcnow


class CompoffRequestRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrCompoffRequest | None:
        stmt = select(HrCompoffRequest).where(
            HrCompoffRequest.id == row_id,
            HrCompoffRequest.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrCompoffRequest, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(HrCompoffRequest).where(
            HrCompoffRequest.company_id == company_id,
            HrCompoffRequest.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrCompoffRequest, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrCompoffRequest:
        row = HrCompoffRequest(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrCompoffRequest | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row


class BiometricDeviceRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrBiometricDevice | None:
        stmt = select(HrBiometricDevice).where(
            HrBiometricDevice.id == row_id,
            HrBiometricDevice.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrBiometricDevice, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(HrBiometricDevice).where(
            HrBiometricDevice.company_id == company_id,
            HrBiometricDevice.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrBiometricDevice, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def get_by_code(self, ctx: TenantContext, company_id: UUID, device_code: str):
        stmt = select(HrBiometricDevice).where(
            HrBiometricDevice.company_id == company_id,
            HrBiometricDevice.device_code == device_code,
            HrBiometricDevice.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrBiometricDevice, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> HrBiometricDevice:
        row = HrBiometricDevice(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrBiometricDevice | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
