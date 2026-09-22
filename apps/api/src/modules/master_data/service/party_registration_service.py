"""Party registration service.

Owns the onboarding lifecycle for customers and vendors:

    draft -> (KYC verified + credit evaluated) -> submitted -> approved -> converted

Approval is what creates the ``master_customer`` / ``master_vendor`` record, so
a party cannot reach the masters without verified KYC and a recorded credit
decision behind it.
"""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ValidationException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.master_data.domain.credit_evaluation import (
    DEFAULT_MONTHLY_INTEREST_RATE_PCT,
    DEFAULT_SUPPLIER_CREDIT_DAYS,
    evaluate_customer_credit,
    evaluate_vendor_terms,
)
from modules.master_data.domain.enums import (
    REGISTRATION_CODE_ENTITY_TYPES,
    KycStatus,
    PartyRegistrationStatus,
    PartyType,
)
from modules.master_data.models.party_registration import MasterPartyRegistration
from modules.master_data.repository.party_registration_repository import (
    PartyRegistrationRepository,
)
from modules.master_data.service.code_generator_service import CodeGeneratorService
from modules.master_data.service.customer_service import CustomerService
from modules.master_data.service.master_scope_validator import MasterScopeValidator
from modules.master_data.service.vendor_service import VendorService

ENTITY_NAME = "master_party_registration"

DEFAULT_CUSTOMER_SUBTYPE = "corporate"
DEFAULT_VENDOR_SUBTYPE = "domestic"

# Registrations that can still be edited by the requester.
EDITABLE_STATUSES = frozenset(
    {PartyRegistrationStatus.DRAFT.value, PartyRegistrationStatus.SUBMITTED.value}
)

# Credit bands that a reviewer must not wave through without an explicit override.
BLOCKING_RISK_BANDS = frozenset({"unacceptable"})


def _utcnow() -> datetime:
    return datetime.now(UTC)


class PartyRegistrationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = PartyRegistrationRepository(db)
        self._audit = AuditService(db)
        self._codes = CodeGeneratorService(db)
        self._scope = MasterScopeValidator(db)
        self._customers = CustomerService(db)
        self._vendors = VendorService(db)

    # ------------------------------------------------------------------ reads

    def list_registrations(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        party_type: str | None = None,
        status: str | None = None,
    ):
        if company_id:
            self._scope.validate_company_access(ctx, company_id)
        if branch_id:
            self._scope.validate_branch_access(ctx, branch_id)
        return self._repo.list_registrations(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            party_type=party_type,
            status=status,
        )

    def get_registration(self, ctx: TenantContext, registration_id: UUID):
        registration = self._repo.get_by_id(ctx, registration_id)
        if registration is None:
            raise NotFoundException("Registration not found")
        self._scope.validate_company_access(ctx, registration.company_id)
        self._scope.validate_branch_access(ctx, registration.branch_id)
        return registration

    # ----------------------------------------------------------------- writes

    def create_registration(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID,
        party_type: str,
        legal_name: str,
        **fields,
    ):
        if party_type not in REGISTRATION_CODE_ENTITY_TYPES:
            raise ValidationException("party_type must be 'customer' or 'vendor'")

        resolved_company_id = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)

        registration_code = self._codes.generate(
            REGISTRATION_CODE_ENTITY_TYPES[party_type],
            resolved_company_id,
            model=MasterPartyRegistration,
            code_column="registration_code",
        )
        registration = self._repo.create(
            ctx,
            company_id=resolved_company_id,
            branch_id=branch_id,
            registration_code=registration_code,
            party_type=party_type,
            legal_name=legal_name,
            **fields,
        )
        self._log(ctx, registration.id, "create", {"registration_code": registration_code})
        return registration

    def update_registration(self, ctx: TenantContext, registration_id: UUID, **fields):
        registration = self.get_registration(ctx, registration_id)
        if registration.status not in EDITABLE_STATUSES:
            raise ValidationException(
                f"Registration is {registration.status} and can no longer be edited"
            )
        if fields.get("branch_id") is not None:
            self._scope.validate_branch_access(ctx, fields["branch_id"])

        updated = self._repo.update(ctx, registration_id, **fields)
        if updated is None:
            raise NotFoundException("Registration not found")
        self._log(ctx, registration_id, "update", fields)
        return updated

    def delete_registration(self, ctx: TenantContext, registration_id: UUID) -> None:
        registration = self.get_registration(ctx, registration_id)
        if registration.status == PartyRegistrationStatus.CONVERTED.value:
            raise ValidationException("A converted registration cannot be deleted")
        if not self._repo.soft_delete(ctx, registration_id):
            raise NotFoundException("Registration not found")
        self._log(ctx, registration_id, "delete", None)

    # -------------------------------------------------------------------- kyc

    def verify_kyc(
        self,
        ctx: TenantContext,
        registration_id: UUID,
        *,
        verified: bool,
        reason: str | None = None,
    ):
        registration = self.get_registration(ctx, registration_id)
        if not registration.kyc_documents_json:
            raise ValidationException("Attach at least one KYC document before verifying")

        status = KycStatus.VERIFIED.value if verified else KycStatus.REJECTED.value
        updated = self._repo.update(
            ctx,
            registration_id,
            kyc_status=status,
            kyc_verified_at=_utcnow(),
            kyc_verified_by=ctx.user_id,
            decision_reason=reason,
        )
        self._log(ctx, registration_id, "kyc_verify", {"kyc_status": status})
        return updated

    # ------------------------------------------------------------- evaluation

    def evaluate_credit(
        self,
        ctx: TenantContext,
        registration_id: UUID,
        *,
        supplier_credit_days: int = DEFAULT_SUPPLIER_CREDIT_DAYS,
        customer_credit_days: int = 30,
        monthly_interest_rate_pct: Decimal | None = None,
    ):
        registration = self.get_registration(ctx, registration_id)
        rate = (
            Decimal(str(monthly_interest_rate_pct))
            if monthly_interest_rate_pct is not None
            else DEFAULT_MONTHLY_INTEREST_RATE_PCT
        )

        if registration.party_type == PartyType.CUSTOMER.value:
            result = evaluate_customer_credit(
                declared_annual_turnover=registration.declared_annual_turnover,
                requested_credit_limit=registration.requested_credit_limit,
                requested_credit_days=registration.requested_credit_days,
                supplier_credit_days=supplier_credit_days,
                monthly_interest_rate_pct=rate,
            )
            updated = self._repo.update(
                ctx,
                registration_id,
                evaluation_json=result.to_json(),
                assessed_credit_limit=float(result.recommended_credit_limit),
                assessed_credit_days=result.recommended_credit_days,
                risk_band=result.risk_band,
                evaluated_at=_utcnow(),
                evaluated_by=ctx.user_id,
            )
        else:
            result = evaluate_vendor_terms(
                offered_credit_days=registration.requested_credit_days,
                customer_credit_days=customer_credit_days,
                expected_monthly_spend=registration.expected_monthly_spend,
                early_payment_discount_pct=registration.early_payment_discount_pct,
                monthly_interest_rate_pct=rate,
            )
            updated = self._repo.update(
                ctx,
                registration_id,
                evaluation_json=result.to_json(),
                assessed_credit_days=result.offered_credit_days,
                evaluated_at=_utcnow(),
                evaluated_by=ctx.user_id,
            )

        self._log(ctx, registration_id, "evaluate", result.to_json())
        return updated

    # ------------------------------------------------------------- lifecycle

    def submit(self, ctx: TenantContext, registration_id: UUID):
        registration = self.get_registration(ctx, registration_id)
        if registration.status != PartyRegistrationStatus.DRAFT.value:
            raise ValidationException(
                f"Only a draft registration can be submitted (currently {registration.status})"
            )
        if registration.kyc_status != KycStatus.VERIFIED.value:
            raise ValidationException("KYC must be verified before submitting for approval")
        if registration.evaluation_json is None:
            raise ValidationException("Run the credit evaluation before submitting for approval")

        updated = self._repo.update(
            ctx, registration_id, status=PartyRegistrationStatus.SUBMITTED.value
        )
        self._log(ctx, registration_id, "submit", None)
        return updated

    def approve(
        self,
        ctx: TenantContext,
        registration_id: UUID,
        *,
        approved_credit_limit: float | None = None,
        approved_credit_days: int | None = None,
        reason: str | None = None,
        override_risk_band: bool = False,
    ):
        registration = self.get_registration(ctx, registration_id)
        if registration.status != PartyRegistrationStatus.SUBMITTED.value:
            raise ValidationException(
                f"Only a submitted registration can be approved "
                f"(currently {registration.status})"
            )
        if registration.risk_band in BLOCKING_RISK_BANDS and not override_risk_band:
            raise ValidationException(
                f"Credit risk band is '{registration.risk_band}'. Approving this "
                "requires an explicit override with a recorded reason."
            )
        if override_risk_band and not reason:
            raise ValidationException("An override requires a reason")

        credit_limit = (
            approved_credit_limit
            if approved_credit_limit is not None
            else registration.assessed_credit_limit
        )
        credit_days = (
            approved_credit_days
            if approved_credit_days is not None
            else registration.assessed_credit_days
        )

        if registration.party_type == PartyType.CUSTOMER.value:
            party = self._customers.create_customer(
                ctx,
                company_id=registration.company_id,
                branch_id=registration.branch_id,
                customer_name=registration.legal_name,
                customer_type=registration.party_subtype or DEFAULT_CUSTOMER_SUBTYPE,
                billing_address_json=registration.address_json or {},
                tax_number=registration.tax_number,
                email=registration.email,
                mobile=registration.mobile,
                credit_limit=credit_limit,
                currency_code=registration.currency_code,
            )
            link = {"customer_id": party.id}
        else:
            party = self._vendors.create_vendor(
                ctx,
                company_id=registration.company_id,
                branch_id=registration.branch_id,
                vendor_name=registration.legal_name,
                vendor_type=registration.party_subtype or DEFAULT_VENDOR_SUBTYPE,
                tax_number=registration.tax_number,
                email=registration.email,
                mobile=registration.mobile,
                payment_terms=f"{credit_days} days" if credit_days else None,
                address_json=registration.address_json,
            )
            link = {"vendor_id": party.id}

        updated = self._repo.update(
            ctx,
            registration_id,
            status=PartyRegistrationStatus.CONVERTED.value,
            assessed_credit_limit=credit_limit,
            assessed_credit_days=credit_days,
            decision_reason=reason,
            decided_at=_utcnow(),
            decided_by=ctx.user_id,
            **link,
        )
        self._log(
            ctx,
            registration_id,
            "approve",
            {
                "party_type": registration.party_type,
                "credit_limit": credit_limit,
                "credit_days": credit_days,
                "risk_band": registration.risk_band,
                "override": override_risk_band,
                **{k: str(v) for k, v in link.items()},
            },
        )
        return updated

    def reject(self, ctx: TenantContext, registration_id: UUID, *, reason: str):
        registration = self.get_registration(ctx, registration_id)
        if registration.status in (
            PartyRegistrationStatus.CONVERTED.value,
            PartyRegistrationStatus.REJECTED.value,
        ):
            raise ValidationException(
                f"Registration is already {registration.status}"
            )
        if not reason:
            raise ValidationException("A rejection reason is required")

        updated = self._repo.update(
            ctx,
            registration_id,
            status=PartyRegistrationStatus.REJECTED.value,
            decision_reason=reason,
            decided_at=_utcnow(),
            decided_by=ctx.user_id,
        )
        self._log(ctx, registration_id, "reject", {"reason": reason})
        return updated

    # ------------------------------------------------------------------ audit

    def _log(
        self, ctx: TenantContext, registration_id: UUID, operation: str, payload: dict | None
    ) -> None:
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_NAME,
            entity_id=registration_id,
            operation=operation,
            performed_by=ctx.user_id,
            new_value=payload,
        )
