"""Exit agreement service - issue and sign NOC, NDA and non-solicit on the system.

Issuing renders the agreement text from a fixed template and stores it with a
SHA-256 fingerprint. Signing captures the typed name, the signer, the time, and
the originating IP, so the undertaking stands up later.
"""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException, ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.enums import HrEntityType
from modules.hr.domain.exit_agreements import (
    DEFAULT_NON_SOLICIT_MONTHS,
    MAX_NON_SOLICIT_MONTHS,
    REQUIRED_FOR_COMPLETION,
    TITLES,
    AgreementContext,
    ExitAgreementStatus,
    ExitAgreementType,
    add_months,
    content_hash,
    render,
    signature_matches,
)
from modules.hr.models import HrExitAgreement, HrSeparation
from modules.hr.repository.exit_agreement_repository import ExitAgreementRepository
from modules.hr.service.document_number_service import DocumentNumberService
from modules.hr.service.hr_scope_validator import HrScopeValidator

ENTITY_NAME = "hr_exit_agreement"

# Exits far enough along that the paperwork can be issued.
ISSUABLE_SEPARATION_STATUSES = frozenset(
    {"manager_approved", "it_approved", "accounts_approved", "hr_approved"}
)


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ExitAgreementService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ExitAgreementRepository(db)
        self._scope = HrScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._master = HrMasterDataAdapter(db)
        self._audit = AuditService(db)

    # ------------------------------------------------------------------ reads

    def list_for_separation(self, ctx: TenantContext, separation_id: UUID):
        self._get_separation(ctx, separation_id)
        return self._repo.list_for_separation(ctx, separation_id)

    def get(self, ctx: TenantContext, agreement_id: UUID) -> HrExitAgreement:
        row = self._repo.get(ctx, agreement_id)
        if row is None:
            raise NotFoundException("Exit agreement not found")
        return row

    def signed_types(self, ctx: TenantContext, separation_id: UUID) -> set[str]:
        return {
            row.agreement_type
            for row in self._repo.list_for_separation(ctx, separation_id)
            if row.status == ExitAgreementStatus.SIGNED.value
        }

    def missing_required_signatures(
        self, ctx: TenantContext, separation_id: UUID
    ) -> list[str]:
        signed = self.signed_types(ctx, separation_id)
        return [t.value for t in REQUIRED_FOR_COMPLETION if t.value not in signed]

    # ----------------------------------------------------------------- issue

    def issue(
        self,
        ctx: TenantContext,
        separation_id: UUID,
        *,
        agreement_type: str,
        restriction_months: int | None = None,
    ) -> HrExitAgreement:
        try:
            kind = ExitAgreementType(agreement_type)
        except ValueError as exc:
            raise ValidationException(
                "agreement_type must be one of: noc, nda, non_solicit"
            ) from exc

        separation = self._get_separation(ctx, separation_id)
        if separation.status not in ISSUABLE_SEPARATION_STATUSES:
            raise ValidationException(
                "Exit agreements can be issued once the manager has approved the exit"
            )

        existing = self._repo.get_by_type(ctx, separation_id, kind.value)
        if existing is not None and existing.status != ExitAgreementStatus.VOID.value:
            raise ConflictException(
                f"A {kind.value} agreement has already been issued for this exit"
            )

        months = self._resolve_restriction_months(kind, restriction_months)
        last_working_date = (
            separation.approved_last_working_date
            or separation.expected_exit_date
            or separation.requested_last_working_date
        )
        restriction_end = (
            add_months(last_working_date, months)
            if kind is ExitAgreementType.NON_SOLICIT and last_working_date and months
            else None
        )

        employee = self._master.get_employee(ctx, separation.employee_id)
        body = render(
            kind,
            AgreementContext(
                employee_name=_employee_name(employee),
                employee_code=getattr(employee, "employee_code", ""),
                company_name=self._company_name(ctx, separation.company_id),
                designation=getattr(employee, "designation", None),
                last_working_date=last_working_date,
                restriction_months=months or DEFAULT_NON_SOLICIT_MONTHS,
                restriction_end_date=restriction_end,
            ),
        )

        row = self._repo.create(
            ctx,
            company_id=separation.company_id,
            branch_id=separation.branch_id,
            document_number=self._numbers.generate(
                HrEntityType.EXIT_AGREEMENT,
                separation.company_id,
                HrExitAgreement,
                "document_number",
            ),
            separation_id=separation_id,
            employee_id=separation.employee_id,
            agreement_type=kind.value,
            title=TITLES[kind],
            body_text=body,
            body_sha256=content_hash(body),
            restriction_months=months,
            restriction_end_date=restriction_end,
            status=ExitAgreementStatus.ISSUED.value,
            issued_at=_utcnow(),
            issued_by=ctx.user_id,
        )
        self._log(ctx, row.id, "issue", {"agreement_type": kind.value})
        self._notify_issued(ctx, separation, row)
        return row

    # ------------------------------------------------------------------ sign

    def sign(
        self,
        ctx: TenantContext,
        agreement_id: UUID,
        *,
        signature_name: str,
        signature_ip: str | None = None,
        signature_user_agent: str | None = None,
    ) -> HrExitAgreement:
        row = self.get(ctx, agreement_id)
        if row.status == ExitAgreementStatus.SIGNED.value:
            raise ConflictException("This agreement has already been signed")
        if row.status != ExitAgreementStatus.ISSUED.value:
            raise ValidationException(f"A {row.status} agreement cannot be signed")

        employee = self._master.get_employee(ctx, row.employee_id)
        if not signature_matches(signature_name, _employee_name(employee)):
            raise ValidationException(
                "The typed signature must match the employee's full name on record"
            )

        updated = self._repo.update(
            ctx,
            agreement_id,
            status=ExitAgreementStatus.SIGNED.value,
            signed_at=_utcnow(),
            signed_by=ctx.user_id,
            signature_name=" ".join(signature_name.split()),
            signature_ip=signature_ip,
            signature_user_agent=(signature_user_agent or "")[:500] or None,
        )
        self._log(
            ctx,
            agreement_id,
            "sign",
            {
                "agreement_type": row.agreement_type,
                "body_sha256": row.body_sha256,
                "signature_ip": signature_ip,
            },
        )
        return updated

    def decline(
        self, ctx: TenantContext, agreement_id: UUID, *, reason: str
    ) -> HrExitAgreement:
        row = self.get(ctx, agreement_id)
        if row.status != ExitAgreementStatus.ISSUED.value:
            raise ValidationException(f"A {row.status} agreement cannot be declined")
        if not reason.strip():
            raise ValidationException("A reason is required when declining")

        updated = self._repo.update(
            ctx,
            agreement_id,
            status=ExitAgreementStatus.DECLINED.value,
            declined_at=_utcnow(),
            decline_reason=reason.strip(),
        )
        self._log(ctx, agreement_id, "decline", {"reason": reason.strip()})
        return updated

    def void(self, ctx: TenantContext, agreement_id: UUID, *, reason: str) -> HrExitAgreement:
        row = self.get(ctx, agreement_id)
        if row.status == ExitAgreementStatus.SIGNED.value:
            raise ValidationException("A signed agreement cannot be voided")

        updated = self._repo.update(
            ctx,
            agreement_id,
            status=ExitAgreementStatus.VOID.value,
            decline_reason=reason.strip() or None,
        )
        self._log(ctx, agreement_id, "void", {"reason": reason})
        return updated

    # --------------------------------------------------------------- helpers

    @staticmethod
    def _resolve_restriction_months(
        kind: ExitAgreementType, restriction_months: int | None
    ) -> int | None:
        if kind is not ExitAgreementType.NON_SOLICIT:
            return None
        months = (
            restriction_months
            if restriction_months is not None
            else DEFAULT_NON_SOLICIT_MONTHS
        )
        if months < 1 or months > MAX_NON_SOLICIT_MONTHS:
            raise ValidationException(
                f"Non-solicit period must be between 1 and {MAX_NON_SOLICIT_MONTHS} months"
            )
        return months

    def _get_separation(self, ctx: TenantContext, separation_id: UUID) -> HrSeparation:
        stmt = select(HrSeparation).where(
            HrSeparation.id == separation_id,
            HrSeparation.tenant_id == ctx.tenant_id,
            HrSeparation.is_deleted.is_(False),
        )
        row = self._db.scalar(stmt)
        if row is None:
            raise NotFoundException("Separation not found")
        self._scope.validate_company_access(ctx, row.company_id)
        return row

    def _company_name(self, ctx: TenantContext, company_id: UUID) -> str:
        from modules.organization.models import OrgCompany

        company = self._db.scalar(
            select(OrgCompany).where(
                OrgCompany.id == company_id,
                OrgCompany.tenant_id == ctx.tenant_id,
            )
        )
        return getattr(company, "company_name", None) or "the Company"

    def _notify_issued(
        self, ctx: TenantContext, separation: HrSeparation, agreement: HrExitAgreement
    ) -> None:
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=separation.employee_id,
                template_code="hr.exit_agreement_issued",
                template_name="Exit Agreement Issued",
                event_type="hr.exit_agreement_issued",
                title=f"{agreement.title} is ready for your signature",
                body=(
                    f"{agreement.title} ({agreement.document_number}) has been issued "
                    f"as part of offboarding {separation.document_number}. "
                    "Please review and sign it before your last working day."
                ),
                kind="separation",
                extra={
                    "separation_id": str(separation.id),
                    "agreement_id": str(agreement.id),
                    "href": "/ess/inbox",
                },
            )
        except Exception:
            pass

    def _log(
        self, ctx: TenantContext, agreement_id: UUID, operation: str, payload: dict
    ) -> None:
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_NAME,
            entity_id=agreement_id,
            operation=operation,
            performed_by=ctx.user_id,
            new_value=payload,
        )


def _employee_name(employee) -> str:
    first = getattr(employee, "first_name", "") or ""
    last = getattr(employee, "last_name", "") or ""
    return " ".join(part for part in (first, last) if part).strip()
