"""Party registration repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.domain.entities import PartyRegistrationEntity
from modules.master_data.models.party_registration import MasterPartyRegistration
from modules.master_data.repository.base import MasterScopedRepository, utcnow


class PartyRegistrationRepository(MasterScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_registrations(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        party_type: str | None = None,
        status: str | None = None,
    ) -> list[PartyRegistrationEntity]:
        stmt = select(MasterPartyRegistration)
        stmt = self.apply_master_filter(stmt, MasterPartyRegistration, ctx, branch_scoped=True)
        if company_id:
            stmt = stmt.where(MasterPartyRegistration.company_id == company_id)
        if branch_id:
            stmt = stmt.where(MasterPartyRegistration.branch_id == branch_id)
        if party_type:
            stmt = stmt.where(MasterPartyRegistration.party_type == party_type)
        if status:
            stmt = stmt.where(MasterPartyRegistration.status == status)
        stmt = stmt.order_by(MasterPartyRegistration.created_at.desc())
        return [self._to_entity(r) for r in self.db.scalars(stmt).all()]

    def get_by_id(
        self, ctx: TenantContext, registration_id: UUID
    ) -> PartyRegistrationEntity | None:
        row = self._get_row(ctx, registration_id)
        return self._to_entity(row) if row else None

    def create(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        registration_code: str,
        party_type: str,
        legal_name: str,
        **fields: object,
    ) -> PartyRegistrationEntity:
        row = MasterPartyRegistration(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            registration_code=registration_code,
            party_type=party_type,
            legal_name=legal_name,
            kyc_documents_json=fields.pop("kyc_documents_json", None) or [],
            kyc_status="pending",
            status="draft",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        for key, value in fields.items():
            if value is not None and hasattr(row, key):
                setattr(row, key, value)
        self.db.add(row)
        self.db.flush()
        return self._to_entity(row)

    def update(
        self, ctx: TenantContext, registration_id: UUID, **fields: object
    ) -> PartyRegistrationEntity | None:
        row = self._get_row(ctx, registration_id)
        if row is None:
            return None
        for key, value in fields.items():
            if hasattr(row, key) and value is not None:
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version += 1
        self.db.flush()
        return self._to_entity(row)

    def soft_delete(self, ctx: TenantContext, registration_id: UUID) -> bool:
        stmt = select(MasterPartyRegistration).where(
            MasterPartyRegistration.id == registration_id,
            MasterPartyRegistration.tenant_id == ctx.tenant_id,
        )
        row = self.db.scalar(stmt)
        if row is None or row.is_deleted:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        self.db.flush()
        return True

    def _get_row(
        self, ctx: TenantContext, registration_id: UUID
    ) -> MasterPartyRegistration | None:
        stmt = select(MasterPartyRegistration).where(
            MasterPartyRegistration.id == registration_id,
            MasterPartyRegistration.tenant_id == ctx.tenant_id,
            MasterPartyRegistration.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    @staticmethod
    def _to_entity(row: MasterPartyRegistration) -> PartyRegistrationEntity:
        def as_float(value) -> float | None:
            return float(value) if value is not None else None

        return PartyRegistrationEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            registration_code=row.registration_code,
            party_type=row.party_type,
            legal_name=row.legal_name,
            trade_name=row.trade_name,
            party_subtype=row.party_subtype,
            tax_number=row.tax_number,
            pan_number=row.pan_number,
            cin_number=row.cin_number,
            contact_person=row.contact_person,
            email=row.email,
            mobile=row.mobile,
            address_json=row.address_json,
            bank_details_json=row.bank_details_json,
            kyc_documents_json=list(row.kyc_documents_json or []),
            kyc_status=row.kyc_status,
            kyc_verified_at=row.kyc_verified_at,
            kyc_verified_by=row.kyc_verified_by,
            declared_annual_turnover=as_float(row.declared_annual_turnover),
            requested_credit_limit=as_float(row.requested_credit_limit),
            requested_credit_days=row.requested_credit_days,
            expected_monthly_spend=as_float(row.expected_monthly_spend),
            early_payment_discount_pct=as_float(row.early_payment_discount_pct),
            currency_code=row.currency_code,
            evaluation_json=row.evaluation_json,
            assessed_credit_limit=as_float(row.assessed_credit_limit),
            assessed_credit_days=row.assessed_credit_days,
            risk_band=row.risk_band,
            evaluated_at=row.evaluated_at,
            evaluated_by=row.evaluated_by,
            status=row.status,
            decision_reason=row.decision_reason,
            decided_at=row.decided_at,
            decided_by=row.decided_by,
            source_crm_company_id=row.source_crm_company_id,
            source_kyc_record_id=row.source_kyc_record_id,
            customer_id=row.customer_id,
            vendor_id=row.vendor_id,
            version=row.version,
            is_deleted=row.is_deleted,
        )
