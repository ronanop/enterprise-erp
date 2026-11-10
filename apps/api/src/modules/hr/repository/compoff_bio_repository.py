"""Comp Off request + biometric device / punch repositories."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.biometric_device import HrBiometricDevice
from modules.hr.models.biometric_punch import HrBiometricPunch
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

    def list_rows(self, ctx: TenantContext, company_id: UUID | None):
        stmt = select(HrCompoffRequest).where(HrCompoffRequest.is_deleted.is_(False))
        if company_id is not None:
            stmt = stmt.where(HrCompoffRequest.company_id == company_id)
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

    def list_rows(self, ctx: TenantContext, company_id: UUID | None):
        stmt = select(HrBiometricDevice).where(HrBiometricDevice.is_deleted.is_(False))
        if company_id is not None:
            stmt = stmt.where(HrBiometricDevice.company_id == company_id)
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

    def get_by_code_including_deleted(
        self, ctx: TenantContext, company_id: UUID, device_code: str
    ) -> HrBiometricDevice | None:
        """Unique (company_id, device_code) is company-wide — do not branch-filter."""
        stmt = select(HrBiometricDevice).where(
            HrBiometricDevice.tenant_id == ctx.tenant_id,
            HrBiometricDevice.company_id == company_id,
            HrBiometricDevice.device_code == device_code,
        )
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

    def soft_delete(self, ctx: TenantContext, row_id: UUID) -> bool:
        row = self.get(ctx, row_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return True


class BiometricPunchRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def find_live(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        device_code: str,
        employee_code_raw: str,
        punched_at: datetime,
    ) -> HrBiometricPunch | None:
        stmt = select(HrBiometricPunch).where(
            HrBiometricPunch.company_id == company_id,
            HrBiometricPunch.device_code == device_code,
            HrBiometricPunch.employee_code_raw == employee_code_raw,
            HrBiometricPunch.punched_at == punched_at,
            HrBiometricPunch.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrBiometricPunch, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def upsert(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        device_id: UUID | None,
        device_code: str,
        employee_id: UUID | None,
        employee_code_raw: str,
        punched_at: datetime,
        attendance_date: date,
        notes: str | None = None,
    ) -> tuple[HrBiometricPunch, bool]:
        """Insert punch if new. Returns (row, created)."""
        existing = self.find_live(
            ctx,
            company_id=company_id,
            device_code=device_code,
            employee_code_raw=employee_code_raw,
            punched_at=punched_at,
        )
        if existing is not None:
            # Backfill employee match if a later sync resolves the code.
            if employee_id and existing.employee_id is None:
                existing.employee_id = employee_id
                existing.updated_at = utcnow()
                existing.updated_by = ctx.user_id
                existing.version = int(existing.version or 1) + 1
                self.db.flush()
            return existing, False

        row = HrBiometricPunch(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            device_id=device_id,
            device_code=device_code,
            employee_id=employee_id,
            employee_code_raw=employee_code_raw,
            punched_at=punched_at,
            attendance_date=attendance_date,
            notes=notes,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return row, True

    def list_for_employee_date(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        employee_id: UUID,
        attendance_date: date,
    ) -> list[HrBiometricPunch]:
        stmt = (
            select(HrBiometricPunch)
            .where(
                HrBiometricPunch.company_id == company_id,
                HrBiometricPunch.employee_id == employee_id,
                HrBiometricPunch.attendance_date == attendance_date,
                HrBiometricPunch.is_deleted.is_(False),
            )
            .order_by(HrBiometricPunch.punched_at.asc())
        )
        stmt = self.apply_hr_filter(stmt, HrBiometricPunch, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def list_for_employee(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None,
        employee_id: UUID,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 500,
    ) -> list[HrBiometricPunch]:
        stmt = select(HrBiometricPunch).where(
            HrBiometricPunch.employee_id == employee_id,
            HrBiometricPunch.is_deleted.is_(False),
        )
        if company_id is not None:
            stmt = stmt.where(HrBiometricPunch.company_id == company_id)
        if date_from is not None:
            stmt = stmt.where(HrBiometricPunch.attendance_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(HrBiometricPunch.attendance_date <= date_to)
        stmt = self.apply_hr_filter(stmt, HrBiometricPunch, ctx, branch_scoped=True)
        stmt = stmt.order_by(HrBiometricPunch.punched_at.desc()).limit(max(1, min(limit, 2000)))
        return list(self.db.scalars(stmt).all())

    def list_for_device(
        self,
        ctx: TenantContext,
        *,
        device_id: UUID,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 200,
    ) -> list[HrBiometricPunch]:
        stmt = select(HrBiometricPunch).where(
            HrBiometricPunch.device_id == device_id,
            HrBiometricPunch.is_deleted.is_(False),
        )
        if date_from is not None:
            stmt = stmt.where(HrBiometricPunch.attendance_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(HrBiometricPunch.attendance_date <= date_to)
        stmt = self.apply_hr_filter(stmt, HrBiometricPunch, ctx, branch_scoped=True)
        stmt = stmt.order_by(HrBiometricPunch.punched_at.desc()).limit(max(1, min(limit, 1000)))
        return list(self.db.scalars(stmt).all())
