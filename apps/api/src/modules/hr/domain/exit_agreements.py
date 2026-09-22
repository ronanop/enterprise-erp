"""Exit agreement texts and signature rules.

Pure domain logic - no ORM, no framework imports.

An exit is only clean if the paperwork is signed and provable later. Three
documents are rendered from fixed templates at issue time, hashed, and stored
with the text that was actually shown, so what the employee agreed to cannot be
edited afterwards:

* **NOC** - the company confirms nothing is outstanding.
* **NDA** - confidential information stays confidential after leaving.
* **Non-solicit** - the leaver will not approach the company's customers or
  staff for an agreed number of months.

The non-solicit restriction window is what makes the clause enforceable, so it
is stored as a real end date rather than prose.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import date
from enum import Enum


class ExitAgreementType(str, Enum):
    NOC = "noc"
    NDA = "nda"
    NON_SOLICIT = "non_solicit"


class ExitAgreementStatus(str, Enum):
    ISSUED = "issued"
    SIGNED = "signed"
    DECLINED = "declined"
    VOID = "void"


# Agreements that must be signed before an exit can be completed.
REQUIRED_FOR_COMPLETION = (ExitAgreementType.NOC, ExitAgreementType.NDA)

DEFAULT_NON_SOLICIT_MONTHS = 6
MAX_NON_SOLICIT_MONTHS = 24

TITLES: dict[ExitAgreementType, str] = {
    ExitAgreementType.NOC: "No Objection Certificate",
    ExitAgreementType.NDA: "Confidentiality Undertaking",
    ExitAgreementType.NON_SOLICIT: "Non-Solicitation Undertaking",
}


@dataclass(frozen=True, kw_only=True)
class AgreementContext:
    employee_name: str
    employee_code: str
    company_name: str
    designation: str | None = None
    last_working_date: date | None = None
    restriction_months: int = DEFAULT_NON_SOLICIT_MONTHS
    restriction_end_date: date | None = None


def add_months(start: date, months: int) -> date:
    """Calendar-month addition, clamped to the last valid day of the month."""
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    days_in_month = [31, 29 if _is_leap(year) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = min(start.day, days_in_month[month - 1])
    return date(year, month, day)


def _is_leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def content_hash(body: str) -> str:
    """SHA-256 of the exact text presented, so later edits are detectable."""
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _lwd(ctx: AgreementContext) -> str:
    return ctx.last_working_date.strftime("%d %B %Y") if ctx.last_working_date else "the last working day"


def render_noc(ctx: AgreementContext) -> str:
    return (
        f"NO OBJECTION CERTIFICATE\n\n"
        f"This is to certify that {ctx.employee_name} (Employee Code {ctx.employee_code})"
        f"{f', {ctx.designation},' if ctx.designation else ''} was employed with "
        f"{ctx.company_name} and was relieved of duties with effect from {_lwd(ctx)}.\n\n"
        f"All company assets issued to the employee have been returned, all system "
        f"access has been revoked, and the company has no dues outstanding against "
        f"the employee as on the date of this certificate.\n\n"
        f"{ctx.company_name} has no objection to the employee taking up subsequent "
        f"employment, subject to the confidentiality and non-solicitation "
        f"undertakings signed separately.\n\n"
        f"By signing below, the employee confirms that the particulars above are "
        f"correct and that no claims remain against the company."
    )


def render_nda(ctx: AgreementContext) -> str:
    return (
        f"CONFIDENTIALITY UNDERTAKING\n\n"
        f"I, {ctx.employee_name} (Employee Code {ctx.employee_code}), having been "
        f"employed with {ctx.company_name} until {_lwd(ctx)}, acknowledge that during "
        f"my employment I had access to confidential information belonging to the "
        f"company and to its customers.\n\n"
        f"Confidential information includes customer lists and contact details, "
        f"pricing, margins and commercial terms, vendor and distributor arrangements, "
        f"technical designs and configurations, source code, business plans, and any "
        f"other non-public information of the company or its customers.\n\n"
        f"I undertake that I will not, at any time after my last working day, "
        f"disclose, publish or use any such confidential information for my own "
        f"benefit or for the benefit of any other person or organisation.\n\n"
        f"I further confirm that I have returned or permanently deleted all copies of "
        f"such information in my possession, in any form, including on personal "
        f"devices and personal accounts.\n\n"
        f"I understand that a breach of this undertaking entitles {ctx.company_name} "
        f"to pursue legal remedies against me."
    )


def render_non_solicit(ctx: AgreementContext) -> str:
    months = ctx.restriction_months
    until = (
        ctx.restriction_end_date.strftime("%d %B %Y")
        if ctx.restriction_end_date
        else f"{months} months from my last working day"
    )
    return (
        f"NON-SOLICITATION UNDERTAKING\n\n"
        f"I, {ctx.employee_name} (Employee Code {ctx.employee_code}), having been "
        f"employed with {ctx.company_name} until {_lwd(ctx)}, undertake that for a "
        f"period of {months} months from my last working day, that is until {until}, "
        f"I will not, whether directly or indirectly, and whether on my own account or "
        f"on behalf of any employer, partner or client:\n\n"
        f"(a) approach, solicit or accept business from any customer of "
        f"{ctx.company_name} with whom I dealt, or about whom I obtained confidential "
        f"information, during my employment; or\n\n"
        f"(b) solicit or induce any employee of {ctx.company_name} to leave their "
        f"employment with the company.\n\n"
        f"I acknowledge that this restriction is reasonable, is limited in time, and "
        f"is necessary to protect the legitimate business interests and customer "
        f"relationships of {ctx.company_name}.\n\n"
        f"I understand that a breach of this undertaking entitles {ctx.company_name} "
        f"to injunctive relief and to recover damages from me."
    )


RENDERERS = {
    ExitAgreementType.NOC: render_noc,
    ExitAgreementType.NDA: render_nda,
    ExitAgreementType.NON_SOLICIT: render_non_solicit,
}


def render(agreement_type: ExitAgreementType, ctx: AgreementContext) -> str:
    return RENDERERS[agreement_type](ctx)


def normalise_name(value: str) -> str:
    """Collapse case and spacing so a typed signature can be compared to a record."""
    return " ".join(value.split()).casefold()


def signature_matches(signature_text: str, employee_name: str) -> bool:
    """A typed signature must be the employee's own name to count as consent."""
    return normalise_name(signature_text) == normalise_name(employee_name)
